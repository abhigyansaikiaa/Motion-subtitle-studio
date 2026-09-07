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
import {
  Upload, Play, Pause, Download, AlertCircle, RefreshCw,
  Sliders, LayoutGrid, Type, RotateCcw,
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BACKEND = 'http://127.0.0.1:3000';

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
const STEP_SEQUENCE = [1, 2, 3] as const;
const STEP_LABELS: Record<number, string> = { 1: 'Upload', 2: 'Transcribe', 3: 'Studio' };

function StepBar({ current }: { current: number }) {
  const uiStep = current >= 3 ? 3 : current;
  return (
    <div className="flex items-center gap-1">
      {STEP_SEQUENCE.map((s, i) => {
        const isActive = uiStep === s;
        const isPast   = uiStep > s;
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div className={`w-8 h-px mx-0.5 transition-all duration-500 ${isPast ? 'bg-foreground/30' : 'bg-border'}`} />
            )}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
              isActive
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
  const currentStep        = useAppStore(s => s.currentStep);
  const setStep            = useAppStore(s => s.setStep);
  const currentProject     = useAppStore(s => s.currentProject);
  const setCurrentProject  = useAppStore(s => s.setCurrentProject);
  const selectedStyleId    = useAppStore(s => s.selectedStyleId);
  const editorSegments     = useAppStore(s => s.editorSegments);
  const setEditorSegments  = useAppStore(s => s.setEditorSegments);
  const currentTime        = useAppStore(s => s.currentTime);
  const setCurrentTime     = useAppStore(s => s.setCurrentTime);
  const duration           = useAppStore(s => s.duration);
  const setDuration        = useAppStore(s => s.setDuration);
  const isPlaying          = useAppStore(s => s.isPlaying);
  const setIsPlaying       = useAppStore(s => s.setIsPlaying);
  const getActiveTemplate  = useAppStore(s => s.getActiveTemplate);

  const [uploadProgress,   setUploadProgress]  = useState(0);
  const [transcribeLang,   setTranscribeLang]  = useState('auto');
  const [isProcessing,     setIsProcessing]    = useState(false);
  const [processingMsg,    setProcessingMsg]   = useState('');
  const [error,            setError]           = useState<string | null>(null);
  const [isDragging,       setIsDragging]      = useState(false);
  const [activeTool,       setActiveTool]      = useState<ToolId>('templates');

  const videoRef    = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seekBarRef  = useRef<HTMLDivElement>(null);

  const activeTemplate = getActiveTemplate();
  const inStudio = currentStep >= 3 && currentStep <= 7 && !!currentProject;

  // ─── VIDEO EVENTS ─────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime  = () => setCurrentTime(video.currentTime);
    const onMeta  = () => { setDuration(video.duration); };
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [currentProject, setCurrentTime, setDuration, setIsPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying && video.paused)  video.play().catch(() => setIsPlaying(false));
    if (!isPlaying && !video.paused) video.pause();
  }, [isPlaying, setIsPlaying]);

  const lastSentRef = useRef(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - currentTime) > 0.3 && Math.abs(currentTime - lastSentRef.current) > 0.1) {
      video.currentTime = currentTime;
      lastSentRef.current = currentTime;
    }
  }, [currentTime]);

  // ─── UPLOAD ───────────────────────────────────────────────────────────────
  const processFile = async (file: File) => {
    if (!file.type.startsWith('video/')) { setError('Unsupported format. Please upload MP4, MOV, or WebM.'); return; }
    if (file.size > 200 * 1024 * 1024) { setError('Video exceeds 200 MB. Please compress and retry.'); return; }
    try {
      setIsProcessing(true); setError(null); setProcessingMsg('UPLOADING 0%');
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
            } catch { setCurrentProject(res.project); setEditorSegments([]); }
            setStep(3);
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
      const res = await api.render(currentProject.id, editorSegments, activeTemplate);
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
    lastSentRef.current = pct * duration;
  }, [duration, setCurrentTime]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const videoSrc = currentProject
    ? (currentStep === 7 && currentProject.downloadUrl
        ? BACKEND + currentProject.downloadUrl
        : BACKEND + currentProject.videoUrl)
    : undefined;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════════
          TOP NAV BAR
          ════════════════════════════════════════════════════════════════════ */}
      <header className="h-14 flex-shrink-0 border-b border-border bg-card z-20 flex items-center justify-between px-5">
        {/* Left: Brand + Steps */}
        <div className="flex items-center gap-6">
          <span
            className="text-[11px] font-bold tracking-[0.18em] uppercase text-foreground/70 select-none"
            style={{ fontFamily: '"Geist", sans-serif' }}
          >
            MOTION SUBTITLE
          </span>
          <div className="w-px h-5 bg-border" />
          <StepBar current={currentStep} />
        </div>

        {/* Right: Context-sensitive actions */}
        <div className="flex items-center gap-2">
          {inStudio && currentStep < 6 && (
            <>
              {/* Reset */}
              <button
                onClick={() => { setStep(1); setCurrentProject(null as any); setEditorSegments([]); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              {/* Render & Export CTA */}
              <button
                onClick={handleRender}
                disabled={isProcessing || editorSegments.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold bg-foreground text-background hover:opacity-85 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Render & Export
              </button>
            </>
          )}
          {currentStep === 7 && currentProject && (
            <a
              href={BACKEND + currentProject.downloadUrl}
              download={currentProject.filename}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold bg-foreground text-background hover:opacity-85 transition-all"
            >
              <Download className="w-4 h-4" />
              Download Video
            </a>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN BODY
          ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT COLUMN: CONTEXTUAL TOOLS ── */}
        {inStudio && (
          <aside
            className="w-[320px] flex-shrink-0 flex flex-col border-r border-border overflow-hidden bg-surface"
          >
            {activeTool === 'clips' && (
              <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
                <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase mb-1">
                  Clips List
                </p>
                <p className="text-[11px] text-muted-foreground/60 leading-snug">
                  Click any word to select. Hover to spotlight, hide, or change case.
                </p>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
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

        {/* ── CENTER COLUMN: STAGE ── */}
        <main className="flex-1 min-w-0 flex flex-col bg-background relative overflow-hidden">

          {/* Error toast */}
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-950/90 text-red-200 px-4 py-2.5 rounded-xl border border-red-500/40 shadow-xl max-w-sm text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-300 hover:text-white text-xs underline">×</button>
            </div>
          )}

          {/* ── STEP 1: UPLOAD ── */}
          {currentStep === 1 && (
            <div className="flex-1 flex items-center justify-center p-10">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center w-full max-w-lg p-12 rounded-2xl border-2 border-dashed transition-all duration-300 ${
                  isDragging
                    ? 'border-foreground/40 bg-foreground/5 scale-[1.01]'
                    : 'border-border bg-card/50 hover:border-foreground/20 hover:bg-card/80'
                }`}
              >
                {/* Background texture */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />

                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all ${isDragging ? 'bg-foreground/15 scale-110' : 'bg-card border border-border'}`}>
                  <Upload className={`w-7 h-7 transition-colors ${isDragging ? 'text-foreground' : 'text-muted-foreground'}`} />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2">Upload Your Video</h3>
                <p className="text-muted-foreground text-center text-sm leading-relaxed mb-8 max-w-xs">
                  Drag & drop or click to browse.<br />
                  MP4, MOV, WebM · up to 200 MB
                </p>

                <input
                  type="file" accept="video/*"
                  className="hidden" ref={fileInputRef}
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                  disabled={isProcessing}
                />

                {isProcessing ? (
                  <div className="w-full flex flex-col items-center gap-3">
                    <ShiningText text={processingMsg || 'UPLOADING...'} className="text-sm font-semibold text-foreground" />
                    <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{uploadProgress}%</span>
                  </div>
                ) : (
                  <button
                    id="select-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-8 py-3 rounded-full font-semibold text-sm bg-foreground text-background hover:opacity-80 transition-all"
                  >
                    Select File
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: TRANSCRIBE ── */}
          {currentStep === 2 && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="flex flex-col items-center w-full max-w-sm">

                {/* Video thumbnail */}
                {currentProject?.videoId && (
                  <div className="w-full mb-6 rounded-2xl overflow-hidden bg-black border border-border shadow-2xl" style={{ maxHeight: '220px' }}>
                    <video
                      src={`${BACKEND}/uploads/${currentProject.videoId}`}
                      className="w-full h-full object-contain"
                      style={{ maxHeight: '220px' }}
                      muted playsInline
                    />
                  </div>
                )}

                <h3 className="text-xl font-bold text-foreground mb-1">Generate Captions</h3>
                <p className="text-muted-foreground text-center text-sm mb-6 leading-relaxed">
                  Choose the spoken language for accurate word-level transcription.
                </p>

                <div className="w-full mb-4">
                  <label className="block text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">Language</label>
                  <select
                    value={transcribeLang}
                    onChange={e => setTranscribeLang(e.target.value)}
                    disabled={isProcessing}
                    className="w-full rounded-xl p-3 text-foreground bg-card border border-border outline-none text-sm focus:border-foreground/40 transition-colors"
                  >
                    <option value="auto">Auto-Detect</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="hi-Latn">Hinglish</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>

                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2 mt-2">
                    <ShiningText text={processingMsg || 'TRANSCRIBING...'} className="text-sm font-semibold text-foreground" />
                    <p className="text-xs text-muted-foreground">This may take 30–60 seconds</p>
                  </div>
                ) : (
                  <button
                    onClick={handleTranscribe}
                    className="w-full px-8 py-3 rounded-full font-semibold text-sm bg-foreground text-background hover:opacity-80 transition-all"
                  >
                    Generate Captions
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEPS 3–7: VIDEO STAGE ── */}
          {inStudio && (
            <div className="flex-1 min-h-0 flex flex-col p-6">

              {/* Video Canvas Container */}
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div
                  className="relative rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl"
                  style={{
                    width: '100%',
                    height: '100%',
                    background: '#000',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.2)',
                  }}
                >
                  <CompositedPreview />

                  {/* Rendering overlay */}
                  {currentStep === 6 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}>
                      <ShiningText text="RENDERING VIDEO..." className="text-2xl font-bold mb-3 text-white" />
                      <p className="text-white/40 text-sm">Burning captions into your video. This takes a moment.</p>
                    </div>
                  )}

                  {/* Processing overlay */}
                  {isProcessing && currentStep === 3 && (
                    <div className="absolute inset-0 flex items-center justify-center z-40" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                      <ShiningText text={processingMsg || 'APPLYING...'} className="text-xl font-bold text-white" />
                    </div>
                  )}

                  {/* No captions placeholder */}
                  {currentStep === 3 && editorSegments.length === 0 && !isProcessing && (
                    <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none">
                      <div className="text-white/40 text-sm px-4 py-2 rounded-full border border-white/10" style={{ background: 'rgba(0,0,0,0.6)' }}>
                        Caption preview will appear here
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Player Controls - Floating style for minimal UI */}
              {currentStep !== 6 && currentStep !== 7 && (
                <div
                  className="flex-shrink-0 h-14 mt-4 rounded-2xl border border-border flex items-center gap-4 px-5 mx-auto w-full max-w-2xl bg-surface shadow-sm"
                >
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary text-on-primary hover:opacity-90 transition-all shadow-sm"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>

                  <span className="text-xs font-mono text-muted-foreground w-10 text-right flex-shrink-0">{fmt(currentTime)}</span>

                  <div
                    ref={seekBarRef}
                    className="flex-1 relative h-1.5 bg-border rounded-full cursor-pointer group"
                    onClick={handleSeek}
                  >
                    <div
                      className="absolute top-0 left-0 h-full bg-primary rounded-full"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                    <div
                      className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1/2"
                      style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                    />
                  </div>

                  <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">{fmt(duration)}</span>

                  {/* hidden video element — CompositedPreview drives the actual display */}
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    className="hidden"
                    playsInline
                    muted
                    onLoadedMetadata={e => {
                      if (e.currentTarget.videoWidth) {
                        // aspect handled by CompositedPreview
                      }
                    }}
                  />
                </div>
              )}

              {/* Step 7: Download banner */}
              {currentStep === 7 && currentProject && (
                <div className="flex-shrink-0 mt-4 flex items-center justify-center gap-4 p-5 rounded-2xl border border-border bg-surface shadow-sm">
                  <div>
                    <div className="font-semibold text-foreground text-sm">✓ Render Complete</div>
                    <div className="text-muted-foreground text-xs mt-0.5">High-quality MP4 ready</div>
                  </div>
                  <button
                    onClick={() => { useAppStore.getState().setStep(3); useAppStore.getState().setIsPlaying(false); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all bg-background"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Edit Again
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT COLUMN: DESIGN WHEEL ── */}
        {inStudio && currentStep !== 6 && currentStep !== 7 && (
          <aside
            className="w-[380px] flex-shrink-0 flex flex-col bg-background relative"
          >
            <div className="absolute top-6 right-6 z-10 flex gap-2">
              {/* Optional top right actions could go here */}
            </div>
            
            <DesignWheel activeTool={activeTool} onSelectTool={setActiveTool} />
            
            <div className="absolute bottom-8 left-0 w-full px-8 text-center pointer-events-none">
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-[240px] mx-auto">
                Rotate the wheel to switch between tools.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
