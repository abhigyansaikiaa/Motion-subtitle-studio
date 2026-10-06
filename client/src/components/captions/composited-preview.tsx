import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { getTemplate } from '../../lib/templates';
import { useSegmentation } from './segmentation-engine';
import { CaptionEngine } from './caption-engine';

/**
 * Computes the actual visible video rectangle inside a container
 * when the video uses object-fit: contain (letterboxing).
 *
 * Returns { left, top, width, height, scale } in container-relative px,
 * where scale = visible video height / native video height.
 *
 * This is the ONLY source of truth for caption coordinate space.
 */
function computeVideoRect(
  containerW: number,
  containerH: number,
  videoNativeW: number,
  videoNativeH: number,
): { left: number; top: number; width: number; height: number; scale: number } {
  if (!videoNativeW || !videoNativeH || !containerW || !containerH) {
    return { left: 0, top: 0, width: containerW, height: containerH, scale: 1 };
  }
  const containerAspect = containerW / containerH;
  const videoAspect = videoNativeW / videoNativeH;

  let width: number;
  let height: number;

  if (videoAspect > containerAspect) {
    // Video wider than container - black bars on top/bottom
    width = containerW;
    height = containerW / videoAspect;
  } else {
    // Video taller or equal - black bars on left/right
    height = containerH;
    width = containerH * videoAspect;
  }

  const left = (containerW - width) / 2;
  const top = (containerH - height) / 2;
  // scale relative to native video height (templates use native px as reference)
  const scale = height / videoNativeH;

  return { left, top, width, height, scale };
}

interface VideoRect {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  nativeW: number;
  nativeH: number;
}

const NULL_RECT: VideoRect = { left: 0, top: 0, width: 0, height: 0, scale: 1, nativeW: 0, nativeH: 0 };

const MemoizedVideo = React.memo(({ videoUrl, onLoadedMetadata, onEnded, onPlay, onPause, onWaiting, onPlaying, onCanPlay, onError, videoRef }: any) => {
  return (
    <video
      ref={videoRef}
      src={videoUrl || undefined}
      className="absolute inset-0 w-full h-full object-contain"
      onLoadedMetadata={onLoadedMetadata}
      onEnded={onEnded}
      onPlay={onPlay}
      onPause={onPause}
      onWaiting={onWaiting}
      onPlaying={onPlaying}
      onCanPlay={onCanPlay}
      onError={onError}
      playsInline
      preload="auto"
      crossOrigin="anonymous"
    />
  );
}, (prev, next) => prev.videoUrl === next.videoUrl);


