import React, { useEffect, useState } from 'react';
import type { TemplateDefinition } from '../../lib/types';

const DEFAULT_WORDS = ['MAKE', 'EVERY', 'WORD', 'MOVE', 'WITH', 'THE', 'STORY'];

interface LiveCaptionPreviewProps {
  template: TemplateDefinition;
  /** Words to animate. Defaults to the brand line. */
  words?: string[];
  /** ms each word stays active */
  wordMs?: number;
  /** Cap the hero scale so huge multipliers stay composed in small cards */
  maxHeroScale?: number;
  className?: string;
}

/**
 * A live, self-running caption preview driven by a REAL TemplateDefinition —
 * the same fonts, colors, hero treatment and text transform the studio uses.
 * The active word cycles on a loop; everything else is pure CSS transition.
 */
export function LiveCaptionPreview({
  template: t,
  words = DEFAULT_WORDS,
  wordMs = 600,
  maxHeroScale = 1.5,
  className = '',
}: LiveCaptionPreviewProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % words.length), wordMs);
    return () => clearInterval(id);
  }, [words.length, wordMs]);

  const isPop = t.wordActivation === 'pop';
  // For 'pop' templates the punch peaks at activeScale (capped 1.15); for
  // 'scale-up' templates the hero scale is the held emphasis size.
  const heroScale = isPop
    ? Math.min(t.activeScale ?? 1.12, 1.15)
    : Math.min(t.heroScale || 1.25, maxHeroScale);
  const heroFamily = t.heroFontFamily || t.fontFamily;
  const heroWeight = t.heroFontWeight ?? t.fontWeight;
  const heroStyle = t.heroFontStyle || t.fontStyle;

  const origin =
    t.alignment === 'left' ? 'left center' : t.alignment === 'right' ? 'right center' : 'center';

  return (
    <div
      className={`flex flex-wrap items-baseline justify-center gap-x-[0.28em] gap-y-[0.12em] ${className}`}
      style={{
        fontFamily: t.fontFamily,
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle as React.CSSProperties['fontStyle'],
        textTransform: t.textTransform,
        letterSpacing: t.letterSpacing,
        lineHeight: t.lineHeight,
        textAlign: t.alignment,
      }}
      aria-label={`Animated preview of the ${t.name} caption style`}
    >
      {words.map((w, i) => {
        const isActive = i === active;
        const scaleActive = t.wordActivation === 'scale-up' || isPop;
        // Compensate the pop scale with side margins so the enlarged hero word
        // pushes its neighbours aside instead of mashing into their glyphs.
        const pushEm =
          isActive && scaleActive && heroScale > 1
            ? `${(0.35 * (heroScale - 1) * w.length).toFixed(2)}em`
            : undefined;
        return (
          <span
            key={isActive ? `a-${active}` : `w-${i}`}
            className={isActive ? 'animate-caption-pop' : undefined}
            style={{
              display: 'inline-block',
              transformOrigin: origin,
              // Scale is owned by the caption-pop keyframes via --pop-scale (fill both).
              ['--pop-scale' as string]: isActive ? (scaleActive ? heroScale : 1) : 1,
              animationFillMode: isActive ? 'both' : undefined,
              marginLeft: pushEm,
              marginRight: pushEm,
              position: isActive ? 'relative' : undefined,
              zIndex: isActive ? 10 : undefined,
              color: isActive ? t.heroColor : t.baseColor,
              opacity: isActive ? 1 : t.baseOpacity,
              fontFamily: isActive ? heroFamily : undefined,
              fontWeight: isActive ? heroWeight : undefined,
              fontStyle: (isActive ? heroStyle : undefined) as React.CSSProperties['fontStyle'],
              textShadow: isActive ? t.shadow : undefined,
              WebkitTextStroke: isActive ? t.outline : undefined,
              transition: 'color 0.25s ease, opacity 0.25s ease',
              willChange: 'transform',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}
