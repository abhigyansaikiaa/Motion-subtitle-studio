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
  const [transcribeElapsed, setTranscribeElapsed] = useState(0);
  const [transcribeFailed, setTranscribeFailed] = useState(false);
  const transcribePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const activeTemplate = getActiveTemplate();
  const inStudio = currentStep >= 3 && currentStep <= 7 && !!currentProject;

  // Wake the server as soon as the Studio mounts so it's ready for upload
  useEffect(() => {
    const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
    fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(40_000) }).catch(() => {});
  }, []);

  // Never leak the transcribe poller if the component unmounts mid-transcription
  useEffect(() => {
    return () => { if (transcribePollRef.current) clearInterval(transcribePollRef.current); };
  }, []);

  // Note: Video events and playback sync are now entirely handled by CompositedPreview.

  // ─── UPLOAD ───────────────────────────────────────────────────────────────
  const processFile = async (file: File) => {
    if (!file.type.startsWith('video/')) { setError('Unsupported format. Please upload MP4, MOV, or WebM.'); return; }
    if (file.size > 200 * 1024 * 1024) { setError('Video exceeds 200 MB. Please compress and retry.'); return; }
    try {
      setIsProcessing(true); setError(null);
      setProcessingMsg('UPLOADING 0%');
      const res = await api.uploadVideo(file, p => { setUploadProgress(p); setProcessingMsg(`UPLOADING ${p}%`); });
      setProcessingMsg('UPLOADED');
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
  // 20-minute client-side ceiling: a stuck worker job surfaces a retry
  // instead of an eternal spinner.
  const TRANSCRIBE_TIMEOUT_MS = 20 * 60 * 1000;

  const handleTranscribe = async (force = false) => {
    if (!currentProject) return;
    // Auto-force when resuming a stale job: if the project has been sitting in
    // TRANSCRIBING/QUEUED for over 10 min (e.g. page refresh on a wedged job),
    // a plain click would hit the server's duplicate-protection and change
    // nothing — so reset it. Fresh jobs (<10 min) are left alone.
    let effectiveForce = force;
    if (!effectiveForce && (currentProject.status === 'TRANSCRIBING' || (currentProject.status as string) === 'QUEUED_RENDER_TRANS')) {
      const updatedMs = currentProject.updatedAt ? new Date(currentProject.updatedAt).getTime() : 0;
      if (Date.now() - updatedMs > 10 * 60 * 1000) {
        effectiveForce = true;
      }
    }
    try {
      setIsProcessing(true); setError(null); setTranscribeFailed(false);
      setTranscribeElapsed(0); setProcessingMsg('PREPARING AUDIO...');
      await api.transcribe(currentProject.id, transcribeLang, effectiveForce);
      const startedAt = Date.now();
      if (transcribePollRef.current) clearInterval(transcribePollRef.current);
      const poll = setInterval(async () => {
        const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
        setTranscribeElapsed(elapsedSec);
        if (Date.now() - startedAt > TRANSCRIBE_TIMEOUT_MS) {
          clearInterval(poll); transcribePollRef.current = null;
          setIsProcessing(false); setProcessingMsg('');
          setTranscribeFailed(true);
          setError('Transcription is taking unusually long — the worker may have stalled. Your video is safe. Please retry.');
          return;
        }
        try {
          const res = await api.getProject(currentProject.id);
          const status = res.project.status;

          if (status === 'TRANSCRIBING') {
            setProcessingMsg(`TRANSCRIBING... ${elapsedSec}s`);
          } else if ((status as string) === 'QUEUED_RENDER_TRANS') {
            setProcessingMsg(`QUEUED — STARTING WORKER... ${elapsedSec}s`);
          }

          if (['TRANSCRIBED', 'READY_TO_EDIT', 'COMPLETED'].includes(status)) {
            clearInterval(poll); transcribePollRef.current = null;
            setProcessingMsg('CAPTIONS READY');
            try {
              const composeRes = await api.compose(currentProject.id, selectedStyleId);
              const segs = composeRes.project?.segments || [];
              setCurrentProject(composeRes.project);
              setEditorSegments(segs);
              if (segs.length > 0) {
                const t = (segs[0].start + segs[0].end) / 2;
                setCurrentTime(t);
                useAppStore.getState().setSeekRequest(t);
              }
              setStep(3);
            } catch (err: any) {
              console.error('Compose failed:', err);
              setError('Failed to build captions: ' + (err.message || 'Unknown error'));
            }
            setIsProcessing(false); setProcessingMsg('');
          } else if (status === 'FAILED') {
            clearInterval(poll); transcribePollRef.current = null;
            const metaErr = (res.project.segments as any)?._meta?.last_error;
            setError(metaErr ? `Transcription failed: ${metaErr}` : (res.project.error || 'Transcription failed. Please retry.'));
            setTranscribeFailed(true);
            setIsProcessing(false); setProcessingMsg('');
          }
        } catch (e) {
          console.warn('Status check failed, retrying...', e);
          // Do not clear interval on transient network errors
        }
      }, 2000);
      transcribePollRef.current = poll;
    } catch (err: any) {
      setError(err.message); setIsProcessing(false); setProcessingMsg(''); setTranscribeFailed(true);
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
        } catch (e) { 
          console.warn('Render status check failed, retrying...', e);
          // Do not clear interval on transient network errors
        }
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
    const targetTime = pct * duration;
    setCurrentTime(targetTime);
    useAppStore.getState().setSeekRequest(targetTime);
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
        <aside className="w-[80px] lg:w-[260px] flex-shrink-0 flex flex-col border-r border-border/10 bg-surface-container-lowest relative z-20 overflow-hidden">
          <div className="p-6 lg:p-10 flex flex-col gap-12 h-full">
            <div className="flex flex-col gap-2">
              <span className="font-editorial font-medium text-2xl lg:text-3xl tracking-tight leading-none text-on-surface">Motion<br/><span className="text-primary-fixed">Subtitle</span></span>
            </div>
            
            <nav className="flex-1 flex flex-col gap-4 lg:gap-8 overflow-y-auto custom-scrollbar pt-4" data-lenis-prevent="true">
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
                  className={`flex flex-col items-start gap-2 transition-all duration-500 group ${activeTool === tool.id ? 'opacity-100 translate-x-2' : 'opacity-40 hover:opacity-100'}`}
                >
                  <span className={`text-[10px] font-grotesk tracking-widest transition-colors uppercase ${activeTool === tool.id ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`}>0{i+1}</span>
                  <span className={`font-grotesk font-medium text-sm lg:text-xl tracking-tight text-left ${activeTool === tool.id ? 'text-on-surface' : 'text-muted-foreground group-hover:text-on-surface'}`}>{tool.label}</span>
                </button>
              ))}
            </nav>

            <div className="flex flex-col gap-4 mt-auto pb-4">
              {inStudio && currentStep < 6 && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setStep(1); setCurrentProject(null as any); setEditorSegments([]); }}
                    className="flex items-center gap-3 p-2 lg:px-4 lg:py-3 text-xs font-medium text-muted-foreground hover:text-on-surface hover:bg-surface-container-low transition-all rounded-md"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden lg:inline tracking-wide">Reset Project</span>
                  </button>
                  <button
                    onClick={handleRender}
                    disabled={isProcessing || editorSegments.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-on-surface text-surface-container-lowest font-medium text-xs lg:text-sm tracking-wide hover:bg-primary-fixed hover:text-surface-container-lowest transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-md"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden lg:inline">Export Video</span>
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
            {/* Background elements removed for cleaner professional look */}

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative z-10 flex flex-col items-center w-full max-w-2xl p-16 border border-border/10 bg-surface-container-lowest transition-all duration-700 ease-out ${isDragging ? 'scale-[1.02] bg-surface-container-low border-primary/50' : 'hover:border-border/30 hover:bg-surface-container-low'}`}
            >
              <h3 className="font-editorial text-4xl font-medium tracking-tight mb-4 text-on-surface">Upload Video</h3>
              <p className="text-muted-foreground text-center text-sm mb-12 max-w-sm font-grotesk">
                Drag and drop your footage or click to browse. MP4, MOV, WebM.
              </p>

              <input
                type="file" accept="video/*"
                className="hidden" ref={fileInputRef}
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                disabled={isProcessing}
              />

              {isProcessing ? (
                <div className="w-full flex flex-col items-center gap-6">
                  <ShiningText text={processingMsg || 'Processing...'} className="font-editorial text-2xl font-medium tracking-tight text-primary" />
                  <div className="w-full h-px bg-border/10 overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="font-grotesk text-[10px] text-muted-foreground tracking-widest uppercase">{uploadProgress}%</span>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-10 py-4 font-grotesk font-medium text-sm bg-on-surface text-surface-container-lowest tracking-wide hover:bg-primary-fixed hover:text-surface-container-lowest transition-colors rounded-md"
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
            {/* Background elements removed for cleaner professional look */}
            
            <div className="relative z-10 flex flex-col items-center w-full max-w-lg p-12 border border-border/10 bg-surface-container-lowest">
              {currentProject?.videoUrl && (
                <div className="w-full mb-8 overflow-hidden bg-black border border-border/10 rounded-md">
                  <video
                    src={`${BACKEND}${currentProject.videoUrl}?token=${token}`}
                    className="w-full h-full object-contain opacity-70"
                    style={{ maxHeight: '200px' }}
                    muted playsInline
                  />
                </div>
              )}

              <h3 className="font-editorial text-3xl font-medium tracking-tight mb-2 text-on-surface">Transcription</h3>
              <p className="text-muted-foreground text-center text-xs mb-8 uppercase tracking-widest font-grotesk">
                Select Language Context
              </p>

              <select
                value={transcribeLang}
                onChange={e => setTranscribeLang(e.target.value)}
                disabled={isProcessing}
                className="w-full p-4 mb-8 bg-surface-container-low font-grotesk text-sm text-on-surface border border-border/10 outline-none focus:border-primary/50 transition-colors appearance-none text-center tracking-wide cursor-pointer rounded-md"
              >
                <option value="auto">Auto-Detect Language</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hi-Latn">Hinglish</option>
                <option value="es">Spanish</option>
              </select>

              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <ShiningText text={processingMsg || 'Analyzing...'} className="font-editorial text-2xl font-medium tracking-tight text-primary" />
                  <span className="font-grotesk text-[10px] text-muted-foreground tracking-widest uppercase">
                    {transcribeElapsed}s elapsed — you can leave this tab open
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => handleTranscribe(transcribeFailed)}
                  className="w-full px-8 py-4 font-grotesk font-medium text-sm bg-on-surface text-surface-container-lowest tracking-wide hover:bg-primary-fixed hover:text-surface-container-lowest transition-colors rounded-md"
                >
                  {transcribeFailed ? 'Retry Transcription' : 'Generate Captions'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Steps 3–7: Stage */}
        {inStudio && (
          <div className="flex-1 min-h-0 flex flex-col relative z-10">
            {/* Video Canvas Container */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-4 lg:p-8">
              <div
                className="relative flex-shrink-0 border border-border/10 bg-surface-container-lowest rounded-md overflow-hidden shadow-2xl shadow-black/50"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              >
                <CompositedPreview />

                {/* Overlays */}
                {currentStep === 6 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/90 backdrop-blur-md gap-8">
                    <ShiningText text="Rendering" className="font-editorial text-4xl font-medium tracking-tight text-primary" />
                    <RenderSnakeGame />
                  </div>
                )}
                {isProcessing && currentStep === 3 && (
                  <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 backdrop-blur-md">
                    <ShiningText text={processingMsg || 'Applying...'} className="font-editorial text-2xl font-medium tracking-tight text-on-surface" />
                  </div>
                )}
              </div>
            </div>

            {/* Player Controls */}
            {currentStep !== 6 && currentStep !== 7 && (
              <div className="flex-shrink-0 h-16 mt-2 border border-border/10 flex items-center gap-6 px-6 mx-auto w-full max-w-3xl bg-surface-container-lowest rounded-md shadow-lg shadow-black/20">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-on-surface text-surface-container-lowest hover:bg-primary-fixed hover:text-surface-container-lowest transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-1" />}
                </button>

                <span className="text-[10px] font-grotesk tracking-widest text-muted-foreground w-12 text-right">{fmt(currentTime)}</span>

                <div
                  ref={seekBarRef}
                  className="flex-1 relative h-2 cursor-pointer group flex items-center"
                  onClick={handleSeek}
                >
                  <div className="absolute top-1/2 left-0 w-full h-px bg-border/20 -translate-y-1/2" />
                  <div
                    className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 transition-all ease-linear"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1/2 cursor-grab active:cursor-grabbing"
                    style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                  />
                </div>

                <span className="text-[10px] font-grotesk tracking-widest text-muted-foreground w-12">{fmt(duration)}</span>
              </div>
            )}
            
            {/* Step 7 Download */}
            {currentStep === 7 && currentProject && (
                <div className="flex-shrink-0 mt-4 flex items-center justify-between p-6 border border-border/10 mx-auto w-full max-w-3xl bg-surface-container-lowest rounded-md shadow-lg">
                  <div>
                    <h4 className="font-editorial text-2xl font-medium tracking-tight text-on-surface capitalize">Render Complete</h4>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => { useAppStore.getState().setStep(3); useAppStore.getState().setIsPlaying(false); }}
                      className="px-6 py-3 text-xs font-grotesk font-medium tracking-wide text-muted-foreground hover:text-on-surface transition-colors"
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
                      className="px-6 py-3 bg-on-surface text-surface-container-lowest text-xs font-grotesk font-medium tracking-wide hover:bg-primary-fixed transition-colors rounded-md"
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
        <aside className="w-[320px] lg:w-[420px] flex-shrink-0 flex flex-col border-l border-border/5 bg-surface-container-low relative z-20">
          <div className="p-8 lg:p-12 pb-6 flex justify-between items-end relative overflow-hidden">
             <h2 className="font-editorial font-medium text-3xl lg:text-5xl tracking-tight text-on-surface capitalize leading-none relative z-10">{activeTool}</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-0" data-lenis-prevent="true">
              {activeTool === 'clips' && (
                <div className="px-8 lg:px-12 pb-8">
                  <p className="font-grotesk font-medium text-sm text-on-surface mb-2">Editor</p>
                  <p className="text-sm text-muted-foreground leading-relaxed font-grotesk">
                    Click any word to select. Hover to spotlight, hide, or change case.
                  </p>
                </div>
              )}
              <div className="px-8 lg:px-12 pb-12">
                {activeTool === 'clips' && <WordEditor />}
                {activeTool === 'templates' && <TemplateBrowser />}
                {activeTool === 'typography' && <TypographyPanel />}
                {activeTool === 'color' && <ColorPanel />}
                {activeTool === 'layout' && <LayoutPanel />}
                {activeTool === 'animation' && <AnimationPanel />}
                {activeTool === 'numbers' && <NumbersPanel />}
                {activeTool === 'depth' && <DepthPanel />}
              </div>
          </div>
          <div className="p-8 lg:px-12 pt-4 bg-surface-container-low">
            {activeTool !== 'clips' && activeTool !== 'templates' && <ResetControlsButton />}
          </div>
        </aside>
      )}
    </div>
  );
}
