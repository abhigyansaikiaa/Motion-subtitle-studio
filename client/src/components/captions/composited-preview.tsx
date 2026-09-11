import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export function CompositedPreview() {
  const currentProject = useAppStore(state => state.currentProject);
  const token = useAppStore(state => state.token) || localStorage.getItem('rt_token');
  const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
  const rawVideoUrl = currentProject?.videoUrl;
  const videoUrl = rawVideoUrl
    ? (rawVideoUrl.startsWith('http') ? rawVideoUrl : `${backendUrl}${rawVideoUrl}?token=${token}`)
    : undefined;

  const isPlaying = useAppStore(state => state.isPlaying);
  const setCurrentTime = useAppStore(state => state.setCurrentTime);
  const setDuration = useAppStore(state => state.setDuration);
  const selectedStyleId = useAppStore(state => state.selectedStyleId);
  const customOverrides = useAppStore(state => state.customOverrides);

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

  // Segmentation
  const [depthEnabled, setDepthEnabled] = useState(false);
  useEffect(() => {
    setDepthEnabled(captionDepth === 'behind-subject' || captionDepth === 'mixed');
  }, [captionDepth]);

  const results = useSegmentation(videoRef.current, depthEnabled);

  // Video playback sync
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      updateRect();
    }
  };

  // Provide exact time to CaptionEngine without React state lag
  const getVideoTime = useCallback(() => {
    return videoRef.current?.currentTime ?? 0;
  }, []);

  // Sync store time periodically for UI (scrubber), but NOT for captions
  useEffect(() => {
    if (!isPlaying) return;
    let raf: number;
    const sync = () => {
      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, setCurrentTime]);

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
      <video
        ref={videoRef}
        src={videoUrl || undefined}
        className="absolute inset-0 w-full h-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
        crossOrigin="anonymous"
      />

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

