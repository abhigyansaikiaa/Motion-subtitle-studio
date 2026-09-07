import React from 'react';
import { StudioWorkflow } from '../components/studio/studio-workflow';
import { Navbar } from '../components/marketing/navbar';

export function StudioPage() {
  return (
    <div className="h-screen bg-surface-container-lowest flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16 flex flex-col min-h-0">
        <StudioWorkflow />
      </main>
    </div>
  );
}
