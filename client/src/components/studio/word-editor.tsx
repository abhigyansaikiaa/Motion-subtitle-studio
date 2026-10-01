import React, { useState } from 'react';
import { useAppStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import type { Segment } from '../../lib/types';
import { Sparkles, Zap, GitMerge, Scissors } from 'lucide-react';

// ─── WORD CHIP ────────────────────────────────────────────────────────────────
function WordChip({
  word,
  segmentId,
  isActive,
}: {
  word: { id: string; text: string; emphasis?: string; start: number; end: number; scale?: number };
  segmentId: string;
  isActive: boolean;
}) {
  const setEditorSegments = useAppStore(s => s.setEditorSegments);
  const editorSegments    = useAppStore(s => s.editorSegments);
  const setCurrentTime    = useAppStore(s => s.setCurrentTime);

  const isHero   = word.emphasis === 'hero';
  const isAccent = word.emphasis === 'accent';

  const cycleEmphasis = () => {
    const next = isHero ? 'accent' : isAccent ? 'none' : 'hero';
    setEditorSegments(
      editorSegments.map(s =>
        s.id !== segmentId ? s : {
          ...s,
          words: s.words.map(w => w.id === word.id ? { ...w, emphasis: next } : w),
        }
      )
    );
  };

  const handleTextChange = (val: string) => {
    setEditorSegments(
      editorSegments.map(s =>
        s.id !== segmentId ? s : {
          ...s,
          words: s.words.map(w => w.id === word.id ? { ...w, text: val } : w),
        }
      )
    );
  };

  const handleTimeChange = (field: 'start' | 'end', val: string) => {
    const num = parseFloat(val);
    setEditorSegments(
      editorSegments.map(s =>
        s.id !== segmentId ? s : {
          ...s,
          words: s.words.map(w => w.id === word.id ? { ...w, [field]: isNaN(num) ? word[field] : num } : w),
        }
      )
    );
  };

  const handleSplitBefore = () => {
    const sIndex = editorSegments.findIndex(s => s.id === segmentId);
    if (sIndex === -1) return;
    const seg = editorSegments[sIndex];
    const wIndex = seg.words.findIndex(w => w.id === word.id);
    if (wIndex <= 0) return; // Cannot split before the first word
    
    const words1 = seg.words.slice(0, wIndex);
    const words2 = seg.words.slice(wIndex);
    
    const seg1: Segment = { ...seg, end: words1[words1.length - 1].end, words: words1 };
    const seg2: Segment = { ...seg, id: seg.id + '_split', start: words2[0].start, words: words2 };
    
    const next = [...editorSegments];
    next.splice(sIndex, 1, seg1, seg2);
    setEditorSegments(next);
  };

  return (
    <span className="relative group inline-flex items-center">
      <input
        type="text"
        value={word.text}
        onChange={e => handleTextChange(e.target.value)}
        onFocus={() => { setCurrentTime(word.start); useAppStore.getState().setSeekRequest(word.start); }}
        className={cn(
          'bg-transparent outline-none text-[15px] font-grotesk tracking-wide border-b px-1 py-1 transition-all min-w-[24px]',
          isActive        ? 'text-primary border-primary'
            : isHero      ? 'text-on-surface border-on-surface/50'
            : isAccent    ? 'text-on-surface/80 border-on-surface/30'
            : 'text-muted-foreground border-transparent hover:border-border/30'
        )}
        style={{
          width: `${Math.max(2, word.text.length)}ch`,
          borderColor: isHero ? 'rgba(255,255,255,0.7)' : isAccent ? 'rgba(255,255,255,0.35)' : undefined,
        }}
      />

      {/* Hover tooltip actions (also shows on focus for touch devices) */}
      <span className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex group-focus-within:flex items-center gap-1 bg-surface-container-low border border-border/10 rounded-md shadow-lg shadow-black/30 p-1 z-30 transition-all duration-300">
        
        {/* Timing Inputs */}
        <div className="flex items-center gap-0.5 bg-surface-container/50 rounded px-1.5 text-[10px] font-grotesk text-muted-foreground mr-1">
          <input
            type="number"
            step="0.01"
            value={word.start}
            onChange={e => handleTimeChange('start', e.target.value)}
            className="w-10 bg-transparent text-center outline-none hover:text-primary focus:text-primary transition-colors"
          />
          <span>-</span>
          <input
            type="number"
            step="0.01"
            value={word.end}
            onChange={e => handleTimeChange('end', e.target.value)}
            className="w-10 bg-transparent text-center outline-none hover:text-primary focus:text-primary transition-colors"
          />
        </div>

        <button
          title={isHero ? 'Remove Hero' : 'Set as Hero'}
          onClick={cycleEmphasis}
          className={cn(
            'p-2.5 rounded-sm transition-colors',
            isHero ? 'text-surface-container-lowest bg-on-surface' : 'text-muted-foreground hover:text-on-surface hover:bg-surface-container'
          )}
        >
          <Sparkles className="w-3 h-3" />
        </button>
        <button
          title="Accent"
          onClick={() => {
            const next = isAccent ? 'none' : 'accent';
            setEditorSegments(
              editorSegments.map(s =>
                s.id !== segmentId ? s : {
                  ...s,
                  words: s.words.map(w => w.id === word.id ? { ...w, emphasis: next } : w),
                }
              )
            );
          }}
          className={cn(
            'p-2.5 rounded-sm transition-colors',
            isAccent ? 'text-surface-container-lowest bg-on-surface/80' : 'text-muted-foreground hover:text-on-surface hover:bg-surface-container'
          )}
        >
          <Zap className="w-3 h-3" />
        </button>
        <div className="w-px h-3 bg-border/20 mx-1" />
        <div className="flex items-center gap-0.5 bg-surface-container/50 rounded-sm px-1">
          <button title="Decrease Size" onClick={() => { const current = word.scale || 1; setEditorSegments(editorSegments.map(s => s.id !== segmentId ? s : { ...s, words: s.words.map(w => w.id === word.id ? { ...w, scale: Math.max(0.5, current - 0.1) } : w) })); }} className="p-2.5 text-xs font-grotesk text-muted-foreground hover:text-primary transition-colors">A-</button>
          <span className="text-[9px] font-grotesk text-muted-foreground min-w-[2ch] text-center">{word.scale ? word.scale.toFixed(1) : "1.0"}</span>
          <button title="Increase Size" onClick={() => { const current = word.scale || 1; setEditorSegments(editorSegments.map(s => s.id !== segmentId ? s : { ...s, words: s.words.map(w => w.id === word.id ? { ...w, scale: Math.min(3.0, current + 0.1) } : w) })); }} className="p-2.5 text-xs font-grotesk text-muted-foreground hover:text-primary transition-colors">A+</button>
        </div>
        <div className="w-px h-3 bg-border/20 mx-1" />
        <button
          title="Split segment before word"
          onClick={handleSplitBefore}
          className="p-2.5 rounded-sm transition-colors text-muted-foreground hover:text-on-surface hover:bg-surface-container"
        >
          <Scissors className="w-3 h-3" />
        </button>
      </span>

      {/* Separator dot */}
      <span className="mx-1 text-muted-foreground/30 text-sm select-none">×</span>
    </span>
  );
}

// ─── WORD EDITOR (main export) ────────────────────────────────────────────────
export function WordEditor() {
  const editorSegments    = useAppStore(s => s.editorSegments);
  const setEditorSegments = useAppStore(s => s.setEditorSegments);
  const currentTime       = useAppStore(s => s.currentTime);
  const setCurrentTime    = useAppStore(s => s.setCurrentTime);

  if (!editorSegments.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
        <p className="text-muted-foreground/40 text-sm">No captions yet.</p>
        <p className="text-muted-foreground/25 text-xs mt-1">Transcribe a video to get started.</p>
      </div>
    );
  }

  const mergeWithNext = (idx: number) => {
    if (idx >= editorSegments.length - 1) return;
    const a = editorSegments[idx];
    const b = editorSegments[idx + 1];
    const merged: Segment = {
      ...a,
      end: b.end,
      words: [...a.words, ...b.words],
    };
    const next = [...editorSegments];
    next.splice(idx, 2, merged);
    setEditorSegments(next);
  };

  return (
    <div className="p-4 space-y-2">
      {editorSegments.map((seg, idx) => {
        const isActive = currentTime >= seg.start && currentTime <= seg.end + 0.5;

        return (
          <React.Fragment key={seg.id}>
            <div
              className={cn(
                'relative rounded-xl p-4 transition-all border cursor-pointer',
                isActive
                  ? 'border-foreground/30 bg-foreground/5'
                  : 'border-border bg-card/30 hover:border-border/80'
              )}
              onClick={() => { const t = (seg.start + seg.end) / 2; setCurrentTime(t); useAppStore.getState().setSeekRequest(t); }}
            >
              {/* Clip header */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground/50 uppercase">
                  CLIP {idx + 1}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground/40">
                  {seg.start.toFixed(1)}s – {seg.end.toFixed(1)}s
                </span>
              </div>

              {/* Words */}
              <div className="flex flex-wrap items-baseline gap-y-1">
                {seg.words.map(word => (
                  <WordChip
                    key={word.id}
                    word={word}
                    segmentId={seg.id}
                    isActive={currentTime >= word.start && currentTime <= word.end}
                  />
                ))}
              </div>

              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-foreground opacity-60" />
              )}
            </div>

            {/* Merge clips button between consecutive clips */}
            {idx < editorSegments.length - 1 && (
              <div className="flex items-center justify-center py-0.5">
                <button
                  onClick={() => mergeWithNext(idx)}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors font-medium tracking-wide"
                >
                  <GitMerge className="w-3 h-3" />
                  merge clips
                </button>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
