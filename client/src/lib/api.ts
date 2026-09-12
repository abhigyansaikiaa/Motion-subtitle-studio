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
  uploadVideo: (file: File, onProgress?: (p: number) => void) => {
    return new Promise<{ projectId: string, videoId: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/api/upload`, true);
      // 120 s — enough for Render free tier cold start (up to 50 s) + upload
      xhr.timeout = 120_000;
      const headers = authHeaders();
      if (headers.Authorization) {
        xhr.setRequestHeader('Authorization', headers.Authorization);
      }

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error — server may be starting up. Please retry in 30 seconds.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out — server may be starting up. Please retry.'));

      const formData = new FormData();
      formData.append('video', file);
      xhr.send(formData);
    });
  },

  // Transcribe
  transcribe: (projectId: string, language: string) =>
    fetchApi<{ project: Project }>('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, language: language === 'auto' ? null : language })
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
    })
};
