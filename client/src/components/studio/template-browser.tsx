import React, { useState } from 'react';
import { TEMPLATES, getCuratedTemplates } from '../../lib/templates';
import { useAppStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { Check, Flame } from 'lucide-react';
import { LiveCaptionPreview } from '../marketing/live-caption';

// Map layoutType → category label
function categoryOf(t: { layoutType: string; category?: string }): string {
  // Prefer the template's own category (e.g. 'Viral') when declared,
  // otherwise derive a bucket from the layout type.
  if (t.category) return t.category;
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

const ALL_CATS = ['Dynamic', 'Viral', 'All', 'Editorial', 'Inline', 'Stacked', 'Poster', 'Cinematic', 'MOGRT'];

export function TemplateBrowser() {
  const selectedStyleId    = useAppStore(s => s.selectedStyleId);
  const setSelectedStyleId = useAppStore(s => s.setSelectedStyleId);
  const [activeCategory, setActiveCategory] = useState('Dynamic');
  const [searchQuery, setSearchQuery] = useState('');

  // 'Dynamic' is the curated set: fewer templates, each with a genuinely
  // distinct motion behavior. 'All' (and the other tabs) expose the full library.
  const curated = React.useMemo(() => getCuratedTemplates(), []);
  const pool = activeCategory === 'Dynamic' ? curated : TEMPLATES;
  const displayed = pool.filter(t =>
    (activeCategory === 'Dynamic' || activeCategory === 'All' || categoryOf(t) === activeCategory) &&
    (searchQuery === '' || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.fontFamily.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Search + category filter */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0 bg-surface-container-low border-b border-border/20">
        <input
          type="text"
          placeholder="SEARCH TEMPLATES"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-b-2 border-border/20 pb-2 mb-4 font-editorial font-bold text-base text-on-surface placeholder:text-muted-foreground/30 outline-none focus:border-primary transition-colors uppercase tracking-widest"
        />
        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {ALL_CATS.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all border min-h-[40px]',
                activeCategory === cat
                  ? 'bg-on-surface text-surface-container-lowest border-on-surface'
                  : 'text-muted-foreground border-border/20 hover:border-primary hover:text-primary'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template cards */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {displayed.map(t => {
          const isSelected = selectedStyleId === t.id;
          const cat = categoryOf(t);
          return (
            <button
              key={t.id}
              data-testid={`template-card-${t.id}`}
              onClick={() => setSelectedStyleId(t.id)}
              className={cn(
                'relative w-full overflow-hidden text-left transition-all group border-2',
                isSelected
                  ? 'border-primary'
                  : 'border-border/20 hover:border-on-surface/40'
              )}
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 220px' }}
            >
              {/* Preview card — LIVE animated preview driven by the real TemplateDefinition */}
              <div
                className="w-full flex items-center justify-center py-10 px-4 select-none relative overflow-hidden"
                style={{
                  background: '#050505',
                  minHeight: '132px',
                }}
              >
                {/* Category badge(s) top right */}
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <span className="text-[9px] font-bold tracking-[0.12em] px-2 py-0.5 rounded-full border border-white/10 text-white/40 uppercase bg-black/60">
                    {cat}
                  </span>
                </div>

                <LiveCaptionPreview
                  template={t}
                  words={['MAKE', 'EVERY', 'WORD', 'MOVE']}
                  wordMs={650}
                  maxHeroScale={1.4}
                  className="text-[15px] max-w-full"
                />
              </div>

              {/* Card footer */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(18,18,26,0.98)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground truncate">{t.name}</span>
                    {t.id === 'editorial' && <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1 leading-snug">{t.description}</p>
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
