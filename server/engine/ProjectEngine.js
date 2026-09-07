const { db } = require('../auth');

function getUserProjects(userId) {
  const data = db.get();
  return data.projects.filter(p => p.userId === userId).map(p => {
    if (!p.videoUrl) p.videoUrl = '/uploads/' + p.videoId;
    return p;
  });
}

function getProject(projectId) {
  const data = db.get();
  const p = data.projects.find(p => p.id === projectId) || null;
  if (p && !p.videoUrl) p.videoUrl = '/uploads/' + p.videoId;
  return p;
}

function createProject(userId, videoId, aspectRatio = '9:16') {
  const data = db.get();
  const project = {
    id: 'proj_' + Date.now() + Math.random().toString(36).substr(2, 5),
    userId,
    videoId,
    aspectRatio,
    status: 'UPLOADING',
    styleId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.projects.push(project);
  db.save(data);
  return project;
}

function updateProjectStatus(projectId, status, extra = {}) {
  const data = db.get();
  const project = data.projects.find(p => p.id === projectId);
  if (project) {
    project.status = status;
    Object.assign(project, extra);
    project.updatedAt = new Date().toISOString();
    db.save(data);
  }
}

function saveTranscript(projectId, rawWords) {
  const data = db.get();
  
  // Replace if exists, or push
  const idx = data.transcripts.findIndex(t => t.projectId === projectId);
  if (idx !== -1) {
    data.transcripts[idx].words = rawWords;
  } else {
    data.transcripts.push({
      id: 'tx_' + Date.now(),
      projectId,
      words: rawWords,
      createdAt: new Date().toISOString()
    });
  }
  db.save(data);
}

function getTranscript(projectId) {
  const data = db.get();
  return data.transcripts.find(t => t.projectId === projectId) || null;
}

function saveComposition(projectId, segments, styleId) {
  const data = db.get();
  const project = data.projects.find(p => p.id === projectId);
  if (project) {
    project.segments = segments;
    project.styleId = styleId;
    project.updatedAt = new Date().toISOString();
    db.save(data);
  }
}

function attachRenderJob(projectId, jobId, outputFilename) {
  const data = db.get();
  const project = data.projects.find(p => p.id === projectId);
  if (project) {
    project.latestJobId = jobId;
    if (outputFilename) {
      project.filename = outputFilename;
      project.downloadUrl = `/api/download/${outputFilename}`;
    }
    project.updatedAt = new Date().toISOString();
    db.save(data);
  }
}

module.exports = {
  getUserProjects,
  getProject,
  createProject,
  updateProjectStatus,
  saveTranscript,
  getTranscript,
  saveComposition,
  attachRenderJob
};
