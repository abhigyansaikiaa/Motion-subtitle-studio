import { create } from 'zustand';
import type { User, Project, Segment, TemplateDefinition } from './types';
import { getTemplate } from './templates';

interface AppState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  
  // Studio Flow
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  setStep: (step: 1 | 2 | 3 | 4 | 5 | 6 | 7) => void;
  
  // Project State
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  
  // Editor State
  selectedStyleId: string;
  setSelectedStyleId: (id: string) => void;
  editorSegments: Segment[];
  setEditorSegments: (segments: Segment[]) => void;
  
  // Customization Overrides (applied on top of template)
  customOverrides: Partial<TemplateDefinition>;
  setCustomOverrides: (overrides: Partial<TemplateDefinition>) => void;
  // Allows toggling behind-subject globally in the studio preview
  captionDepthOverride: 'front' | 'behind-subject' | 'mixed' | null;
  setCaptionDepthOverride: (depth: 'front' | 'behind-subject' | 'mixed' | null) => void;
  
  // Video Player State
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  seekRequest: number | null;
  setSeekRequest: (time: number | null) => void;
  
  // Derived state helper
  getActiveTemplate: () => TemplateDefinition;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  token: localStorage.getItem('rt_token'),
  setUser: (user) => {
    if (user) {
      localStorage.setItem('rt_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('rt_user');
    }
    set({ user });
  },
  setToken: (token) => {
    if (token) {
      localStorage.setItem('rt_token', token);
    } else {
      localStorage.removeItem('rt_token');
    }
    set({ token });
  },
  
  currentStep: 1,
  setStep: (step) => set({ currentStep: step }),
  
  currentProject: null,
  setCurrentProject: (project) => {
    if (project) {
      localStorage.setItem('rt_projectId', project.id);
    } else {
      localStorage.removeItem('rt_projectId');
    }
    set({ currentProject: project });
  },
  
  selectedStyleId: 'editorial-dark',
  setSelectedStyleId: (id) => set({ selectedStyleId: id, customOverrides: {} }), // reset overrides on style change
  
  editorSegments: [],
  setEditorSegments: (segments) => set({ editorSegments: segments }),
  
  customOverrides: {},
  setCustomOverrides: (overrides) => set((state) => ({ customOverrides: { ...state.customOverrides, ...overrides } })),
  captionDepthOverride: null,
  setCaptionDepthOverride: (depth) => set({ captionDepthOverride: depth }),
  
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  seekRequest: null,
  setSeekRequest: (time) => set({ seekRequest: time }),
  
  getActiveTemplate: () => {
    const baseTemplate = getTemplate(get().selectedStyleId);
    return { ...baseTemplate, ...get().customOverrides };
  }
}));
