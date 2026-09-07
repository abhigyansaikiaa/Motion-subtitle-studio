const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { initDB, signup, login, authMiddleware } = require('./auth');
const { checkCredits, deductCredits, incrementVideosUsed } = require('./credits');
const { transcribeVideo } = require('./transcription');
const { renderVideo } = require('./render');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

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

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await signup(email, password, name);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/me', authMiddleware, (req, res) => {
  const fresh = checkCredits(req.user.id);
  res.json({ email: req.user.email, name: req.user.name, credits: fresh.credits });
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
    // Create the project
    const project = createProject(req.user.id, req.file.filename, aspectRatio);
    
    // Return the projectId immediately so frontend can trigger transcription
    res.json({ success: true, projectId: project.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Trigger Transcription
app.post('/api/transcribe', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const project = getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });

    // Duplicate transcription protection
    if (project.status === 'TRANSCRIBING') {
      return res.json({ success: true, projectId: project.id, status: project.status });
    }
    if (project.status === 'TRANSCRIBED' || project.status === 'READY_TO_EDIT' || project.status === 'COMPLETED') {
      return res.json({ success: true, projectId: project.id, status: project.status });
    }

    const videoPath = path.join(uploadDir, project.videoId);
    if (!fs.existsSync(videoPath)) {
      updateProjectStatus(project.id, 'FAILED', { error: 'Video file missing' });
      return res.status(404).json({ error: 'Video file missing on server' });
    }

    updateProjectStatus(project.id, 'TRANSCRIBING');
    
    // Background Processing
    (async () => {
      try {
        const rawSegments = await transcribeVideo(videoPath, req.body.language);
        
        let wordsRaw = [];
        let wordId = 0;
        rawSegments.forEach(seg => {
          seg.words.forEach(w => {
            wordsRaw.push(createWord(`w${wordId++}`, w.word, w.start, w.end));
          });
        });

        // Persist transcript against the project
        saveTranscript(project.id, wordsRaw);
        updateProjectStatus(project.id, 'TRANSCRIBED', { duration: rawSegments.length ? rawSegments[rawSegments.length - 1].end : 0 });
      } catch (err) {
        console.error('Transcription failed:', err);
        updateProjectStatus(project.id, 'FAILED', { error: err.message || 'Transcription failed' });
      }
    })();

    res.json({ success: true, projectId: project.id, status: 'TRANSCRIBING' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Step 4: Compose
app.post('/api/compose', authMiddleware, async (req, res) => {
  try {
    const { projectId, styleId } = req.body;
    
    const project = getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });
    
    const transcript = getTranscript(projectId);
    if (!transcript) return res.status(400).json({ error: 'Transcript not found for this project' });
    
    // We no longer strictly validate against legacy STYLES dictionary here, 
    // because templates are now fully managed by the frontend templates.ts

    updateProjectStatus(projectId, 'COMPOSING');

    // Run engine on the authoritative transcript
    const segments = compose(transcript.words, styleId);
    segments.forEach(seg => {
      const emphasis = assignEmphasis(seg);
      if (emphasis) {
        const targetWord = seg.words.find(w => w.id === emphasis.wordId);
        if (targetWord) targetWord.emphasis = emphasis.reason;
      }
    });

    saveComposition(projectId, segments, styleId);
    updateProjectStatus(projectId, 'READY_TO_EDIT');

    res.json({ success: true, project: getProject(projectId) });
  } catch (err) {
    console.error(err);
    updateProjectStatus(req.body.projectId, 'FAILED', { error: 'Composition failed' });
    res.status(500).json({ error: err.message });
  }
});

// Step 6: Render final captioned video
const { getJob, getActiveJobForUser, createJob, processJob, COST } = require('./engine/JobEngine');

app.post('/api/render', authMiddleware, async (req, res) => {
  try {
    const { projectId, template } = req.body;
    
    const project = getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized project access' });
    if (!project.segments || !template) return res.status(400).json({ error: 'Project is missing composition state or template' });

    const user = checkCredits(req.user.id);
    if (user.credits < COST) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    const inputPath = path.join(uploadDir, project.videoId);
    const outputPath = path.join(outputDir, 'captioned-' + project.videoId.replace(/\.[^.]+$/, '.mp4'));

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Video not found on server.' });
    }

    let job = getActiveJobForUser(req.user.id);
    if (job) {
      return res.json({ job }); // Already rendering
    }

    updateProjectStatus(projectId, 'RENDERING', { customOverrides: JSON.stringify(template) });
    
    job = createJob(req.user.id, projectId, project.videoId, project.segments, template);
    attachRenderJob(projectId, job.id);

    // Start background processing
    processJob(job.id, inputPath, outputPath);

    res.json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start render' });
  }
});

app.get('/api/jobs/active', authMiddleware, (req, res) => {
  const job = getActiveJobForUser(req.user.id);
  res.json({ job });
});

app.get('/api/jobs/:id', authMiddleware, (req, res) => {
  const job = getJob(req.params.id);
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

app.get('/api/projects', authMiddleware, (req, res) => {
  const { db } = require('./auth');
  const data = db.get();
  const userProjects = data.projects.filter(p => p.userId === req.user.id);
  res.json({ projects: userProjects });
});

app.get('/api/projects/:id', authMiddleware, (req, res) => {
  const { getProject } = require('./engine/ProjectEngine');
  const project = getProject(req.params.id);
  if (!project || project.userId !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json({ project });
});

app.delete('/api/projects/:id', authMiddleware, (req, res) => {
  const { getProject } = require('./engine/ProjectEngine');
  const project = getProject(req.params.id);
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
    const { db } = require('./auth');
    const data = db.get();
    data.projects = data.projects.filter(p => p.id !== req.params.id);
    data.transcripts = data.transcripts.filter(t => t.projectId !== req.params.id);
    db.save(data);
    res.json({ success: true });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ error: 'Failed to delete project files' });
  }
});

app.get('/api/credits', authMiddleware, (req, res) => {
  res.json(checkCredits(req.user.id));
});

// Periodic cleanup job (runs every hour)
setInterval(() => {
  try {
    const { db } = require('./auth');
    const data = db.get();
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;
    
    const expiredProjects = data.projects.filter(p => now - new Date(p.createdAt).getTime() > twoHours);
    expiredProjects.forEach(project => {
      // Cleanup files
      try {
        const inputPath = path.join(uploadDir, project.videoId);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (project.filename) {
          const outputPath = path.join(outputDir, project.filename);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      } catch (e) {
        console.error('Auto-cleanup error for project', project.id, e);
      }
    });

    if (expiredProjects.length > 0) {
      const expiredIds = expiredProjects.map(p => p.id);
      data.projects = data.projects.filter(p => !expiredIds.includes(p.id));
      data.transcripts = data.transcripts.filter(t => !expiredIds.includes(t.projectId));
      db.save(data);
      console.log(`[CLEANUP] Removed ${expiredProjects.length} expired projects and their temporary files.`);
    }
  } catch (err) {
    console.error('Periodic cleanup error:', err);
  }
}, 60 * 60 * 1000); // 1 hour

app.listen(PORT, () => {
  console.log(`Caption app server running on http://localhost:${PORT}`);
});
