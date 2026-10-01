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

  // Upload
  uploadVideo: async (file: File, onProgress?: (p: number) => void) => {
    // 1. Get presigned URL
    const presignedRes = await fetchApi<{ url: string, key: string, videoUuid: string, safeFilename: string }>('/api/upload/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' })
    });

    // 2. Upload directly to R2 using XMLHttpRequest (for progress)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedRes.url, true);
      // Don't set Authorization header for R2, it uses the presigned URL credentials
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

      // No fixed timeout: large videos on slow connections legitimately take
      // many minutes (a 200MB file needs ~9 Mbps sustained to fit in 3 min).
      // The presigned URL itself expires after 1 hour, which bounds the upload.
      // Instead, abort only if the connection stalls with zero progress.
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
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.onload = () => settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error('Direct upload failed'));
        }
      });

      xhr.onerror = () => settle(() => reject(new Error('Network error during upload')));
      xhr.onabort = () => settle(() => reject(new Error('Upload cancelled')));

      xhr.send(file); // Send file directly, not as FormData
    });

    // 3. Finalize upload metadata
    const finalizeRes = await fetchApi<{ projectId: string, b2Key: string }>('/api/upload/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: presignedRes.key,
        videoUuid: presignedRes.videoUuid,
        filename: presignedRes.safeFilename
      })
    });

    return { projectId: finalizeRes.projectId, videoId: finalizeRes.b2Key };
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
