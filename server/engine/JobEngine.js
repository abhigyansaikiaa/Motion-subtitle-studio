const { db } = require('../auth');
const { deductCredits, incrementVideosUsed } = require('../credits');
const { renderVideo } = require('../render');
const path = require('path');
const fs = require('fs');

const COST = 100;

/**
 * 1. createJob(userId, projectId, videoId, segments, style)
 * 2. beginProcessing(jobId, inputPath, outputPath)
 */

function getJob(jobId) {
  const data = db.get();
  return data.jobs.find(j => j.id === jobId) || null;
}

function getActiveJobForUser(userId) {
  const data = db.get();
  return data.jobs.find(j => j.userId === userId && !['COMPLETED', 'FAILED'].includes(j.status)) || null;
}

function createJob(userId, projectId, videoId, segments, style) {
  const data = db.get();
  
  // Prevent duplicate active jobs for the same user
  const existing = data.jobs.find(j => j.userId === userId && !['COMPLETED', 'FAILED'].includes(j.status));
  if (existing) {
    return existing; // Return existing instead of throwing, or let the caller decide
  }

  const job = {
    id: 'job_' + Date.now() + Math.random().toString(36).substr(2, 5),
    userId,
    projectId,
    videoId,
    segments,
    style,
    status: 'QUEUED',
    progress: 0,
    message: 'Job queued...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.jobs.push(job);
  db.save(data);
  return job;
}

function updateJobState(jobId, status, progress, message) {
  const data = db.get();
  const job = data.jobs.find(j => j.id === jobId);
  if (job) {
    job.status = status;
    job.progress = progress;
    job.message = message;
    job.updatedAt = new Date().toISOString();
    db.save(data);
  }
}

// Background processing worker
async function processJob(jobId, inputPath, outputPath) {
  const data = db.get();
  const job = data.jobs.find(j => j.id === jobId);
  if (!job) return;

  try {
    updateJobState(jobId, 'PROCESSING', 10, 'Preparing video matrix');
    
    // Simulate some stages since renderVideo handles everything internally right now
    setTimeout(() => updateJobState(jobId, 'RENDERING', 40, 'Speech cadence composition'), 1000);
    setTimeout(() => updateJobState(jobId, 'ENCODING', 70, `Rendering ${job.style} animation`), 3000);

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production-make-it-long-and-random';
    const token = jwt.sign({ id: job.userId }, JWT_SECRET, { expiresIn: '1h' });

    await renderVideo(inputPath, outputPath, job.segments, job.style, job.projectId, token);

    // After success, atomically deduct credits
    const latestData = db.get();
    const user = latestData.users.find(u => u.id === job.userId);
    if (!user || user.credits < COST) {
      throw new Error('Insufficient credits at completion');
    }
    
    user.credits -= COST;
    user.videos_used += 1;
    
    const finalJob = latestData.jobs.find(j => j.id === jobId);
    if (finalJob) {
      const downloadUrl = `/api/download/${path.basename(outputPath)}`;
      finalJob.status = 'COMPLETED';
      finalJob.progress = 100;
      finalJob.message = 'Final 1080p MP4 encoding complete';
      finalJob.outputFilename = path.basename(outputPath);
      finalJob.downloadUrl = downloadUrl;
      finalJob.updatedAt = new Date().toISOString();
      db.save(latestData);
      
      const { updateProjectStatus } = require('./ProjectEngine');
      updateProjectStatus(job.projectId, 'COMPLETED', {
        filename: path.basename(outputPath),
        downloadUrl
      });
    }

  } catch (err) {
    console.error('Job failed:', err);
    updateJobState(jobId, 'FAILED', 0, err.message || 'Render failed');
    const { updateProjectStatus } = require('./ProjectEngine');
    updateProjectStatus(job.projectId, 'FAILED', { error: err.message || 'Render failed' });
  }
}

module.exports = {
  getJob,
  getActiveJobForUser,
  createJob,
  processJob,
  COST
};
