const { supabase } = require('../supabase');
const { deductCredits, incrementVideosUsed } = require('../credits');
const { renderVideo } = require('../render');
const path = require('path');
const fs = require('fs');

const COST = 100;

async function getJob(jobId) {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) return null;
  return formatJobInfo(job);
}

async function getActiveJobForUser(userId) {
  // Query jobs where status is not COMPLETED or FAILED
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .not('status', 'in', '("COMPLETED","FAILED")')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !jobs || jobs.length === 0) return null;
  return formatJobInfo(jobs[0]);
}

function formatJobInfo(j) {
  return {
    id: j.id,
    userId: j.user_id,
    projectId: j.project_id,
    videoId: j.video_id,
    segments: j.segments,
    style: j.style,
    status: j.status,
    progress: j.progress,
    message: j.message,
    outputFilename: j.output_filename,
    downloadUrl: j.download_url,
    createdAt: j.created_at,
    updatedAt: j.updated_at
  };
}

async function createJob(userId, projectId, videoUuid, segments, style) {
  // Check if existing active job
  const existing = await getActiveJobForUser(userId);
  if (existing) {
    return existing;
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      user_id: userId,
      project_id: projectId,
      video_id: videoUuid,
      segments: segments,
      style: style,
      status: 'QUEUED',
      progress: 0,
      message: 'Job queued...'
    })
    .select()
    .single();

  if (error || !job) throw new Error('Failed to create job');
  return formatJobInfo(job);
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

// Background processing worker
async function processJob(jobId, inputPath, outputPath, outputB2Key) {
  const job = await getJob(jobId);
  if (!job) return;

  try {
    await updateJobState(jobId, 'PROCESSING', 10, 'Preparing video matrix');
    
    // Simulate stages (in background, non-blocking)
    setTimeout(() => updateJobState(jobId, 'RENDERING', 40, 'Speech cadence composition'), 1000);
    setTimeout(() => updateJobState(jobId, 'ENCODING', 70, `Rendering ${job.style} animation`), 3000);

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = require('../security').getSecret('JWT_SECRET');
    const token = jwt.sign({ id: job.userId }, JWT_SECRET, { expiresIn: '1h' });

    await renderVideo(inputPath, outputPath, job.segments, job.style, job.projectId, token);

    // Upload output to B2
    const storageProvider = require('../storage');
    await storageProvider.uploadFile(outputPath, outputB2Key);

    // After success, atomically deduct credits
    const { checkCredits, deductCredits, incrementVideosUsed } = require('../credits');
    const user = await checkCredits(job.userId);
    const CREDITS_ENABLED = process.env.CREDITS_ENABLED === 'true';
    if (CREDITS_ENABLED && (!user || user.credits < COST)) {
      throw new Error('Insufficient credits at completion');
    }
    
    if (CREDITS_ENABLED) {
      await deductCredits(job.userId, COST);
    }
    await incrementVideosUsed(job.userId);
    
    const downloadUrl = `/api/projects/${job.projectId}/download`;
    
    // Update job to COMPLETED
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
      
    const { attachRenderJob, updateProjectStatus } = require('./ProjectEngine');
    await attachRenderJob(job.projectId, jobId, path.basename(outputPath), outputB2Key);
    await updateProjectStatus(job.projectId, 'COMPLETED');

    // Clean up local temp files after successful upload
    const fs = require('fs');
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  } catch (err) {
    console.error('Job failed:', err);
    await updateJobState(jobId, 'FAILED', 0, err.message || 'Render failed');
    const { updateProjectStatus } = require('./ProjectEngine');
    await updateProjectStatus(job.projectId, 'FAILED', { error: err.message || 'Render failed' });
  }
}

module.exports = {
  getJob,
  getActiveJobForUser,
  createJob,
  processJob,
  COST
};
