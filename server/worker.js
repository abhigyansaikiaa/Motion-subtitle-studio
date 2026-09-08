require('dotenv').config();
const { supabase } = require('./supabase');
const fs = require('fs');
const path = require('path');
const storageProvider = require('./storage');
const { transcribeVideo } = require('./transcription');
const { saveTranscript, updateProjectStatus, attachRenderJob } = require('./engine/ProjectEngine');
const { getJob, COST } = require('./engine/JobEngine');
const { renderVideo } = require('./render');
const { checkCredits, deductCredits, incrementVideosUsed } = require('./credits');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production-make-it-long-and-random';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);
const POLL_INTERVAL = 3000;
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Track active jobs
let activeJobsCount = 0;

function createWordLocal(id, word, start, end) {
  return {
    id,
    word,
    start,
    end,
    styles: {
      color: '#ffffff',
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      textShadow: '2px 2px 0px #000000',
      y: 80
    }
  };
}

async function updateJobState(jobId, status, progress, message) {
  await supabase
    .from('jobs')
    .update({
      status,
      progress,
      message,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

async function processTranscription(project) {
  const projectId = project.id;
  const b2Key = project.videos?.storage_path || project.video_id; // backward compat
  const inputFilename = path.basename(b2Key);
  const inputPath = path.join(uploadDir, inputFilename);
  const language = project.segments?._meta?.language || 'auto';

  try {
    // 1. Download
    if (!fs.existsSync(inputPath)) {
      await storageProvider.downloadFile(b2Key, inputPath);
    }

    // 2. Transcribe
    const rawSegments = await transcribeVideo(inputPath, language);
    
    let wordsRaw = [];
    let wordId = 0;
    rawSegments.forEach(seg => {
      seg.words.forEach(w => {
        wordsRaw.push(createWordLocal(`w${wordId++}`, w.word, w.start, w.end));
      });
    });

    // 3. Save transcript and update status
    await saveTranscript(projectId, wordsRaw);
    await updateProjectStatus(projectId, 'TRANSCRIBED', { duration: rawSegments.length ? rawSegments[rawSegments.length - 1].end : 0 });

  } catch (err) {
    console.error(`Transcription failed for project ${projectId}:`, err);
    await updateProjectStatus(projectId, 'FAILED', { error: err.message || 'Transcription failed' });
  } finally {
    if (fs.existsSync(inputPath)) {
      try { fs.unlinkSync(inputPath); } catch(e) {}
    }
  }
}

async function processRenderJob(job) {
  const jobId = job.id;
  
  // Need to get project for b2Key
  const { data: project } = await supabase.from('projects').select('video_id, videos(storage_path)').eq('id', job.project_id).single();
  
  const b2Key = project?.videos?.storage_path || job.video_id;
  const inputFilename = path.basename(b2Key);
  const inputPath = path.join(uploadDir, inputFilename);
  const outputFilename = `captioned-${job.video_id}-${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, outputFilename);
  const outputB2Key = `outputs/${job.user_id}/${job.video_id}/${outputFilename}`;

  try {
    await updateJobState(jobId, 'PROCESSING', 10, 'Preparing video matrix');
    
    // 1. Download
    if (!fs.existsSync(inputPath)) {
      await storageProvider.downloadFile(b2Key, inputPath);
    }

    // 2. Render
    await updateJobState(jobId, 'RENDERING', 40, 'Speech cadence composition');
    const token = jwt.sign({ id: job.user_id }, JWT_SECRET, { expiresIn: '1h' });
    await renderVideo(inputPath, outputPath, job.segments, job.style, job.project_id, token);

    // 3. Upload to B2
    await updateJobState(jobId, 'ENCODING', 90, `Uploading to storage`);
    await storageProvider.uploadFile(outputPath, outputB2Key);

    // 4. Atomic Credits (JobEngine logic preserved)
    const user = await checkCredits(job.user_id);
    if (!user || user.credits < COST) {
      throw new Error('Insufficient credits at completion');
    }
    
    await deductCredits(job.user_id, COST);
    await incrementVideosUsed(job.user_id);
    
    const downloadUrl = `/api/projects/${job.project_id}/download`;
    
    // 5. Mark COMPLETED
    await supabase
      .from('jobs')
      .update({
        status: 'COMPLETED',
        progress: 100,
        message: 'Final 1080p MP4 encoding complete',
        output_filename: path.basename(outputPath),
        download_url: downloadUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
    await attachRenderJob(job.project_id, jobId, path.basename(outputPath), outputB2Key);
    await updateProjectStatus(job.project_id, 'COMPLETED');

  } catch (err) {
    console.error(`Render failed for job ${jobId}:`, err);
    await updateJobState(jobId, 'FAILED', 0, err.message || 'Render failed');
    await updateProjectStatus(job.project_id, 'FAILED', { error: err.message || 'Render failed' });
  } finally {
    if (fs.existsSync(inputPath)) {
      try { fs.unlinkSync(inputPath); } catch(e) {}
    }
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch(e) {}
    }
  }
}

async function claimAndProcess() {
  if (activeJobsCount >= WORKER_CONCURRENCY) {
    return;
  }

  // 1. Try to claim a render job first (higher priority, consumes credits)
  const { data: pendingJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'QUEUED')
    .order('created_at', { ascending: true })
    .limit(1);

  if (pendingJobs && pendingJobs.length > 0) {
    const job = pendingJobs[0];
    
    // Atomic claim
    const { data: claimed } = await supabase
      .from('jobs')
      .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'QUEUED')
      .select();

    if (claimed && claimed.length > 0) {
      activeJobsCount++;
      console.log(`[Worker] Claimed Render Job ${job.id}`);
      processRenderJob(claimed[0]).finally(() => {
        activeJobsCount--;
        console.log(`[Worker] Finished Render Job ${job.id}`);
      });
      return; // Return immediately to allow concurrent claims up to limit
    }
  }

  // 2. Try to claim a transcription task
  const { data: pendingProjects } = await supabase
    .from('projects')
    .select('*, videos(storage_path)')
    .eq('status', 'QUEUED_TRANSCRIPTION')
    .order('created_at', { ascending: true })
    .limit(1);

  if (pendingProjects && pendingProjects.length > 0) {
    const project = pendingProjects[0];

    // Atomic claim
    const { data: claimed } = await supabase
      .from('projects')
      .update({ status: 'TRANSCRIBING', updated_at: new Date().toISOString() })
      .eq('id', project.id)
      .eq('status', 'QUEUED_TRANSCRIPTION')
      .select();

    if (claimed && claimed.length > 0) {
      activeJobsCount++;
      console.log(`[Worker] Claimed Transcription for Project ${project.id}`);
      processTranscription(project).finally(() => {
        activeJobsCount--;
        console.log(`[Worker] Finished Transcription for Project ${project.id}`);
      });
      return;
    }
  }
}

async function startWorker() {
  await storageProvider.init();
  console.log(`[Worker] Started. Concurrency: ${WORKER_CONCURRENCY}`);
  
  // Stale Job Recovery (Runs occasionally)
  setInterval(async () => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      // Recover stale render jobs
      const { data: staleJobs } = await supabase
        .from('jobs')
        .update({ status: 'FAILED', message: 'Job timed out or worker crashed' })
        .in('status', ['PROCESSING', 'RENDERING', 'ENCODING'])
        .lt('updated_at', tenMinutesAgo)
        .select('id');
        
      if (staleJobs && staleJobs.length > 0) {
        console.log(`[Worker] Recovered ${staleJobs.length} stale render jobs to FAILED.`);
      }

      // Recover stale transcription jobs
      const { data: staleTranscriptions } = await supabase
        .from('projects')
        .update({ status: 'FAILED' })
        .eq('status', 'TRANSCRIBING')
        .lt('updated_at', tenMinutesAgo)
        .select('id');

      if (staleTranscriptions && staleTranscriptions.length > 0) {
        console.log(`[Worker] Recovered ${staleTranscriptions.length} stale transcription projects to FAILED.`);
      }
    } catch (e) {
      console.error('[Worker] Error during stale job recovery:', e);
    }
  }, 60000); // Check every minute

  // Main polling loop
  setInterval(() => {
    claimAndProcess().catch(err => console.error('[Worker] Polling error:', err));
  }, POLL_INTERVAL);
}

startWorker();
