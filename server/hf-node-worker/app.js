require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const { renderVideo } = require('../render');
const { updateProjectStatus, attachRenderJob } = require('../engine/ProjectEngine');
const { checkCredits, deductCredits, incrementVideosUsed } = require('../credits');
const storageProvider = require('../storage');
const { supabase } = require('../supabase');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const COST = 1;

if (!supabaseUrl || !supabaseKey) {
  console.error('[HF-Node-Worker] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

const uploadDir = path.join(__dirname, '..', 'uploads');
const outputDir = path.join(__dirname, '..', 'outputs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function updateJobState(jobId, status, progress, message) {
  await supabase
    .from('jobs')
    .update({ status, progress, message, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

async function processJob(job) {
  const jobId = job.id;
  const inputPath = path.join(uploadDir, `hf-${jobId}-in.mp4`);
  const outputPath = path.join(outputDir, `hf-${jobId}-out.mp4`);
  
  try {
    const { data: claimData, error: claimErr } = await supabase
      .from('jobs')
      .update({ status: 'PROCESSING', message: 'Job claimed by HF Node Worker', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'QUEUED')
      .select();

    if (!claimData || claimData.length === 0) {
      console.log(`[HF-Node-Worker] Job ${jobId} already claimed by another worker.`);
      return;
    }
    
    // We must query project to get the video b2Key correctly
    const { data: project } = await supabase.from('projects').select('video_id, videos!projects_video_id_fkey(storage_path)').eq('id', job.project_id).single();
    const b2Key = project?.videos?.storage_path || job.video_id;
    const outputB2Key = `outputs/${job.user_id}/${job.project_id}/${Date.now()}-rendered.mp4`;

    console.log(`[HF-Node-Worker] Processing job ${jobId}`);
    
    await updateJobState(jobId, 'PROCESSING', 10, 'Downloading media...');
    if (!b2Key) throw new Error('No valid video storage key found');
    await storageProvider.downloadFile(b2Key, inputPath);

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
    console.log(`[HF-Node-Worker] Render successful for job ${jobId}`);

  } catch (err) {
    console.log(`[HF-Node-Worker] Render failed for job ${jobId}:`, err);
    await updateJobState(jobId, 'FAILED', 0, err.message || 'Render failed');
    await updateProjectStatus(job.project_id, 'FAILED', { error: err.message || 'Render failed' });
  } finally {
    if (fs.existsSync(inputPath)) try { fs.unlinkSync(inputPath); } catch(e) {}
    if (fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch(e) {}
  }
}

async function pollingDaemon() {
  console.log('[HF-Node-Worker] Polling daemon started.');
  while (true) {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'QUEUED');
        
      if (data && data.length > 0) {
        // Process sequentially
        for (const job of data) {
          await processJob(job);
        }
      }
    } catch (err) {
      console.error('[HF-Node-Worker] Polling error:', err);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// Start API server for health checks
const app = express();
app.get('/', (req, res) => res.json({ status: 'ok', worker: 'HF-Node-Render' }));
app.get('/health', (req, res) => res.json({ status: 'healthy' }));

const port = process.env.PORT || 7860;
app.listen(port, async () => {
  console.log(`[HF-Node-Worker] HTTP keep-alive server listening on port ${port}`);
  try {
    await storageProvider.init();
    console.log('[HF-Node-Worker] Storage provider initialized');
  } catch (e) {
    console.error('[HF-Node-Worker] Failed to init storage:', e);
  }
  pollingDaemon();
});
