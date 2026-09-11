import React, { useEffect, useState } from 'react';
import { CaptionEngine } from '../captions/caption-engine';
import { useAppStore } from '../../lib/store';
import { TEMPLATES } from '../../lib/templates';
import { api } from '../../lib/api';

export function RenderView() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [depth, setDepth] = useState<'front' | 'behind'>('front');
  const [project, setProject] = useState<any>(null);
  
  // Keep render time in a ref to avoid React state re-renders during Puppeteer export
  const renderTimeRef = React.useRef(0);

  useEffect(() => {
    const hashSplit = window.location.hash.split('?');
    const params = new URLSearchParams(hashSplit[1] || '');
    const pid = params.get('projectId');
    const d = params.get('depth') as 'front' | 'behind';
    const tokenParam = params.get('token');
    
    setProjectId(pid);
    if (d) setDepth(d);

    if (tokenParam) {
      useAppStore.getState().setToken(tokenParam);
    }

    if (pid) {
      // Fetch project from API since the render view runs in Puppeteer and won't have local state
      api.getProjects().then(res => {
        const fetched = res.projects.find((x: any) => x.id === pid);
        if (fetched) setProject(fetched);
      });
    }

    // Expose setRenderTime to Puppeteer
    (window as any).setRenderTime = (t: number) => {
      renderTimeRef.current = t;
      // Trigger CaptionEngine sync immediately
      if ((window as any).__syncCaptionTime) {
         (window as any).__syncCaptionTime(t);
      }
    };

    // Tell Puppeteer we are ready
    setTimeout(() => {
      (window as any).renderReady = true;
    }, 1000); // Give fonts time to load
  }, []);

  if (!project) return null;

  const styleId = project.style || 'classic';
  const baseTemplate = TEMPLATES.find(t => t.id === styleId) || TEMPLATES[0];
  
  // Try to parse customOverrides if it's a string, or use directly if object
  let customOverrides = {};
  if (project.customOverrides) {
    if (typeof project.customOverrides === 'string') {
        try { customOverrides = JSON.parse(project.customOverrides); } catch (e) {}
    } else {
        customOverrides = project.customOverrides;
    }
  }
  
  const template = { ...baseTemplate, ...customOverrides };
  
  // We explicitly want no background on the document for transparent WebM recording
  document.body.style.backgroundColor = 'transparent';
  document.body.style.margin = '0';
  document.documentElement.style.backgroundColor = 'transparent';

  return (
    <div style={{ width: 1080, height: 1920, position: 'relative', overflow: 'hidden' }}>
      <CaptionEngine 
        segments={project.segments || []} 
        template={template} 
        targetDepth={depth} 
        compositionWidth={1080}
        compositionHeight={1920}
        scale={1}
        getVideoTime={() => renderTimeRef.current}
      />
    </div>
  );
}
