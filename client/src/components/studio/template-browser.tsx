import React, { useState } from 'react';
import { TEMPLATES } from '../../lib/templates';
import { useAppStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { Check, Flame } from 'lucide-react';

// Map layoutType → category label
function categoryOf(t: { layoutType: string }): string {
  switch (t.layoutType) {
    case 'editorial':
    case 'hero-micro':
      return 'Editorial';
    case 'stacked':
    case 'vertical-stack':
      return 'Stacked';
    case 'asymmetric':
    case 'corner-hero':
      return 'Poster';
    case 'hero-interruption':
    case 'word-collision':
    case 'kinetic':
    case 'split-hero':
      return 'Dynamic';
    case 'giant-bg':
    case 'cinematic':
    case 'sentence-hero':
      return 'Cinematic';
    default:
      return 'Inline';
  }
}

const ALL_CATS = ['All', 'Editorial', 'Inline', 'Stacked', 'Poster', 'Dynamic', 'Cinematic'];

export function TemplateBrowser() {
  const selectedStyleId    = useAppStore(s => s.selectedStyleId);
  const setSelectedStyleId = useAppStore(s => s.setSelectedStyleId);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const displayed = TEMPLATES.filter(t =>
    (activeCategory === 'All' || categoryOf(t) === activeCategory) &&
    (searchQuery === '' || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.fontFamily.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Search + category filter */}
      <div className="px-4 pt-4 pb-3 space-y-3 flex-shrink-0">
        <input
          type="text"
          placeholder="Search templates or fonts"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors"
        />
        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {ALL_CATS.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide transition-all border',
                activeCategory === cat
                  ? 'bg-foreground text-background border-foreground'
                  : 'text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {displayed.map(t => {
          const isSelected = selectedStyleId === t.id;
          const cat = categoryOf(t);
          return (
            <button
              key={t.id}
              data-testid={`template-card-${t.id}`}
              onClick={() => setSelectedStyleId(t.id)}
              className={cn(
                'relative w-full rounded-xl overflow-hidden text-left transition-all group border',
                isSelected
                  ? 'border-foreground/60 shadow-[0_0_0_2px_rgba(255,255,255,0.15)]'
                  : 'border-border hover:border-foreground/25'
              )}
            >
              {/* Preview card — styled "screen" */}
              <div
                className="w-full flex flex-col items-center justify-center py-6 px-4 select-none"
                style={{
                  background: 'linear-gradient(160deg, #0d0d14 0%, #0a0a10 100%)',
                  minHeight: '108px',
                }}
              >
                {/* Category badge(s) top right */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className="text-[9px] font-bold tracking-[0.12em] px-2 py-0.5 rounded-full border border-white/10 text-white/40 uppercase">
                    {cat}
                  </span>
                </div>

                {/* Caption preview: editorial layout */}
                {t.layoutType === 'editorial' ? (
                  <div
                    className="flex flex-col items-center gap-0.5"
                    style={{ fontFamily: t.fontFamily, fontStyle: t.fontStyle }}
                  >
                    {/* Supporting text */}
                    <span style={{ fontSize: '11px', color: t.baseColor, fontWeight: t.fontWeight, opacity: 0.85 }}>
                      this is
                    </span>
                    {/* Hero word */}
                    <span style={{
                      fontSize: `${11 * (t.heroScale ?? 2.0)}px`,
                      color: t.heroColor,
                      fontFamily: t.heroFontFamily ?? t.fontFamily,
                      fontWeight: t.heroFontWeight ?? t.fontWeight,
                      fontStyle: t.heroFontStyle ?? t.fontStyle,
                      lineHeight: 1.0,
                    }}>
                      {t.name}
                    </span>
                    <span style={{ fontSize: '11px', color: t.baseColor, fontWeight: t.fontWeight, opacity: 0.85 }}>
                      template
                    </span>
                  </div>
                ) : (
                  /* Standard inline preview */
                  <div
                    className="leading-tight break-words max-w-full text-center"
                    style={{
                      fontFamily: t.fontFamily,
                      fontWeight: t.fontWeight,
                      fontStyle: t.fontStyle,
                      textTransform: t.textTransform as any,
                      fontSize: '13px',
                      lineHeight: 1.2,
                    }}
                  >
                    <span style={{ color: t.baseColor }}>Captions </span>
                    <span style={{ color: t.heroColor, fontSize: `${13 * Math.min(t.heroScale, 1.5)}px` }}>
                      that slap
                    </span>
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: 'rgba(18,18,26,0.98)' }}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-foreground">{t.name}</span>
                    {t.id === 'editorial' && <Flame className="w-3 h-3 text-orange-400" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1 leading-snug">{t.description}</p>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center flex-shrink-0 ml-2">
                    <Check className="w-3.5 h-3.5 text-background" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
