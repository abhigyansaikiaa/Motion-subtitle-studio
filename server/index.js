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
} else if (process.env.STORAGE_PROVIDER === 'r2') {
  const r2Env = ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  for (const env of r2Env) {
    if (!process.env[env]) {
      console.error(`Missing required R2 environment variable: ${env}`);
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

// --- Security hardening (server/security.js: no extra dependencies) ---
const { securityHeaders, rateLimit } = require('./security');
app.disable('x-powered-by'); // don't advertise the stack
app.use(securityHeaders);
// General API abuse dampening: 300 req/min per IP (polling loops stay well under)
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));
// Stricter cap on the expensive endpoints (transcode/render/upload are credit-gated too)
const heavyLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, message: 'Too many heavy requests, please slow down.' });
// NOTE: heavyLimiter is applied per-route (see /api/upload, /api/transcribe,
// /api/compose, /api/render below) rather than by path prefix, so that
// high-volume lightweight endpoints like /api/upload/multipart/part-url
// (one call per 10MB chunk) are NOT throttled by it.

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
app.use(express.json({ limit: '10mb' }));
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
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    // Only video uploads are legitimate here. Check both the client-declared
    // MIME type and the file extension — either alone can be spoofed, but
    // together they stop casual malicious uploads (scripts, HTML, zips).
    const allowedExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.3gp', '.mpeg', '.mpg'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mimeOk = (file.mimetype || '').startsWith('video/');
    if (mimeOk && allowedExts.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Only video files are accepted (mp4, mov, webm, mkv, avi).'));
  }
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
app.post('/api/upload', authMiddleware, heavyLimiter, upload.single('video'), async (req, res) => {
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

// Step 1a: Direct Upload - Get Presigned URL
app.post('/api/upload/presigned-url', authMiddleware, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    const videosUsed = req.user.videos_used || 0;
    if (videosUsed >= 3) {
      return res.status(403).json({ error: 'Video limit reached (3 videos max per account)' });
    }

    const { randomUUID } = require('crypto');
    const videoUuid = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `uploads/${req.user.id}/${videoUuid}/${safeFilename}`;
    
    const url = await storageProvider.getPresignedUploadUrl(key, contentType || 'application/octet-stream', 3600);
    
    res.json({ success: true, url, key, videoUuid, safeFilename });
  } catch (err) {
    console.error('[API] /api/upload/presigned-url error:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Step 1b: Direct Upload - Finalize
app.post('/api/upload/finalize', authMiddleware, async (req, res) => {
  try {
    const { key, videoUuid, filename, aspectRatio } = req.body;
    if (!key || !videoUuid || !filename) return res.status(400).json({ error: 'Missing required parameters' });
    
    // Create project using the specific videoUuid generated during presigned URL request
    const project = await createProject(req.user.id, key, aspectRatio || '9:16', videoUuid);
    
    res.json({ success: true, projectId: project.id, b2Key: key });
  } catch (err) {
    console.error('[API] /api/upload/finalize error:', err);
    res.status(500).json({ error: 'Failed to finalize upload' });
  }
});

// Step 1c: Multipart Direct Upload (large files) — browser uploads 10MB
// parts in parallel straight to R2; the server only signs URLs and completes.
// NOTE: part-url is intentionally NOT heavy-limited (one call per chunk).
app.post('/api/upload/multipart/init', authMiddleware, async (req, res) => {
  try {
    if (!storageProvider.supportsMultipart()) {
      return res.status(501).json({ error: 'Multipart upload not supported by storage provider' });
    }
    const { filename, contentType } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    const videosUsed = req.user.videos_used || 0;
    if (videosUsed >= 3) {
      return res.status(403).json({ error: 'Video limit reached (3 videos max per account)' });
    }

    const { randomUUID } = require('crypto');
    const videoUuid = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `uploads/${req.user.id}/${videoUuid}/${safeFilename}`;

    const uploadId = await storageProvider.createMultipartUpload(key, contentType || 'application/octet-stream');
    res.json({ success: true, key, videoUuid, safeFilename, uploadId });
  } catch (err) {
    console.error('[API] /api/upload/multipart/init error:', err);
    res.status(500).json({ error: 'Failed to start multipart upload' });
  }
});

app.post('/api/upload/multipart/part-url', authMiddleware, async (req, res) => {
  try {
    const { key, uploadId, partNumber } = req.body;
    if (!key || !uploadId || partNumber == null) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const n = parseInt(partNumber, 10);
    if (!Number.isInteger(n) || n < 1 || n > 10000) {
      return res.status(400).json({ error: 'Invalid part number' });
    }
    // Constrain the key to this user's own upload namespace.
    if (!key.startsWith(`uploads/${req.user.id}/`)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const url = await storageProvider.getMultipartPartUploadUrl(key, uploadId, n, 3600);
    res.json({ success: true, url });
  } catch (err) {
    console.error('[API] /api/upload/multipart/part-url error:', err);
    res.status(500).json({ error: 'Failed to sign part URL' });
  }
});

app.post('/api/upload/multipart/complete', authMiddleware, async (req, res) => {
  try {
    const { key, uploadId } = req.body;
    if (!key || !uploadId) return res.status(400).json({ error: 'Missing required parameters' });
    if (!key.startsWith(`uploads/${req.user.id}/`)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await storageProvider.completeMultipartUpload(key, uploadId);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] /api/upload/multipart/complete error:', err);
    res.status(500).json({ error: 'Failed to complete multipart upload' });
  }
});

app.post('/api/upload/multipart/abort', authMiddleware, async (req, res) => {
  try {
    const { key, uploadId } = req.body;
    if (!key || !uploadId) return res.status(400).json({ error: 'Missing required parameters' });
    if (!key.startsWith(`uploads/${req.user.id}/`)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await storageProvider.abortMultipartUpload(key, uploadId);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] /api/upload/multipart/abort error:', err);
    res.status(500).json({ error: 'Failed to abort multipart upload' });
  }
});

// Step 2: Trigger Transcription
app.post('/api/transcribe', authMiddleware, heavyLimiter, async (req, res) => {
  try {
    const { projectId, force } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });

    // Duplicate transcription protection — unless the user explicitly forces a
    // retry. A row wedged in TRANSCRIBING/QUEUED_RENDER_TRANS by a dead worker
    // would otherwise be un-retryable from the UI (the early return below
    // treats it as "already in progress" forever).
    if (!force) {
      if (project.status === 'QUEUED_RENDER_TRANS' || project.status === 'TRANSCRIBING') {
        return res.json({ success: true, projectId: project.id, status: project.status });
      }
      if (project.status === 'TRANSCRIBED' || project.status === 'READY_TO_EDIT' || project.status === 'COMPLETED') {
        return res.json({ success: true, projectId: project.id, status: project.status });
      }
    } else {
      console.log(`[API] /api/transcribe force-retry: resetting project ${project.id} from ${project.status} to QUEUED_RENDER_TRANS`);
    }

    const language = req.body.language || null;

    // Delegate transcription to the HF Python Worker polling for QUEUED_RENDER_TRANS
    await updateProjectStatus(project.id, 'QUEUED_RENDER_TRANS', { language });
    res.json({ status: 'QUEUED_RENDER_TRANS', projectId: project.id });

    // Wake up the HF Space if a URL is provided
    const hfWorkerUrl = process.env.HF_TRANSCRIPTION_WORKER_URL;
    if (!hfWorkerUrl) {
      console.warn('[HF WAKE] HF_TRANSCRIPTION_WORKER_URL is not set — sleeping workers will NOT be woken; queued transcriptions may stall until the worker polls.');
    } else {
      setImmediate(() => {
        console.log(`[HF WAKE] ping requested`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        fetch(`${hfWorkerUrl.replace(/\/$/, '')}/health`, { 
          method: 'GET',
          signal: controller.signal 
        })
          .then(res => {
            clearTimeout(timeoutId);
            if (res.ok) {
              console.log(`[HF WAKE] ping succeeded`);
            } else {
              console.log(`[HF WAKE] ping returned non-200 status: ${res.status}`);
            }
          })
          .catch(err => {
            clearTimeout(timeoutId);
            console.log(`[HF WAKE] ping failed: ${err.message}`);
          });
      });
    }
  } catch (err) {
    console.error('[API] /api/transcribe error:', err);
    res.status(500).json({ error: 'Failed to queue transcription' });
  }
});


// Step 4: Compose
app.post('/api/compose', authMiddleware, heavyLimiter, async (req, res) => {
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

app.post('/api/render', authMiddleware, heavyLimiter, async (req, res) => {
  try {
    const { projectId, template, resolution = 'original', segments: bodySegments } = req.body;
    
    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });
    // Prefer the freshly-edited segments sent by the client (word-editor edits
    // live only in frontend state) over the copy stored at transcription time.
    const segments = (Array.isArray(bodySegments) && bodySegments.length > 0)
      ? bodySegments
      : project.segments;
    if (!segments || !template) return res.status(400).json({ error: 'Project is missing composition state or template' });

    template.resolution = resolution;

    const user = await checkCredits(req.user.id);
    const CREDITS_ENABLED = process.env.CREDITS_ENABLED === 'true';
    if (CREDITS_ENABLED && user.credits < COST) {
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

    // Persist the edited segments so the project, the job row, and the worker
    // all render the same (edited) captions.
    try {
      const { saveComposition } = require('./engine/ProjectEngine');
      await saveComposition(projectId, segments, template.id || template.styleId || 'custom');
    } catch (saveErr) {
      console.warn('[API] saveComposition before render failed (continuing with job segments):', saveErr.message);
    }
    
    // We pass videoUuid to createJob instead of filename
    job = await createJob(req.user.id, projectId, project.videoUuid, segments, template);
    
    await attachRenderJob(projectId, job.id, null, null);
    
    // The background rendering is now handled by the HF Node Worker.
    // The worker will claim this QUEUED job, process it, and update to COMPLETED.
    
    // Wake up the HF Space if a URL is provided
    const hfRenderWorkerUrl = process.env.HF_RENDER_WORKER_URL;
    if (hfRenderWorkerUrl) {
      setImmediate(() => {
        console.log(`[HF RENDER WAKE] ping requested`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        fetch(`${hfRenderWorkerUrl.replace(/\/$/, '')}/health`, { 
          method: 'GET',
          signal: controller.signal 
        })
          .then(res => {
            clearTimeout(timeoutId);
            if (res.ok) {
              console.log(`[HF RENDER WAKE] ping succeeded`);
            } else {
              console.log(`[HF RENDER WAKE] ping returned non-200 status: ${res.status}`);
            }
          })
          .catch(err => {
            clearTimeout(timeoutId);
            console.log(`[HF RENDER WAKE] ping failed: ${err.message}`);
          });
      });
    }

    // FALLBACK: if the HF worker hasn't claimed the job within 45s (service
    // down, asleep, or URL not configured), dispatch the GitHub Actions backup
    // renderer. Both workers claim atomically (status must be QUEUED), so at
    // most one of them ever processes the job. No-op unless GITHUB_PAT and
    // GITHUB_REPO are configured.
    const fallbackJobId = job.id;
    setTimeout(async () => {
      try {
        const { supabase: sb } = require('./supabase');
        const { data: j } = await sb.from('jobs').select('status').eq('id', fallbackJobId).single();
        if (j && j.status === 'QUEUED') {
          if (!process.env.GITHUB_PAT || !process.env.GITHUB_REPO) {
            // Honest failure: the primary worker never claimed the job and the
            // backup renderer isn't configured — tell the user exactly what to
            // fix instead of spinning forever.
            console.warn(`[RENDER FALLBACK] job ${fallbackJobId} still QUEUED after 45s; GITHUB_PAT/GITHUB_REPO not set — marking FAILED`);
            await sb.from('jobs').update({
              status: 'FAILED',
              message: 'Render worker is offline and the backup renderer is not configured. Set GITHUB_PAT and GITHUB_REPO in the backend env, or deploy the render worker, then retry.',
              updated_at: new Date().toISOString()
            }).eq('id', fallbackJobId);
            return;
          }
          console.log(`[RENDER FALLBACK] job ${fallbackJobId} still QUEUED after 45s — dispatching GitHub Action backup`);
          await sb.from('jobs').update({
            message: 'Primary render worker unreachable — starting backup renderer (takes a few minutes)…',
            updated_at: new Date().toISOString()
          }).eq('id', fallbackJobId);
          await dispatchGitHubAction(fallbackJobId, 'render');
        }
      } catch (e) {
        console.error('[RENDER FALLBACK] check failed:', e.message);
      }
    }, 45000).unref();

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

// Reports whether the backend can actually render a video right now, so the
// frontend can warn BEFORE the user waits 45s for a job that can never run.
// - hfWorker: HF_RENDER_WORKER_URL is configured (primary renderer)
// - githubBackup: GITHUB_PAT + GITHUB_REPO are configured (45s backup renderer)
app.get('/api/render/status', authMiddleware, async (req, res) => {
  const hfWorker = !!process.env.HF_RENDER_WORKER_URL;
  const githubBackup = !!(process.env.GITHUB_PAT && process.env.GITHUB_REPO);
  res.json({
    canRender: hfWorker || githubBackup,
    hfWorker,
    githubBackup,
    message: hfWorker
      ? 'Render worker is configured.'
      : githubBackup
        ? 'Backup renderer (GitHub Actions) is configured — export takes a few minutes.'
        : 'No render worker configured. Set HF_RENDER_WORKER_URL or GITHUB_PAT + GITHUB_REPO in the backend environment, then retry.'
  });
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
    const b2Key = project.videoId;
    if (!b2Key) return res.status(404).json({ error: 'Video not found' });

    // FAST PATH: If the backend is running locally, or if the file was just uploaded
    // and still exists on the ephemeral disk, serve it directly to avoid B2 Class B transaction costs!
    const localFilename = b2Key.split('/').pop();
    const localPath = require('path').join(__dirname, 'uploads', localFilename);
    if (require('fs').existsSync(localPath)) {
      // res.sendFile automatically handles HTTP Range requests and CORS headers correctly
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(localPath);
    }

    // NOTE: Proxying the stream through the server instead of redirecting to B2/R2.
    // This is required because:
    //   1. The <video crossOrigin="anonymous"> needs the response to come from
    //      the same origin (Render) so the browser can draw it to a canvas
    //      for the behind-subject segmentation feature.
    //   2. If we redirect to R2, we hit bucket CORS policy issues. Proxying guarantees CORS headers.
    
    const range = req.headers.range;
    const { stream, contentLength, contentType, contentRange, acceptRanges } = await storageProvider.getStream(b2Key, range);

    // Provide default mime type if provider doesn't have it
    const ext = b2Key.split('.').pop().toLowerCase();
    const mime = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';

    res.setHeader('Accept-Ranges', acceptRanges || 'bytes');
    res.setHeader('Content-Type', contentType || mime);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    if (range && contentRange) {
      res.setHeader('Content-Range', contentRange);
      res.status(206);
    } else {
      res.status(200);
    }

    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[video proxy] stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});


app.get('/api/projects/:id/download', authMiddleware, async (req, res) => {
  const { supabase } = require('./supabase');
  const { data: rawProject, error } = await supabase
    .from('projects')
    .select('segments, user_id')
    .eq('id', req.params.id)
    .single();

  if (error || !rawProject || rawProject.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    let meta = {};
    if (rawProject.segments && typeof rawProject.segments === 'object' && !Array.isArray(rawProject.segments) && rawProject.segments._meta) {
      meta = rawProject.segments._meta;
    } else if (rawProject.segments && rawProject.segments.hasOwnProperty('_meta')) {
      meta = rawProject.segments._meta;
    }

    const b2Key = meta.b2Key;
    if (!b2Key) return res.status(404).json({ error: 'Download not found' });
    
    const originalFilename = rawProject.segments?._meta?.originalFilename || 'download.mp4';
    const url = await storageProvider.getPresignedUrl(b2Key, 3600, originalFilename);
    res.json({ url });
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
    const storageProvider = require('./storage');
    const now = new Date();
    // 24 hours retention window for videos before expiration
    now.setHours(now.getHours() - 24);
    
    // Find all old projects that are not already marked EXPIRED
    const { data: expiredProjects } = await supabase
      .from('projects')
      .select('id, status, videos!projects_video_id_fkey(storage_path), segments')
      .lt('created_at', now.toISOString())
      .neq('status', 'EXPIRED');

    if (expiredProjects && expiredProjects.length > 0) {
      for (const project of expiredProjects) {
        // 1. Cleanup R2 source and local temporary files
        try {
          const videoId = project.videos?.storage_path; // This is the b2Key for source
          if (videoId) {
            const inputPath = path.join(uploadDir, videoId);
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            
            // Delete source from R2 (Requirement #3)
            await storageProvider.deleteFile(videoId).catch(e => {
              console.error(`Failed to delete R2 source ${videoId}:`, e.message);
            });
          }
          
          // 2. Cleanup R2 output and local temporary files
          let segmentsObj = project.segments || {};
          let filename = segmentsObj._meta ? segmentsObj._meta.filename : null;
          if (!filename && Array.isArray(segmentsObj)) filename = null; // fallback
          
          if (filename) {
            const outputPath = path.join(outputDir, filename);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            
            // The output B2 key is stored in segments._meta.outputB2Key if attached.
            // Let's check if outputB2Key exists. If so, delete it from R2 (Requirement #4).
            const outputB2Key = segmentsObj._meta ? segmentsObj._meta.outputB2Key : null;
            if (outputB2Key) {
              await storageProvider.deleteFile(outputB2Key).catch(e => {
                console.error(`Failed to delete R2 output ${outputB2Key}:`, e.message);
              });
            }
          }
        } catch (e) {
          console.error('Auto-cleanup error for project', project.id, e);
        }
      }

      // Mark projects as EXPIRED without deleting DB metadata (Requirement #13)
      const expiredIds = expiredProjects.map(p => p.id);
      await supabase.from('projects').update({ status: 'EXPIRED' }).in('id', expiredIds);
      console.log(`[CLEANUP] Marked ${expiredProjects.length} projects as EXPIRED and cleaned up their temporary R2 media.`);
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
