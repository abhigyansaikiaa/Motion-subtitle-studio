require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// --- Startup Validation ---
const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STORAGE_PROVIDER'];
for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`Missing required environment variable: ${env}`);
    process.exit(1);
  }
}
if (process.env.STORAGE_PROVIDER === 'b2') {
  const b2Env = ['B2_ENDPOINT', 'B2_REGION', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APPLICATION_KEY'];
  for (const env of b2Env) {
    if (!process.env[env]) {
      console.error(`Missing required B2 environment variable: ${env}`);
      process.exit(1);
    }
  }
}
// --------------------------

const { initDB, signup, login, authMiddleware } = require('./auth');
const { checkCredits, deductCredits, incrementVideosUsed } = require('./credits');
const { transcribeVideo } = require('./transcription');
const { renderVideo } = require('./render');

async function dispatchGitHubAction(jobId, type) {
  if (!process.env.GITHUB_PAT || !process.env.GITHUB_REPO) {
    console.warn('[API] GITHUB_PAT or GITHUB_REPO not set. Skipping GitHub Action trigger.');
    return;
  }
  
  try {
    // node-fetch v3 is ESM-only; require() returns the module object, not a callable.
    // Use the native global fetch (available since Node 18, which Render uses).
    if (typeof fetch !== 'function') {
      throw new Error('Native fetch is unavailable. Render runtime must be Node 18+.');
    }
    const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/media-worker.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${process.env.GITHUB_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_BRANCH || 'main',
        inputs: { jobId, type }
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[API] GitHub Action dispatch failed: ${response.status} ${errText}`);
    } else {
      console.log(`[API] Successfully dispatched GitHub Action for ${type} ${jobId}`);
    }
  } catch (err) {
    console.error(`[API] GitHub Action dispatch error:`, err);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    api: 'ok',
    supabase: !!process.env.SUPABASE_URL,
    b2: process.env.STORAGE_PROVIDER === 'b2' ? !!process.env.B2_ENDPOINT : 'N/A',
    storage: process.env.STORAGE_PROVIDER
  });
});

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigin = process.env.CLIENT_ORIGIN;
    // Allow if no origin (e.g. server-to-server), or matches CLIENT_ORIGIN, or is localhost for dev
    if (!origin || (allowedOrigin && origin === allowedOrigin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));
// Local uploads directory is no longer exposed publicly since media is behind authenticated proxy routes

const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storageProvider = require('./storage');
// Initialize storage provider (B2 or local)
storageProvider.init().catch(err => {
  console.error('Storage initialization failed:', err);
  process.exit(1);
});

initDB();

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

// ============ AUTH ============

app.post('/api/signup', (req, res) => {
  res.status(410).json({ error: 'Signup migrated to Supabase Auth' });
});

app.post('/api/login', (req, res) => {
  res.status(410).json({ error: 'Login migrated to Supabase Auth' });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const { supabase } = require('./supabase');
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('name, credits, videos_used')
      .eq('id', req.user.id)
      .single();
    
    if (error || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json({ 
      email: req.user.email, 
      name: profile.name, 
      credits: profile.credits 
    });
  } catch (err) {
    console.error('[API] /api/me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============ CAPTION STYLES ============



// ============ VIDEO PIPELINE ============

const { compose } = require('./engine/CompositionEngine');
const { assignEmphasis } = require('./engine/EmphasisEngine');
const { createWord } = require('./engine/CaptionModel');
const { getProject, createProject, updateProjectStatus, saveTranscript, getTranscript, saveComposition, attachRenderJob } = require('./engine/ProjectEngine');
const { getAllStyles } = require('./engine/StyleEngine');

// API: Get all available styles
app.get('/api/styles', (req, res) => {
  res.json({ styles: getAllStyles() });
});

// Step 1: Upload -> Create Project
app.post('/api/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video uploaded' });

    const videosUsed = req.user.videos_used || 0;
    if (videosUsed >= 3) {
      return res.status(403).json({ error: 'Video limit reached (3 videos max per account)' });
    }

    const aspectRatio = req.body.aspectRatio || '9:16';
    // Create the project (initially sets storage_path to the local filename)
    const project = await createProject(req.user.id, req.file.filename, aspectRatio);
    
    // Upload to selected storage provider
    const b2Key = `uploads/${req.user.id}/${project.videoUuid}/${req.file.filename}`;
    await storageProvider.uploadFile(req.file.path, b2Key);
    
    // Update the video with the persistent key
    const { updateVideoStoragePath } = require('./engine/ProjectEngine');
    await updateVideoStoragePath(project.videoUuid, b2Key);
    
    // Pass the storage key along to the transcription worker
    // Return the projectId immediately so frontend can trigger transcription
    res.json({ success: true, projectId: project.id, b2Key });
  } catch (err) {
    console.error('[API] /api/upload error:', err);
    // If B2 upload fails, do NOT delete the local file. Just return the error.
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Step 2: Trigger Transcription
app.post('/api/transcribe', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });

    // Duplicate transcription protection
    if (project.status === 'QUEUED_TRANSCRIPTION' || project.status === 'TRANSCRIBING') {
      return res.json({ success: true, projectId: project.id, status: project.status });
    }
    if (project.status === 'TRANSCRIBED' || project.status === 'READY_TO_EDIT' || project.status === 'COMPLETED') {
      return res.json({ success: true, projectId: project.id, status: project.status });
    }

    const b2Key = project.videoId;
    const inputFilename = path.basename(b2Key);
    const videoPath = path.join(uploadDir, inputFilename);

    // The Media Worker handles downloading the file. We just queue it.
    await updateProjectStatus(project.id, 'QUEUED_TRANSCRIPTION', { language: req.body.language });
    
    // Trigger GitHub Action
    await dispatchGitHubAction(project.id, 'transcribe');
    
    // The background transcription is now handled by the Media Worker.
    return res.json({ status: 'QUEUED_TRANSCRIPTION', projectId: project.id });
  } catch (err) {
    console.error('[API] /api/transcribe error:', err);
    res.status(500).json({ error: 'Failed to queue transcription' });
  }
});

// Step 4: Compose
app.post('/api/compose', authMiddleware, async (req, res) => {
  try {
    const { projectId, styleId } = req.body;
    
    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });
    
    const transcript = await getTranscript(projectId);
    if (!transcript) return res.status(400).json({ error: 'Transcript not found for this project' });
    
    // We no longer strictly validate against legacy STYLES dictionary here, 
    // because templates are now fully managed by the frontend templates.ts

    await updateProjectStatus(projectId, 'COMPOSING');

    // Run engine on the authoritative transcript
    const segments = compose(transcript.words, styleId);
    segments.forEach(seg => {
      const emphasis = assignEmphasis(seg);
      if (emphasis) {
        const targetWord = seg.words.find(w => w.id === emphasis.wordId);
        if (targetWord) targetWord.emphasis = emphasis.reason;
      }
    });

    await saveComposition(projectId, segments, styleId);
    await updateProjectStatus(projectId, 'READY_TO_EDIT');

    res.json({ success: true, project: await getProject(projectId) });
  } catch (err) {
    console.error('[API] /api/compose error:', err);
    await updateProjectStatus(req.body.projectId, 'FAILED', { error: 'Composition failed' });
    res.status(500).json({ error: 'Composition failed' });
  }
});

// Step 6: Render final captioned video
const { getJob, getActiveJobForUser, createJob, processJob, COST } = require('./engine/JobEngine');

app.post('/api/render', authMiddleware, async (req, res) => {
  try {
    const { projectId, template } = req.body;
    
    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });
    if (!project.segments || !template) return res.status(400).json({ error: 'Project is missing composition state or template' });

    const user = await checkCredits(req.user.id);
    if (user.credits < COST) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    const b2Key = project.videoId;
    const inputFilename = path.basename(b2Key);
    const inputPath = path.join(uploadDir, inputFilename);
    const outputFilename = `captioned-${project.videoUuid}-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);
    const outputB2Key = `outputs/${req.user.id}/${project.videoUuid}/${outputFilename}`;

    // The Media Worker handles downloading the file. We just queue it.

    let job = await getActiveJobForUser(req.user.id);
    if (job) {
      return res.json({ job }); // Already rendering
    }

    await updateProjectStatus(projectId, 'RENDERING', { customOverrides: JSON.stringify(template) });
    
    // We pass videoUuid to createJob instead of filename
    job = await createJob(req.user.id, projectId, project.videoUuid, project.segments, template);
    
    await attachRenderJob(projectId, job.id, null, null);
    
    // Trigger GitHub Action
    await dispatchGitHubAction(job.id, 'render');
    
    // The background rendering is now handled by the Media Worker.
    // The worker will claim this QUEUED job, process it, and update to COMPLETED.

    res.json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start render' });
  }
});

