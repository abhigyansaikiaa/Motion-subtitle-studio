import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { ShiningText } from '../ui/shining-text';
import { TemplateBrowser } from './template-browser';
import { WordEditor } from './word-editor';
import {
  TypographyPanel, ColorPanel, AnimationPanel,
  LayoutPanel, NumbersPanel, DepthPanel, ResetControlsButton
} from './customization-controls';
import { CompositedPreview } from '../captions/composited-preview';
import { DesignWheel, type ToolId } from './design-wheel';
import { RenderSnakeGame } from './render-snake-game';
import {
  Upload, Play, Pause, Download, AlertCircle, RefreshCw,
  Sliders, LayoutGrid, Type, RotateCcw,
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BACKEND = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
const STEP_SEQUENCE = [1, 2, 3] as const;
const STEP_LABELS: Record<number, string> = { 1: 'Upload', 2: 'Transcribe', 3: 'Studio' };

function StepBar({ current }: { current: number }) {
  const uiStep = current >= 3 ? 3 : current;
  return (
    <div className="flex items-center gap-1">
      {STEP_SEQUENCE.map((s, i) => {
        const isActive = uiStep === s;
        const isPast = uiStep > s;
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div className={`w-8 h-px mx-0.5 transition-all duration-500 ${isPast ? 'bg-foreground/30' : 'bg-border'}`} />
            )}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${isActive
                ? 'bg-foreground text-background'
                : isPast
                  ? 'text-foreground/40 border border-border'
                  : 'text-muted-foreground border border-border'
              }`}>
              <span>{isPast ? '✓' : s}</span>
              <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── RIGHT PANEL TABS ─────────────────────────────────────────────────────────
type RightTab = 'templates' | 'design';

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function StudioWorkflow() {
  const currentStep = useAppStore(s => s.currentStep);
  const setStep = useAppStore(s => s.setStep);
  const currentProject = useAppStore(s => s.currentProject);
  const setCurrentProject = useAppStore(s => s.setCurrentProject);
  const selectedStyleId = useAppStore(s => s.selectedStyleId);
  const editorSegments = useAppStore(s => s.editorSegments);
  const setEditorSegments = useAppStore(s => s.setEditorSegments);
  const currentTime = useAppStore(s => s.currentTime);
  const setCurrentTime = useAppStore(s => s.setCurrentTime);
  const duration = useAppStore(s => s.duration);
  const setDuration = useAppStore(s => s.setDuration);
  const isPlaying = useAppStore(s => s.isPlaying);
  const setIsPlaying = useAppStore(s => s.setIsPlaying);
  const getActiveTemplate = useAppStore(s => s.getActiveTemplate);
  const token = useAppStore(s => s.token) || localStorage.getItem('rt_token');

  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcribeLang, setTranscribeLang] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>('templates');
  const [resolution, setResolution] = useState('original');

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const activeTemplate = getActiveTemplate();
  const inStudio = currentStep >= 3 && currentStep <= 7 && !!currentProject;

  // Note: Video events and playback sync are now entirely handled by CompositedPreview.

  // ─── UPLOAD ───────────────────────────────────────────────────────────────
  const processFile = async (file: File) => {
    if (!file.type.startsWith('video/')) { setError('Unsupported format. Please upload MP4, MOV, or WebM.'); return; }
    if (file.size > 200 * 1024 * 1024) { setError('Video exceeds 200 MB. Please compress and retry.'); return; }
    try {
      setIsProcessing(true); setError(null); setProcessingMsg('WAKING SERVER...');

      // Wake Render's free-tier instance before the upload XHR fires.
      // The /health endpoint is unauthenticated and fast — this avoids the
      // cold-start timeout that previously caused "Network error during upload".
      const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
      try {
        await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(40_000) });
      } catch { /* ignore — upload will still try */ }

      setProcessingMsg('UPLOADING 0%');
      const res = await api.uploadVideo(file, p => { setUploadProgress(p); setProcessingMsg(`UPLOADING ${p}%`); });
      const projRes = await api.getProject(res.projectId);
      setCurrentProject(projRes.project);
      setStep(2);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        setError('Session expired. Please log in again.');
        setTimeout(() => { window.location.hash = '#/auth?mode=login'; }, 1500);
      } else {
        setError(msg || 'Upload failed. Please try again.');
      }
    } finally {
      setIsProcessing(false); setUploadProgress(0); setProcessingMsg('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ─── TRANSCRIBE ───────────────────────────────────────────────────────────
  const handleTranscribe = async () => {
    if (!currentProject) return;
    try {
      setIsProcessing(true); setError(null); setProcessingMsg('TRANSCRIBING...');
      await api.transcribe(currentProject.id, transcribeLang);
      const poll = setInterval(async () => {
        try {
          const res = await api.getProject(currentProject.id);
          const status = res.project.status;
          if (['TRANSCRIBED', 'READY_TO_EDIT', 'COMPLETED'].includes(status)) {
            clearInterval(poll);
            setProcessingMsg('BUILDING CAPTIONS...');
            try {
              const composeRes = await api.compose(currentProject.id, selectedStyleId);
              const segs = composeRes.project?.segments || [];
              setCurrentProject(composeRes.project);
              setEditorSegments(segs);
              if (segs.length > 0) {
                const t = (segs[0].start + segs[0].end) / 2;
                setCurrentTime(t);
                if (videoRef.current) videoRef.current.currentTime = t;
              }
              setStep(3);
            } catch (err: any) {
              console.error('Compose failed:', err);
              setError('Failed to build captions: ' + (err.message || 'Unknown error'));
            }
            setIsProcessing(false); setProcessingMsg('');
          } else if (status === 'FAILED') {
            clearInterval(poll);
            setError(res.project.error || 'Transcription failed');
            setIsProcessing(false); setProcessingMsg('');
          }
        } catch { clearInterval(poll); setError('Status check failed'); setIsProcessing(false); setProcessingMsg(''); }
      }, 2000);
    } catch (err: any) {
      setError(err.message); setIsProcessing(false); setProcessingMsg('');
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const handleRender = async () => {
    if (!currentProject) return;
    try {
      setIsProcessing(true); setError(null); setStep(6); setProcessingMsg('RENDERING...');
      const res = await api.render(currentProject.id, editorSegments, activeTemplate, resolution);
      const poll = setInterval(async () => {
        try {
          const jobRes = await api.getJob(res.job.id);
          if (jobRes.job.status === 'COMPLETED') {
            clearInterval(poll);
            const projRes = await api.getProject(currentProject.id);
            setCurrentProject(projRes.project);
            setStep(7); setIsProcessing(false); setProcessingMsg('');
          } else if (jobRes.job.status === 'FAILED') {
            clearInterval(poll);
            setError(jobRes.job.message || 'Render failed');
            setStep(5); setIsProcessing(false); setProcessingMsg('');
          }
        } catch { /* polling errors non-fatal */ }
      }, 3000);
    } catch (err: any) {
      setError(err.message); setStep(5); setIsProcessing(false); setProcessingMsg('');
    }
  };

  // ─── SEEK ─────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentTime(pct * duration);
  }, [duration, setCurrentTime]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const videoSrc = currentProject
    ? (currentStep === 7 && currentProject.downloadUrl
      ? `${BACKEND}${currentProject.downloadUrl}?token=${token}`
      : `${BACKEND}${currentProject.videoUrl}?token=${token}`)
    : undefined;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex min-h-0 bg-transparent text-on-surface overflow-hidden z-10 relative">
      {/* ERROR TOAST */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-950/90 text-red-200 px-4 py-2.5 rounded-xl border border-red-500/40 shadow-xl max-w-sm text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white text-xs underline">×</button>
        </div>
      )}

      {/* ── LEFT COLUMN: ASYMMETRIC NAV ── */}
      {inStudio && (
        <aside className="w-[80px] lg:w-[260px] flex-shrink-0 flex flex-col border-r border-border/10 bg-surface-container-lowest/80 backdrop-blur-2xl relative z-20 overflow-hidden">
          <div className="p-4 lg:p-8 flex flex-col gap-8 h-full">
            <div className="flex flex-col gap-2">
              <span className="font-editorial font-bold text-2xl lg:text-4xl tracking-tighter leading-none uppercase text-on-surface break-words">MOTION<br/><span className="text-primary">SUBTITLE</span></span>
            </div>
            
            <nav className="flex-1 flex flex-col gap-4 lg:gap-6 overflow-y-auto custom-scrollbar pt-4">
              {[
                { id: 'templates', label: 'Templates' },
                { id: 'clips', label: 'Clips' },
                { id: 'typography', label: 'Typography' },
                { id: 'animation', label: 'Animation' },
                { id: 'color', label: 'Color' },
                { id: 'layout', label: 'Layout' },
                { id: 'numbers', label: 'Numbers' },
                { id: 'depth', label: 'Depth' }
              ].map((tool, i) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id as ToolId)}
                  className={`flex flex-col items-start gap-1 transition-all group ${activeTool === tool.id ? 'opacity-100' : 'opacity-30 hover:opacity-80'}`}
                >
                  <span className={`text-[10px] font-mono transition-colors ${activeTool === tool.id ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`}>0{i+1}</span>
                  <span className={`font-editorial font-bold text-lg lg:text-4xl tracking-tighter uppercase leading-[0.8] text-left ${activeTool === tool.id ? 'text-on-surface' : 'text-muted-foreground group-hover:text-on-surface'}`}>{tool.label}</span>
                </button>
              ))}
            </nav>

            <div className="flex flex-col gap-4 mt-auto">
              <div className="w-full h-px bg-border/10" />
              {inStudio && currentStep < 6 && (
                <div className="flex flex-col lg:flex-row gap-2">
                  <button
                    onClick={() => { setStep(1); setCurrentProject(null as any); setEditorSegments([]); }}
                    className="flex items-center justify-center gap-1.5 p-2 lg:px-3 lg:py-2 text-xs font-medium text-muted-foreground hover:text-on-surface transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden lg:inline">Reset</span>
                  </button>
                  <button
                    onClick={handleRender}
                    disabled={isProcessing || editorSegments.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-primary text-on-primary font-bold text-xs lg:text-sm uppercase tracking-widest hover:bg-primary-fixed transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden lg:inline">Export</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ── CENTER COLUMN: STAGE ── */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden bg-transparent p-4 lg:p-8">
        
        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-center opacity-[0.03] overflow-hidden">
               <span className="font-editorial text-massive uppercase leading-[0.7] whitespace-nowrap -ml-10">DESIGN</span>
               <span className="font-editorial text-massive uppercase leading-[0.7] whitespace-nowrap ml-20">YOUR</span>
               <span className="font-editorial text-massive uppercase leading-[0.7] whitespace-nowrap -ml-5">WORDS</span>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative z-10 flex flex-col items-center w-full max-w-2xl p-16 tactile-border bg-surface-container-low backdrop-blur-md transition-all duration-500 ${isDragging ? 'scale-[1.02] bg-surface-container' : 'hover:bg-surface-container'}`}
            >
              <h3 className="font-editorial text-5xl font-bold uppercase tracking-tighter mb-4 text-on-surface">Upload</h3>
              <p className="text-muted-foreground text-center text-sm mb-12 max-w-sm font-grotesk">
                Begin the process. Drag & drop or click to browse. MP4, MOV, WebM.
              </p>

              <input
                type="file" accept="video/*"
                className="hidden" ref={fileInputRef}
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                disabled={isProcessing}
              />

              {isProcessing ? (
                <div className="w-full flex flex-col items-center gap-4">
                  <ShiningText text={processingMsg || 'UPLOADING...'} className="font-editorial text-2xl font-bold uppercase tracking-widest text-primary" />
                  <div className="w-full h-px bg-border/20 overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{uploadProgress}%</span>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-10 py-4 font-bold text-sm bg-on-surface text-surface-container-lowest uppercase tracking-widest hover:bg-primary transition-colors hover:text-on-primary"
                >
                  Select File
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Transcribe */}
        {currentStep === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center relative">
             <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-center opacity-[0.03] overflow-hidden">
               <span className="font-editorial text-massive uppercase leading-[0.7] whitespace-nowrap">LISTEN</span>
               <span className="font-editorial text-massive uppercase leading-[0.7] whitespace-nowrap ml-32">CLOSELY</span>
            </div>
            
            <div className="relative z-10 flex flex-col items-center w-full max-w-lg p-12 tactile-border bg-surface-container-low backdrop-blur-md">
              {currentProject?.videoUrl && (
                <div className="w-full mb-8 overflow-hidden bg-black tactile-border">
                  <video
                    src={`${BACKEND}${currentProject.videoUrl}?token=${token}`}
                    className="w-full h-full object-contain opacity-70"
                    style={{ maxHeight: '200px' }}
                    muted playsInline
                  />
                </div>
              )}

              <h3 className="font-editorial text-4xl font-bold uppercase tracking-tighter mb-2 text-on-surface">Transcribe</h3>
              <p className="text-muted-foreground text-center text-xs mb-8 uppercase tracking-widest">
                Select Language Context
              </p>

              <select
                value={transcribeLang}
                onChange={e => setTranscribeLang(e.target.value)}
                disabled={isProcessing}
                className="w-full p-4 mb-8 bg-surface-container font-grotesk text-sm text-on-surface border border-border/20 outline-none focus:border-primary transition-colors appearance-none text-center uppercase tracking-widest cursor-pointer"
              >
                <option value="auto">Auto-Detect</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hi-Latn">Hinglish</option>
                <option value="es">Spanish</option>
              </select>

              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <ShiningText text={processingMsg || 'TRANSCRIBING...'} className="font-editorial text-xl font-bold uppercase tracking-widest text-primary" />
                </div>
              ) : (
                <button
                  onClick={handleTranscribe}
                  className="w-full px-8 py-4 font-bold text-sm bg-on-surface text-surface-container-lowest uppercase tracking-widest hover:bg-primary transition-colors hover:text-on-primary"
                >
                  Generate Captions
                </button>
              )}
            </div>
          </div>
        )}

        {/* Steps 3–7: Stage */}
        {inStudio && (
          <div className="flex-1 min-h-0 flex flex-col relative z-10">
            {/* Video Canvas Container */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-4">
              <div
                className="relative flex-shrink-0 tactile-border"
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#050505',
                }}
              >
                <CompositedPreview />

                {/* Overlays */}
                {currentStep === 6 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/90 backdrop-blur-xl gap-8">
                    <ShiningText text="RENDERING" className="font-editorial text-5xl font-bold uppercase tracking-tighter text-primary" />
                    <RenderSnakeGame />
                  </div>
                )}
                {isProcessing && currentStep === 3 && (
                  <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 backdrop-blur-md">
                    <ShiningText text={processingMsg || 'APPLYING...'} className="font-editorial text-3xl font-bold uppercase tracking-widest text-on-surface" />
                  </div>
                )}
              </div>
            </div>

            {/* Player Controls */}
            {currentStep !== 6 && currentStep !== 7 && (
              <div className="flex-shrink-0 h-16 mt-4 tactile-border flex items-center gap-6 px-6 mx-auto w-full max-w-3xl bg-surface-container-lowest/80 backdrop-blur-md">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-on-surface text-surface-container-lowest hover:bg-primary hover:text-on-primary transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-1" />}
                </button>

                <span className="text-xs font-mono text-muted-foreground w-12 text-right">{fmt(currentTime)}</span>

                <div
                  ref={seekBarRef}
                  className="flex-1 relative h-px bg-border/20 cursor-pointer group flex items-center"
                  onClick={handleSeek}
                >
                  <div
                    className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 transition-all"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 w-4 h-4 rounded-full bg-primary border-2 border-surface-container-lowest opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1/2 cursor-grab active:cursor-grabbing"
                    style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                  />
                </div>

                <span className="text-xs font-mono text-muted-foreground w-12">{fmt(duration)}</span>
              </div>
            )}
            
            {/* Step 7 Download */}
            {currentStep === 7 && currentProject && (
                <div className="flex-shrink-0 mt-4 flex items-center justify-between p-6 tactile-border mx-auto w-full max-w-3xl bg-surface-container-lowest/80 backdrop-blur-md">
                  <div>
                    <h4 className="font-editorial text-2xl font-bold uppercase tracking-tighter text-on-surface">Render Complete</h4>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => { useAppStore.getState().setStep(3); useAppStore.getState().setIsPlaying(false); }}
                      className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-on-surface transition-colors"
                    >
                      Edit Again
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api.downloadVideo(currentProject.downloadUrl || '', currentProject.filename || 'download.mp4');
                        } catch (err: any) {
                          alert('Download failed: ' + err.message);
                        }
                      }}
                      className="px-6 py-3 bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:bg-primary-fixed transition-colors"
                    >
                      Download MP4
                    </button>
                  </div>
                </div>
            )}
          </div>
        )}
      </main>

      {/* ── RIGHT COLUMN: CONTEXTUAL CONTROLS ── */}
      {inStudio && activeTool && (
        <aside className="w-[320px] lg:w-[420px] flex-shrink-0 flex flex-col border-l border-border/10 bg-surface-container-lowest/95 backdrop-blur-3xl relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          <div className="p-6 lg:p-8 border-b border-border/10 flex justify-between items-end bg-surface-container-lowest relative overflow-hidden">
             {/* Large background text hint */}
             <div className="absolute -right-4 -bottom-4 opacity-[0.02] pointer-events-none">
                <span className="font-editorial text-massive leading-none">{activeTool.slice(0,2)}</span>
             </div>
             
             <h2 className="font-editorial font-bold text-4xl lg:text-5xl tracking-tighter text-on-surface uppercase leading-none relative z-10">{activeTool}</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
              {activeTool === 'clips' && (
                <div className="p-6 border-b border-border/10 bg-surface-container-low">
                  <p className="font-editorial text-xl font-bold uppercase tracking-tighter text-on-surface mb-2">Editor</p>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed font-grotesk">
                    Click any word to select. Hover to spotlight, hide, or change case.
                  </p>
                </div>
              )}
              {activeTool === 'clips' && <WordEditor />}
              {activeTool === 'templates' && <TemplateBrowser />}
              {activeTool === 'typography' && <TypographyPanel />}
              {activeTool === 'color' && <ColorPanel />}
              {activeTool === 'layout' && <LayoutPanel />}
              {activeTool === 'animation' && <AnimationPanel />}
              {activeTool === 'numbers' && <NumbersPanel />}
              {activeTool === 'depth' && <DepthPanel />}
          </div>
          {activeTool !== 'clips' && activeTool !== 'templates' && <ResetControlsButton />}
        </aside>
      )}
    </div>
  );
}
