import { useEffect, useRef, useState } from 'react';

// Use globally loaded SelfieSegmentation from index.html script tag
declare const window: any;
type Results = any;

export function useSegmentation(videoElement: HTMLVideoElement | null, enabled: boolean) {
  const [segmentationResults, setSegmentationResults] = useState<Results | null>(null);
  const segmentationRef = useRef<any | null>(null);
  const requestAnimationId = useRef<number | null>(null);
  const lastTimeProcessed = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !videoElement) {
      if (segmentationRef.current) {
        segmentationRef.current.close();
        segmentationRef.current = null;
      }
      if (requestAnimationId.current) {
        cancelAnimationFrame(requestAnimationId.current);
        requestAnimationId.current = null;
      }
      return;
    }

    if (!segmentationRef.current && window.SelfieSegmentation) {
      const selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
      });
      
      selfieSegmentation.setOptions({
        modelSelection: 1, // 1 for landscape/general, 0 for fast
      });

      selfieSegmentation.onResults((results: any) => {
        setSegmentationResults(results);
      });

      segmentationRef.current = selfieSegmentation;
    }

    const processFrame = async () => {
      if (!videoElement || videoElement.paused || videoElement.ended || !enabled) {
        requestAnimationId.current = requestAnimationFrame(processFrame);
        return;
      }

      // Process if current time has changed (avoids running on same frame over and over)
      if (videoElement.currentTime !== lastTimeProcessed.current) {
        try {
          await segmentationRef.current?.send({ image: videoElement });
          lastTimeProcessed.current = videoElement.currentTime;
        } catch (e) {
          console.error("MediaPipe segmentation error:", e);
        }
      }
      
      requestAnimationId.current = requestAnimationFrame(processFrame);
    };

    requestAnimationId.current = requestAnimationFrame(processFrame);

    return () => {
      if (requestAnimationId.current) {
        cancelAnimationFrame(requestAnimationId.current);
        requestAnimationId.current = null;
      }
    };
  }, [videoElement, enabled]);

  return segmentationResults;
}
