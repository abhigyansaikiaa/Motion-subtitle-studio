import React from 'react';
import { TEMPLATES } from '../../lib/templates';

/**
 * Infinite marquee of the viral template names in huge outlined type.
 * Pure CSS animation (animate-marquee), pauses on hover.
 */
export function TemplateMarquee() {
  const viral = TEMPLATES.filter(t => t.category === 'Viral');
  const names = viral.map(t => t.name.toUpperCase());
  const row = [...names, ...names]; // duplicate for the -50% loop

  return (
    <div className="relative border-y border-foreground/15 bg-background py-8 md:py-10 overflow-hidden group">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {row.map((n, i) => (
          <span key={i} className="flex items-center shrink-0">
            <span
              className={`font-editorial font-extrabold uppercase whitespace-nowrap text-5xl md:text-7xl tracking-tight px-6 ${
                i % 2 === 0 ? 'text-stroke-thin text-foreground' : 'text-foreground/90'
              }`}
            >
              {n}
            </span>
            <span className="font-mono text-xs text-foreground/40 px-2">✳</span>
          </span>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  );
}
