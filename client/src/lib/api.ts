import type { Project, Job, User, TemplateDefinition } from './types';
import { useAppStore } from './store';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'; // Bypass Vite proxy to avoid large file upload network errors
function authHeaders(): Record<string, string> {
  const storeToken = useAppStore.getState().token;
  const token = storeToken || localStorage.getItem('rt_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders()
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${res.status}`);
  }
  return res.json();
}

const MULTIPART_THRESHOLD_BYTES = 25 * 1024 * 1024; // files above this use parallel multipart
const MULTIPART_PART_SIZE = 10 * 1024 * 1024;      // 10MB parts (R2 minimum is 5MB except last)
const MULTIPART_CONCURRENCY = 5;                   // parallel part uploads
const MULTIPART_PART_RETRIES = 3;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// PUT a blob to a presigned URL with progress, no fixed timeout, and a
// stall detector (aborts only after 60s of zero bytes moved).
function putBlobWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onChunkProgress?: (loaded: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);

    const STALL_LIMIT_MS = 60_000;
    let lastProgressAt = Date.now();
    let settled = false;
    let stallTimer: ReturnType<typeof setInterval>;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(stallTimer);
      fn();
    };
    stallTimer = setInterval(() => {
      if (Date.now() - lastProgressAt > STALL_LIMIT_MS) {
        xhr.abort();
        settle(() => reject(new Error('Upload stalled — your connection dropped. Please retry.')));
      }
    }, 5_000);

    xhr.upload.addEventListener('progress', (e) => {
      lastProgressAt = Date.now();
      if (onChunkProgress) onChunkProgress(e.loaded);
    });

    xhr.onload = () => settle(() => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    });
    xhr.onerror = () => settle(() => reject(new Error('Network error during upload')));
    xhr.onabort = () => settle(() => reject(new Error('Upload cancelled')));
    xhr.send(blob);
  });
}

async function finalizeUpload(key: string, videoUuid: string, filename: string) {
  const finalizeRes = await fetchApi<{ projectId: string, b2Key: string }>('/api/upload/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, videoUuid, filename })
  });
  return { projectId: finalizeRes.projectId, videoId: finalizeRes.b2Key };
}

// Single-PUT direct upload (small files, or providers without multipart).
async function uploadVideoSinglePut(file: File, onProgress?: (p: number) => void) {
  const presignedRes = await fetchApi<{ url: string, key: string, videoUuid: string, safeFilename: string }>('/api/upload/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' })
  });

  await putBlobWithProgress(presignedRes.url, file, file.type || 'video/mp4', (loaded) => {
    if (onProgress) onProgress(Math.round((loaded / file.size) * 100));
  });

  return finalizeUpload(presignedRes.key, presignedRes.videoUuid, presignedRes.safeFilename);
}

// Parallel multipart direct upload (large files): 10MB parts, 5 at a time,
// each part retried independently. The server collects ETags via ListParts,
// so the browser never needs ETag CORS exposure.
async function uploadVideoMultipart(file: File, onProgress?: (p: number) => void) {
  let init: { key: string, videoUuid: string, safeFilename: string, uploadId: string };
  try {
    init = await fetchApi<{ key: string, videoUuid: string, safeFilename: string, uploadId: string }>('/api/upload/multipart/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' })
    });
  } catch (err) {
    if (err instanceof Error && /not supported/i.test(err.message)) {
      throw new Error('MULTIPART_UNSUPPORTED');
    }
    throw err;
  }
  const { key, videoUuid, safeFilename, uploadId } = init;
  const contentType = file.type || 'video/mp4';

  const totalParts = Math.ceil(file.size / MULTIPART_PART_SIZE);
  const partLoaded = new Array<number>(totalParts).fill(0);
  const report = () => {
    if (onProgress) {
      const done = partLoaded.reduce((a, b) => a + b, 0);
      onProgress(Math.round((done / file.size) * 100));
    }
  };

  let nextPart = 1;
  let firstError: unknown = null;

  async function uploadOnePart(partNumber: number): Promise<void> {
    const start = (partNumber - 1) * MULTIPART_PART_SIZE;
    const chunk = file.slice(start, Math.min(start + MULTIPART_PART_SIZE, file.size));
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MULTIPART_PART_RETRIES; attempt++) {
      try {
        const { url } = await fetchApi<{ url: string }>('/api/upload/multipart/part-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, uploadId, partNumber })
        });
        await putBlobWithProgress(url, chunk, contentType, (loaded) => {
          partLoaded[partNumber - 1] = loaded;
          report();
        });
        partLoaded[partNumber - 1] = chunk.size;
        report();
        return;
      } catch (err) {
        lastErr = err;
        partLoaded[partNumber - 1] = 0;
        await sleep(1000 * (attempt + 1));
      }
    }
    throw lastErr;
  }

  async function worker(): Promise<void> {
    while (nextPart <= totalParts && !firstError) {
      const partNumber = nextPart++;
      try {
        await uploadOnePart(partNumber);
      } catch (err) {
        firstError = err;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(MULTIPART_CONCURRENCY, totalParts) }, () => worker()));

  if (firstError) {
    // Best-effort cleanup of the dangling multipart upload server-side.
    fetchApi('/api/upload/multipart/abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, uploadId })
    }).catch(() => { /* ignore */ });
    throw firstError;
  }

  await fetchApi('/api/upload/multipart/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, uploadId })
  });

  return finalizeUpload(key, videoUuid, safeFilename);
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchApi<{ token: string, user: User }>('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    }),

  signup: (email: string, password: string, name: string) =>
    fetchApi<{ token: string, user: User }>('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    }),

  getMe: () => fetchApi<{ user: User }>('/api/me'),

  // Projects
  getProjects: () => fetchApi<{ projects: Project[] }>('/api/projects'),
  getProject: (id: string) => fetchApi<{ project: Project }>('/api/projects/' + id),
  deleteProject: (id: string) => fetchApi<{ success: boolean }>('/api/projects/' + id, { method: 'DELETE' }),

  // Upload — large files go via parallel multipart (5 x 10MB parts at a time,
  // straight to R2), small files via single PUT. Falls back to single PUT
  // when the storage provider doesn't support multipart.
  uploadVideo: async (file: File, onProgress?: (p: number) => void) => {
    if (file.size > MULTIPART_THRESHOLD_BYTES) {
      try {
        return await uploadVideoMultipart(file, onProgress);
      } catch (err) {
        if (err instanceof Error && err.message === 'MULTIPART_UNSUPPORTED') {
          return await uploadVideoSinglePut(file, onProgress);
        }
        throw err;
      }
    }
    return await uploadVideoSinglePut(file, onProgress);
  },

  // Transcribe — force=true resets a row wedged in TRANSCRIBING/QUEUED by a dead worker
  transcribe: (projectId: string, language: string, force = false) =>
    fetchApi<{ project: Project }>('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, language: language === 'auto' ? null : language, force })
    }),

  // Compose
  compose: (projectId: string, styleId: string) =>
    fetchApi<{ project: Project }>('/api/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, styleId })
    }),

  // Render
  render: (projectId: string, segments: any[], template: TemplateDefinition, resolution?: string) =>
    fetchApi<{ job: Job }>('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, segments, template, resolution })
    }),

  // Job polling
  getJob: (jobId: string) => fetchApi<{ job: Job }>(`/api/jobs/${jobId}`),
  getRenderStatus: () => fetchApi<{ canRender: boolean, hfWorker: boolean, githubBackup: boolean, message: string }>('/api/render/status'),

  // Save specific step without full compose (if needed)
  saveSegments: (projectId: string, segments: any[]) =>
    fetchApi<{ project: Project }>(`/api/projects/${projectId}/segments`, { // Note: endpoint might need creation if we need partial saves, but for now we'll just keep segments in state and send at render
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments })
    }),

  downloadVideo: async (url: string, filename?: string) => {
    const res = await fetch(API + url, {
      headers: { ...authHeaders() }
    });
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
    
    const data = await res.json();
    
    const a = document.createElement('a');
    a.href = data.url;
    a.download = filename || 'download.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
