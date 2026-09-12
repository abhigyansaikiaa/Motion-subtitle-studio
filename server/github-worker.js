require('dotenv').config();
const { supabase } = require('./supabase');
const fs = require('fs');
const path = require('path');
const storageProvider = require('./storage');
const { transcribeVideo } = require('./transcription');
const { saveTranscript, updateProjectStatus, attachRenderJob } = require('./engine/ProjectEngine');
const { COST } = require('./engine/JobEngine');
const { renderVideo } = require('./render');
const { checkCredits, deductCredits, incrementVideosUsed } = require('./credits');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production-make-it-long-and-random';
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

function createWordLocal(id, word, start, end) {
  return {
    id, word, start, end,
    styles: {
      color: '#ffffff', fontFamily: 'Inter', fontSize: 24,
      fontWeight: 'bold', textTransform: 'uppercase', textShadow: '2px 2px 0px #000000', y: 80
    }
  };
}

async function updateJobState(jobId, status, progress, message) {
  await supabase
    .from('jobs')
    .update({ status, progress, message, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

async function processTranscription(projectId) {
  // 1. Atomic claim
  const { data: claimed } = await supabase
    .from('projects')
    .update({ status: 'TRANSCRIBING', updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .in('status', ['QUEUED_TRANSCRIPTION', 'FAILED'])
    .select('*, videos!projects_video_id_fkey(storage_path)');

  if (!claimed || claimed.length === 0) {
    console.log(`[Worker] Project ${projectId} is not QUEUED_TRANSCRIPTION or already claimed.`);
    return;
  }

  const project = claimed[0];
  const b2Key = project.videos?.storage_path || project.video_id;
  const inputFilename = path.basename(b2Key);
  const inputPath = path.join(uploadDir, inputFilename);
  const language = project.segments?._meta?.language || 'auto';

  try {
    let videoSource = inputPath;
    
    // For transcription, we don't need to download the full video.
    // ffmpeg can stream the audio directly from a presigned URL.
    if (storageProvider.type !== 'local') {
      videoSource = await storageProvider.getPresignedUrl(b2Key, 3600);
      console.log(`[Worker] Using presigned URL for audio extraction (bypassing download)`);
    } else if (!fs.existsSync(inputPath)) {
      await storageProvider.downloadFile(b2Key, inputPath);
    }

    // Pass the inputFilename so transcription.js knows what to name the temp audio file
    const transcriptData = await transcribeVideo(videoSource, language, inputFilename);
    // transcribeVideo now returns { language, languageProbability, words: [{id, text, start, end, index}] }
    const wordsRaw = transcriptData.words;

    await saveTranscript(projectId, wordsRaw);
    await updateProjectStatus(projectId, 'TRANSCRIBED', {
      language: transcriptData.language || language,
      duration: wordsRaw.length > 0 ? wordsRaw[wordsRaw.length - 1].end : 0,
      metrics: transcriptData.metrics
    });
    console.log(`[Worker] Transcription successful for project ${projectId} (words: ${wordsRaw.length})`);
  } catch (err) {
    console.error(`[Worker] Transcription failed for project ${projectId}:`, err);
    await updateProjectStatus(projectId, 'FAILED', { error: err.message || 'Transcription failed' });
    process.exitCode = 1;
  } finally {
    if (fs.existsSync(inputPath)) {
      try { fs.unlinkSync(inputPath); } catch(e) {}
    }
  }
}

async function processRenderJob(jobId) {
  // 1. Atomic claim
  const { data: claimed } = await supabase
    .from('jobs')
    .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['QUEUED', 'FAILED'])
    .select();

  if (!claimed || claimed.length === 0) {
    console.log(`[Worker] Job ${jobId} is not QUEUED or already claimed.`);
    return;
  }

  const job = claimed[0];
  const { data: project } = await supabase.from('projects').select('video_id, videos!projects_video_id_fkey(storage_path)').eq('id', job.project_id).single();
  const b2Key = project?.videos?.storage_path || job.video_id;
  const inputFilename = path.basename(b2Key);
  const inputPath = path.join(uploadDir, inputFilename);
  const outputFilename = `captioned-${job.video_id}-${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, outputFilename);
  const outputB2Key = `outputs/${job.user_id}/${job.video_id}/${outputFilename}`;

  try {
    await updateJobState(jobId, 'PROCESSING', 10, 'Preparing video matrix');
    if (!fs.existsSync(inputPath)) {
      await storageProvider.downloadFile(b2Key, inputPath);
    }

    await updateJobState(jobId, 'RENDERING', 40, 'Speech cadence composition');
    const token = jwt.sign({ id: job.user_id }, JWT_SECRET, { expiresIn: '1h' });
    await renderVideo(inputPath, outputPath, job.segments, job.style, job.project_id, token, job.style?.resolution || 'original');

    await updateJobState(jobId, 'ENCODING', 90, `Uploading to storage`);
    await storageProvider.uploadFile(outputPath, outputB2Key);

    const user = await checkCredits(job.user_id);
    if (!user || user.credits < COST) {
      throw new Error('Insufficient credits at completion');
    }
    
    const downloadUrl = `/api/projects/${job.project_id}/download`;
    
    await supabase
      .from('jobs')
      .update({
        status: 'COMPLETED', progress: 100, message: 'Final 1080p MP4 encoding complete',
        output_filename: path.basename(outputPath), download_url: downloadUrl, updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
    await attachRenderJob(job.project_id, jobId, path.basename(outputPath), outputB2Key);
    await updateProjectStatus(job.project_id, 'COMPLETED');
    
    await deductCredits(job.user_id, COST);
    await incrementVideosUsed(job.user_id);
    console.log(`[Worker] Render successful for job ${jobId}`);
  } catch (err) {
    console.error(`[Worker] Render failed for job ${jobId}:`, err);
    await updateJobState(jobId, 'FAILED', 0, err.message || 'Render failed');
    await updateProjectStatus(job.project_id, 'FAILED', { error: err.message || 'Render failed' });
    process.exitCode = 1;
  } finally {
    if (fs.existsSync(inputPath)) try { fs.unlinkSync(inputPath); } catch(e) {}
    if (fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch(e) {}
  }
}

async function performSweep() {
  console.log('[Worker] Performing sweep of stale jobs...');
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  
  const { data: staleJobs } = await supabase
    .from('jobs')
    .update({ status: 'FAILED', message: 'Job timed out or worker crashed (GitHub Actions runner failure)' })
    .in('status', ['PROCESSING', 'RENDERING', 'ENCODING'])
    .lt('updated_at', fourHoursAgo)
    .select('id');
    
  if (staleJobs && staleJobs.length > 0) {
    console.log(`[Worker] Recovered ${staleJobs.length} stale render jobs to FAILED.`);
  }

  const { data: staleTranscriptions } = await supabase
    .from('projects')
    .update({ status: 'FAILED' })
    .eq('status', 'TRANSCRIBING')
    .lt('updated_at', fourHoursAgo)
    .select('id');

  if (staleTranscriptions && staleTranscriptions.length > 0) {
    console.log(`[Worker] Recovered ${staleTranscriptions.length} stale transcription projects to FAILED.`);
  }
}

async function start() {
  await storageProvider.init();
  
  const args = process.argv.slice(2);
  const idArgIndex = args.indexOf('--job-id');
  const typeArgIndex = args.indexOf('--type');
  
  if (idArgIndex === -1 || typeArgIndex === -1) {
    console.error('Usage: node github-worker.js --job-id <id> --type <render|transcribe>');
    process.exit(1);
  }
  
  const id = args[idArgIndex + 1];
  const type = args[typeArgIndex + 1];
  
  if (type === 'transcribe') {
    await processTranscription(id);
  } else if (type === 'render') {
    await processRenderJob(id);
  } else if (type === 'sweep') {
    await performSweep();
  } else {
    console.error('Invalid type. Must be "render", "transcribe", or "sweep"');
    process.exit(1);
  }

  // Ensure process exits even if daemon is running
  process.exit(0);
}

start().catch(err => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
