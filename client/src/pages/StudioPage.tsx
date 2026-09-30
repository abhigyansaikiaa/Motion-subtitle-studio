import React from 'react';
import { StudioWorkflow } from '../components/studio/studio-workflow';

export function StudioPage() {
  return (
    <div className="h-screen bg-surface-container-lowest flex flex-col font-grotesk text-on-surface selection:bg-primary selection:text-on-primary">
      <main className="flex-1 flex flex-col min-h-0 bg-noise relative">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] mix-blend-overlay"></div>
        <StudioWorkflow />
      </main>
    </div>
  );
}
