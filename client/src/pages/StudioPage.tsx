import React from 'react';
import { StudioWorkflow } from '../components/studio/studio-workflow';

export function StudioPage() {
  return (
    <div className="h-screen bg-surface-container-lowest flex flex-col font-grotesk text-on-surface selection:bg-primary selection:text-on-primary">
      <main className="flex-1 flex flex-col min-h-0 relative">
        <StudioWorkflow />
      </main>
    </div>
  );
}