app.get('/api/jobs/active', authMiddleware, async (req, res) => {
  const job = await getActiveJobForUser(req.user.id);
  res.json({ job });
});

app.get('/api/jobs/:id', authMiddleware, async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job || job.userId !== req.user.id) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job });
});

app.get('/api/download/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

app.get('/api/projects', authMiddleware, async (req, res) => {
  const { getUserProjects } = require('./engine/ProjectEngine');
  const userProjects = await getUserProjects(req.user.id);
  res.json({ projects: userProjects });
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  const { getProject } = require('./engine/ProjectEngine');
  const project = await getProject(req.params.id);
  if (!project || project.userId !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json({ project });
});

app.get('/api/projects/:id/video', authMiddleware, async (req, res) => {
  const { getProject } = require('./engine/ProjectEngine');
  const project = await getProject(req.params.id);
  if (!project || project.userId !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }
  try {
    const b2Key = project.videoId; // This stores the actual storage_path/b2Key
    if (!b2Key) return res.status(404).json({ error: 'Video not found' });
    const url = await storageProvider.getPresignedUrl(b2Key, 3600);
    res.redirect(url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

app.get('/api/projects/:id/download', authMiddleware, async (req, res) => {
  const { getProject } = require('./engine/ProjectEngine');
  const project = await getProject(req.params.id);
  if (!project || project.userId !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }
  try {
    const b2Key = project.segments?._meta?.b2Key;
    if (!b2Key) return res.status(404).json({ error: 'Download not found' });
    const url = await storageProvider.getPresignedUrl(b2Key, 3600);
    res.redirect(url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

app.get('/api/local-storage/*', (req, res) => {
  if (storageProvider.type !== 'local') return res.status(404).end();
  let key = req.params[0];
  
  const token = req.query.sig;
  if (!token) return res.status(401).json({ error: 'Missing signature' });
  const localProvider = require('./storage/local');
  if (!localProvider.verifySignature(key, token)) {
    return res.status(403).json({ error: 'Invalid or expired signature' });
  }

  // Backward compatibility for old files that just had the filename
  if (!key.includes('/')) {
    key = 'uploads/' + key;
  }
  const filePath = path.join(__dirname, '..', key);
  
  // Prevent path traversal
  const resolvedPath = path.resolve(filePath);
  const rootPath = path.resolve(__dirname, '..');
  if (!resolvedPath.startsWith(rootPath)) {
     return res.status(403).json({ error: 'Invalid path' });
  }
  
  if (!fs.existsSync(resolvedPath)) return res.status(404).end();
  res.sendFile(resolvedPath);
});

app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  const { getProject } = require('./engine/ProjectEngine');
  const project = await getProject(req.params.id);
  if (!project || project.userId !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Cleanup files
  try {
    const inputPath = path.join(uploadDir, project.videoId);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (project.filename) {
      const outputPath = path.join(outputDir, project.filename);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
    // Also delete from DB
    const { supabase } = require('./supabase');
    await supabase.from('projects').delete().eq('id', req.params.id);
    // Associated videos, transcripts, and jobs should cascade or be handled, but
    // since we're using Supabase, we can just delete the project.
    res.json({ success: true });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ error: 'Failed to delete project files' });
  }
});

app.get('/api/credits', authMiddleware, async (req, res) => {
  res.json(await checkCredits(req.user.id));
});

// Periodic cleanup job (runs every hour)
setInterval(async () => {
  try {
    const { supabase } = require('./supabase');
    const now = new Date();
    now.setHours(now.getHours() - 2);
    
    const { data: expiredProjects } = await supabase
      .from('projects')
      .select('id, videos!projects_video_id_fkey(storage_path), segments')
      .lt('created_at', now.toISOString());

    if (expiredProjects && expiredProjects.length > 0) {
      expiredProjects.forEach(project => {
        // Cleanup files
        try {
          const videoId = project.videos?.storage_path;
          if (videoId) {
            const inputPath = path.join(uploadDir, videoId);
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          }
          
          let segmentsObj = project.segments || {};
          let filename = segmentsObj._meta ? segmentsObj._meta.filename : null;
          if (!filename && Array.isArray(segmentsObj)) filename = null; // fallback
          
          if (filename) {
            const outputPath = path.join(outputDir, filename);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          }
        } catch (e) {
          console.error('Auto-cleanup error for project', project.id, e);
        }
      });

      const expiredIds = expiredProjects.map(p => p.id);
      await supabase.from('projects').delete().in('id', expiredIds);
      console.log(`[CLEANUP] Removed ${expiredProjects.length} expired projects and their temporary files.`);
    }
  } catch (err) {
    console.error('Periodic cleanup error:', err);
  }
}, 60 * 60 * 1000); // 1 hour

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Caption app server running on port ${PORT} (0.0.0.0)`);
});

function gracefulShutdown(signal) {
  console.log(`\n[API] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[API] Closed out remaining connections.');
    process.exit(0);
  });
  
  // Force close after 10s
  setTimeout(() => {
    console.error('[API] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
