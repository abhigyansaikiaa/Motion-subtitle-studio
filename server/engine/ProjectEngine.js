const { supabase } = require('../supabase');

async function getUserProjects(userId) {
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      *,
      videos!projects_video_id_fkey ( storage_path )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !projects) return [];

  return projects.map(p => formatProjectInfo(p));
}

async function getProject(projectId) {
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      videos!projects_video_id_fkey ( storage_path )
    `)
    .eq('id', projectId)
    .single();

  if (error || !project) {
    console.error('getProject error:', error);
    return null;
  }
  return formatProjectInfo(project);
}

function formatProjectInfo(p) {
  // If segments is our wrapper object, unwrap it
  const hasMeta = p.segments && p.segments.hasOwnProperty('_meta');
  const segmentsArray = hasMeta ? p.segments.data : p.segments;
  const meta = hasMeta ? p.segments._meta : {};

  const result = {
    id: p.id,
    userId: p.user_id,
    videoId: p.videos?.storage_path, // Maintain backward compatibility for frontend
    videoUuid: p.video_id, // The actual UUID for relationships
    videoUrl: p.videos?.storage_path ? `/api/projects/${p.id}/video` : null,
    aspectRatio: p.aspect_ratio,
    status: p.status,
    segments: segmentsArray,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    styleId: meta.styleId || p.styleId,
    style: meta.styleId || p.styleId, // frontend uses project.style
    filename: meta.filename,
    downloadUrl: meta.b2Key ? `/api/projects/${p.id}/download` : meta.downloadUrl,
    latestJobId: meta.latestJobId,
    error: meta.error || p.error
  };

  return result;
}

async function createProject(userId, filename, aspectRatio = '9:16') {
  // 1. Create video record first
  const { data: video, error: vidError } = await supabase
    .from('videos')
    .insert({
      user_id: userId,
      storage_path: filename,
      filename: filename
    })
    .select()
    .single();

  if (vidError || !video) throw new Error('Failed to create video record');

  // 2. Create project record
  const { data: project, error: projError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      video_id: video.id,
      aspect_ratio: aspectRatio,
      status: 'UPLOADING',
      segments: { _meta: {} }
    })
    .select(`
      *,
      videos!projects_video_id_fkey ( storage_path )
    `)
    .single();

  if (projError || !project) {
    console.error('Project creation error:', projError);
    throw new Error('Failed to create project record');
  }

  await supabase.from('videos').update({ project_id: project.id }).eq('id', video.id);

  return formatProjectInfo(project);
}

async function updateVideoStoragePath(videoId, newPath) {
  const { error } = await supabase
    .from('videos')
    .update({ storage_path: newPath })
    .eq('id', videoId);
  if (error) {
    console.error('updateVideoStoragePath error:', error);
    throw new Error('Failed to update video storage path');
  }
}

async function updateProjectStatus(projectId, status, extra = {}) {
  const { data: project } = await supabase.from('projects').select('segments').eq('id', projectId).single();
  let segmentsObj = project?.segments || { _meta: {} };
  if (Array.isArray(segmentsObj)) {
    segmentsObj = { _meta: {}, data: segmentsObj };
  }
  if (!segmentsObj._meta) segmentsObj._meta = {};
  
  if (extra.filename) segmentsObj._meta.filename = extra.filename;
  if (extra.downloadUrl) segmentsObj._meta.downloadUrl = extra.downloadUrl;
  if (extra.styleId) segmentsObj._meta.styleId = extra.styleId;
  if (extra.language) segmentsObj._meta.language = extra.language;
  if (extra.error) segmentsObj._meta.error = extra.error;
  
  await supabase
    .from('projects')
    .update({ 
      status, 
      segments: segmentsObj,
      updated_at: new Date().toISOString() 
    })
    .eq('id', projectId);
}

async function saveTranscript(projectId, rawWords) {
  const { data } = await supabase
    .from('transcripts')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (data) {
    const { error } = await supabase
      .from('transcripts')
      .update({ words: rawWords })
      .eq('id', data.id);
    if (error) throw new Error('Failed to update transcript: ' + error.message);
  } else {
    const { error } = await supabase
      .from('transcripts')
      .insert({
        project_id: projectId,
        words: rawWords
      });
    if (error) throw new Error('Failed to insert transcript: ' + error.message);
  }
}

async function getTranscript(projectId) {
  const { data, error } = await supabase
    .from('transcripts')
    .select('words')
    .eq('project_id', projectId)
    .single();

  if (error || !data) return null;

  // Normalize transcript data. Early iterations used .word instead of .text
  const normalizedWords = (data.words || []).map(w => {
    const text = w.text !== undefined ? w.text : w.word;
    return {
      ...w,
      text: text,
      cleanText: w.cleanText || (text ? text.trim().replace(/[^\\w]/g, '').toLowerCase() : '')
    };
  });

  return { projectId, words: normalizedWords };
}

async function saveComposition(projectId, segments, styleId) {
  const { data: project } = await supabase.from('projects').select('segments').eq('id', projectId).single();
  let segmentsObj = project?.segments || { _meta: {} };
  if (Array.isArray(segmentsObj)) {
    segmentsObj = { _meta: {}, data: segmentsObj };
  }
  if (!segmentsObj._meta) segmentsObj._meta = {};
  
  segmentsObj.data = segments;
  segmentsObj._meta.styleId = styleId;

  const { error } = await supabase
    .from('projects')
    .update({
      segments: segmentsObj,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId);
    
  if (error) {
    console.error('saveComposition error:', error);
    throw new Error('Failed to save composition: ' + error.message);
  }
}

async function attachRenderJob(projectId, jobId, outputFilename, b2Key = null) {
  const { data: project } = await supabase.from('projects').select('segments').eq('id', projectId).single();
  let segmentsObj = project?.segments || { _meta: {} };
  if (Array.isArray(segmentsObj)) {
    segmentsObj = { _meta: {}, data: segmentsObj };
  }
  if (!segmentsObj._meta) segmentsObj._meta = {};
  
  segmentsObj._meta.latestJobId = jobId;
  if (outputFilename) {
    segmentsObj._meta.filename = outputFilename;
    if (b2Key) {
      segmentsObj._meta.b2Key = b2Key;
    }
    // Fallback for local
    segmentsObj._meta.downloadUrl = `/api/download/${outputFilename}`;
  }

  const { error } = await supabase
    .from('projects')
    .update({ 
      segments: segmentsObj,
      updated_at: new Date().toISOString() 
    })
    .eq('id', projectId);

  if (error) {
    console.error('attachRenderJob error:', error);
    throw new Error('Failed to attach render job: ' + error.message);
  }
}

module.exports = {
  getUserProjects,
  getProject,
  createProject,
  updateProjectStatus,
  updateVideoStoragePath,
  saveTranscript,
  getTranscript,
  saveComposition,
  attachRenderJob
};
