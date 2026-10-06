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
  const isJump = t.wordActivation === 'jump';
  const isWave = t.wordActivation === 'wave';
  const isHighlight = t.wordActivation === 'highlight';
  const isSolo = t.layoutType === 'solo-word';
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

  // Solo-word templates show ONLY the active word, huge — like the real layout.
  if (isSolo) {
    const w = words[active % words.length];
    const soloFam = t.heroFontFamily || t.fontFamily;
    const soloWt = t.heroFontWeight ?? t.fontWeight;
    const soloSt = t.heroFontStyle || t.fontStyle;
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        aria-label={`Animated preview of the ${t.name} caption style`}
      >
        <span
          key={`solo-${active}`}
          className="animate-caption-pop inline-block whitespace-nowrap"
          style={{
            fontFamily: soloFam,
            fontWeight: soloWt,
            fontStyle: soloSt as React.CSSProperties['fontStyle'],
            color: t.heroColor,
            textTransform: t.textTransform,
            letterSpacing: t.letterSpacing,
            lineHeight: t.lineHeight,
            textShadow: t.shadow && t.shadow !== 'none' ? t.shadow : undefined,
            fontSize: '2.2em',
          }}
        >
          {w}
        </span>
      </div>
    );
  }

  // Scattered-words templates: rolling window of recent words at scattered
  // positions, newest largest — mirrors the real ScatteredWordsLayout.
  if (t.layoutType === 'scattered-words') {
    const WIN = 5;
    const vis: string[] = [];
    for (let k = WIN - 1; k >= 0; k--) {
      vis.push(words[(((active - k) % words.length) + words.length) % words.length]);
    }
    const scatFam = t.heroFontFamily || t.fontFamily;
    const scatWt = t.heroFontWeight ?? t.fontWeight;
    const scatSt = t.heroFontStyle || t.fontStyle;
    const hashN = (n: number) => {
      let h = (n * 2654435761) >>> 0;
      h ^= h >>> 15;
      h = Math.imul(h, 2246822519);
      h ^= h >>> 13;
      return (h >>> 0) / 4294967295;
    };
    return (
      <div
        className={`relative w-full h-full min-h-[120px] overflow-hidden ${className}`}
        aria-label={`Animated preview of the ${t.name} caption style`}
      >
        {vis.map((w, i) => {
          const age = vis.length - 1 - i;
          const left = 4 + hashN(i * 2 + 1) * 60;
          const top = 6 + hashN(i * 2 + 101) * 68;
          const scale = Math.pow(0.7, age);
          return (
            <span
              key={`scat-${active}-${i}`}
              className="animate-caption-pop absolute whitespace-nowrap"
              style={{
                left: `${left.toFixed(1)}%`,
                top: `${top.toFixed(1)}%`,
                fontFamily: scatFam,
                fontWeight: scatWt,
                fontStyle: scatSt as React.CSSProperties['fontStyle'],
                color: t.heroColor,
                opacity: Math.max(0.25, 1 - age * 0.24),
                zIndex: 20 - age,
                letterSpacing: t.letterSpacing,
                lineHeight: t.lineHeight,
                textShadow: t.shadow && t.shadow !== 'none' ? t.shadow : undefined,
                fontSize: `${(1.9 * scale).toFixed(2)}em`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    );
  }

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
        const scaleActive = t.wordActivation === 'scale-up' || isPop || isJump;
        const hlActive = isActive && isHighlight;
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
              backgroundColor: hlActive ? (t.highlightColor ?? '#F5D020') : undefined,
              padding: hlActive
                ? `${t.highlightPadY ?? 3}px ${t.highlightPadX ?? 10}px`
                : undefined,
              borderRadius: hlActive ? `${t.highlightRadius ?? 5}px` : undefined,
              fontFamily: isActive ? heroFamily : undefined,
              fontWeight: isActive ? heroWeight : undefined,
              fontStyle: (isActive ? heroStyle : undefined) as React.CSSProperties['fontStyle'],
              textShadow: isActive ? t.shadow : undefined,
              WebkitTextStroke: isActive ? t.outline : undefined,
              transition: 'color 0.25s ease, opacity 0.25s ease',
              willChange: 'transform',
            }}
          >
            {isWave ? (
              <>
                <style>{`@keyframes vc-wave { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.28em); } }`}</style>
                {w.split('').map((ch, ci) => (
                  <span
                    key={ci}
                    style={{
                      display: 'inline-block',
                      animation: 'vc-wave 1.1s ease-in-out infinite',
                      animationDelay: `${(ci * 0.09).toFixed(2)}s`,
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </>
            ) : (
              w
            )}
          </span>
        );
      })}
    </div>
  );
}