export function CompositedPreview() {
  const currentProject = useAppStore(state => state.currentProject);
  const token = useAppStore(state => state.token) || localStorage.getItem('rt_token');
  const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
  const rawVideoUrl = currentProject?.videoUrl;
  // Build the playable URL ONCE per video. The auth token is captured at that
  // moment on purpose: Supabase rotates tokens (TOKEN_REFRESHED fires on an
  // interval and whenever the tab regains focus). Rebuilding this URL on every
  // token change would swap the <video> src mid-playback — the element reloads
  // and the video "pauses itself". If the baked-in token ever goes stale the
  // error handler below rebuilds the URL once with the fresh token.
  const tokenUsedInUrl = useRef<string | null>(null);
  const [urlBuster, setUrlBuster] = useState(0);
  const videoUrl = useMemo(() => {
    if (!rawVideoUrl) return undefined;
    const tok = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('rt_token') : null);
    tokenUsedInUrl.current = tok;
    return rawVideoUrl.startsWith('http') ? rawVideoUrl : `${backendUrl}${rawVideoUrl}?token=${tok}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawVideoUrl, urlBuster]);

  const isPlaying = useAppStore(state => state.isPlaying);
  const currentTime = useAppStore(state => state.currentTime);
  const setCurrentTime = useAppStore(state => state.setCurrentTime);
  const setDuration = useAppStore(state => state.setDuration);
  const selectedStyleId = useAppStore(state => state.selectedStyleId);
  const customOverrides = useAppStore(state => state.customOverrides);
  const setIsPlaying = useAppStore(state => state.setIsPlaying);

  const captionDepth = customOverrides.captionDepth || getTemplate(selectedStyleId).captionDepth;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Video rect: the actual visible video pixels inside the container
  const [videoRect, setVideoRect] = useState<VideoRect>(NULL_RECT);

  const updateRect = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const nativeW = video.videoWidth;
    const nativeH = video.videoHeight;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const rect = computeVideoRect(containerW, containerH, nativeW, nativeH);
    setVideoRect({ ...rect, nativeW, nativeH });
  }, []);

  // Update rect when video dimensions load and whenever the container resizes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener('loadedmetadata', updateRect);
    return () => video.removeEventListener('loadedmetadata', updateRect);
  }, [updateRect]);

  useEffect(() => {
    const ro = new ResizeObserver(updateRect);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateRect]);

  useEffect(() => {
    console.log("[DEBUG] CompositedPreview MOUNTED");
    return () => console.log("[DEBUG] CompositedPreview UNMOUNTED");
  }, []);

  useEffect(() => {
    console.log("[DEBUG] videoUrl changed:", videoUrl);
  }, [videoUrl]);

  // Segmentation
  const [depthEnabled, setDepthEnabled] = useState(false);
  useEffect(() => {
    setDepthEnabled(captionDepth === 'behind-subject' || captionDepth === 'mixed');
  }, [captionDepth]);

  const results = useSegmentation(videoRef.current, depthEnabled);

  // ── Playback truthfulness ──────────────────────────────────────────────
  // The store holds the user's INTENT (playing/paused). The <video> element
  // is the ground truth of what is actually happening. We sync both ways:
  //   store → element : the effect below calls play()/pause()
  //   element → store : native onPlay/onPause events update the store, so a
  //                     pause the browser initiates itself (interruption,
  //                     source reload, media-key, etc.) is reflected in the UI
  //                     instead of leaving the button stuck on "playing".
  // A `waiting`/`playing` pair drives a buffering spinner so slow networks
  // read as "loading", not as a mysterious auto-pause.
  const [isBuffering, setIsBuffering] = useState(false);
  const playRequestRef = useRef(0);
  // When the video errors (e.g. the baked-in auth token expired mid-session) we
  // rebuild the <video> src with a fresh token. Swapping src makes the browser
  // fire a native `pause` — without the guard below the video would sit paused
  // afterwards and look like it "paused itself". This ref remembers the
  // playback intent across that swap so we can resume on canplay.
  const resumeAfterRecoveryRef = useRef(false);

  // Video playback sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      // Mid-recovery (src was just swapped for a fresh token): the canplay
      // handler owns the resume. Firing play() here would be gesture-less, so
      // Chrome's autoplay policy may reject it — and the catch below would
      // then wrongly flip isPlaying to false ("paused itself").
      if (resumeAfterRecoveryRef.current) return;
      const id = ++playRequestRef.current;
      const p = video.play();
      if (p && typeof (p as Promise<void>).then === 'function') {
        (p as Promise<void>)
          .then(() => {
            // A pause requested after this play() must win the race.
            if (playRequestRef.current !== id) video.pause();
          })
          .catch(() => {
            // play() rejected (interrupted / not allowed) — the element is
            // paused, so tell the store the truth instead of showing "playing".
            // Never do this mid-recovery: a gesture-less play() rejected by
            // the autoplay policy is not the user's intent to pause.
            if (playRequestRef.current === id && !resumeAfterRecoveryRef.current) setIsPlaying(false);
          });
      }
    } else {
      playRequestRef.current++;
      // An explicit user pause cancels any pending post-recovery resume.
      resumeAfterRecoveryRef.current = false;
      video.pause();
    }
  }, [isPlaying, videoUrl, setIsPlaying]);

  // Native element events → store (element is ground truth)
  const handleNativePlay = useCallback(() => {
    resumeAfterRecoveryRef.current = false;
    setIsPlaying(true);
    setIsBuffering(false);
  }, [setIsPlaying]);
  const handleNativePause = useCallback(() => {
    // Ignore the pause the browser fires when WE swap src for token recovery —
    // playback is resumed on canplay. A genuine pause is never suppressed.
    if (resumeAfterRecoveryRef.current) return;
    setIsPlaying(false);
    setIsBuffering(false);
  }, [setIsPlaying]);
  const handleNativeWaiting = useCallback(() => setIsBuffering(true), []);
  const handleNativePlaying = useCallback(() => {
    resumeAfterRecoveryRef.current = false;
    setIsBuffering(false);
  }, []);
  const handleNativeCanPlay = useCallback(() => {
    setIsBuffering(false);
    if (resumeAfterRecoveryRef.current) {
      resumeAfterRecoveryRef.current = false;
      const video = videoRef.current;
      // Only resume if the user still intends to play (they may have paused
      // while the new source was loading).
      if (video && useAppStore.getState().isPlaying) {
        video.play().catch(() => {
          // Autoplay policy rejected the gesture-less resume: reflect the
          // truth (paused) so one user click resumes playback.
          setIsPlaying(false);
        });
      }
    }
  }, [setIsPlaying]);
  const handleNativeError = useCallback(() => {
    setIsBuffering(false);
    // If the auth token rotated since the URL was baked, media range requests
    // can start failing — rebuild the URL once with the fresh token.
    const fresh = useAppStore.getState().token
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('rt_token') : null);
    if (fresh && fresh !== tokenUsedInUrl.current) {
      // Capture the user's intent from the store (not the element's transient
      // paused flag — the failure itself may already have paused the element).
      resumeAfterRecoveryRef.current = useAppStore.getState().isPlaying;
      tokenUsedInUrl.current = fresh;
      setUrlBuster(b => b + 1);
    } else {
      // Not rebuilding (no fresher token) — make sure a stale flag can never
      // swallow a genuine pause later.
      resumeAfterRecoveryRef.current = false;
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      updateRect();
    }
  }, [setDuration, updateRect]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  // Provide exact time to CaptionEngine without React state lag
  const getVideoTime = useCallback(() => {
    return videoRef.current?.currentTime ?? 0;
  }, []);

  const seekRequest = useAppStore(state => state.seekRequest);
  const setSeekRequest = useAppStore(state => state.setSeekRequest);

  // Handle seeking ONLY from explicit seek requests, avoiding feedback loops
  useEffect(() => {
    const video = videoRef.current;
    if (!video || seekRequest === null) return;
    video.currentTime = seekRequest;
    setSeekRequest(null);
  }, [seekRequest, setSeekRequest]);

  // Sync store time periodically for UI (scrubber), but NOT for captions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      // Only update store if playing to avoid feedback loop with the seek effect above
      if (!video.paused) {
        setCurrentTime(video.currentTime);
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [setCurrentTime]);

  // Segmentation canvas drawing
  useEffect(() => {
    if (!depthEnabled || !results || !canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (canvas.width !== videoRef.current.videoWidth) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, [results, depthEnabled]);

  const hasRect = videoRect.width > 0 && videoRect.height > 0;



  return (
    // Outer black container - fills whatever space the editor allocates
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
    >
      {/* 1. Base video - fills outer container; object-fit:contain letterboxes it */}
      <MemoizedVideo
        videoRef={videoRef}
        videoUrl={videoUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={handleNativePlay}
        onPause={handleNativePause}
        onWaiting={handleNativeWaiting}
        onPlaying={handleNativePlaying}
        onCanPlay={handleNativeCanPlay}
        onError={handleNativeError}
      />

      {/* Buffering indicator — slow networks read as "loading", never as a phantom pause */}
      {isBuffering && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/*
       * VideoCompositionFrame
       * Positioned to EXACTLY cover the visible video pixels (accounting for
       * object-fit:contain letterboxing). All caption layers live inside here.
       *
       * "absolute inset-0" inside this div means "fill the video frame",
       * NOT "fill the outer container".
       *
       * We guard with hasRect so captions never flash in the wrong position
       * before the video's native dimensions are known.
       */}
      {hasRect && (
        <div
          data-testid="video-composition-frame"
          style={{
            position: 'absolute',
            left: videoRect.left,
            top: videoRect.top,
            width: videoRect.width,
            height: videoRect.height,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {/* 2. Background Captions Layer - behind subject */}
          {depthEnabled && (
            <CaptionEngine
              targetDepth="behind"
              compositionWidth={videoRect.nativeW}
              compositionHeight={videoRect.nativeH}
              scale={videoRect.scale}
              getVideoTime={getVideoTime}
            />
          )}

          {/* 3. Foreground Subject Mask (segmentation canvas) */}
          {depthEnabled && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}

          {/* 4. Foreground Captions Layer - in front of subject */}
          <CaptionEngine
            targetDepth={depthEnabled ? 'front' : 'all'}
            compositionWidth={videoRect.nativeW}
            compositionHeight={videoRect.nativeH}
            scale={videoRect.scale}
            getVideoTime={getVideoTime}
          />
        </div>
      )}
    </div>
  );
}

