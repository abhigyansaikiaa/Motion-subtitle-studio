import React from 'react';
import { useAppStore } from '../../lib/store';
import { getTemplate } from '../../lib/templates';
import { RefreshCw } from 'lucide-react';

const FONT_OPTIONS = [
  { value: "'Plus Jakarta Sans', sans-serif", label: "Plus Jakarta Sans" },
  { value: "'Newsreader', serif", label: "Newsreader" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Outfit', sans-serif", label: "Outfit" },
  { value: "system-ui, sans-serif", label: "System Default" },
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-8 pb-3 border-b border-border/10">
      <h4 className="font-editorial text-xl lg:text-3xl font-medium tracking-tight text-on-surface capitalize leading-none">{label}</h4>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-grotesk font-medium tracking-widest text-muted-foreground uppercase mb-3">{children}</label>;
}

function Select({ value, onChange, children }: any) {
  return (
    <div className="relative group">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-container-low border border-border/10 p-4 font-grotesk text-sm font-medium text-on-surface outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer rounded-md shadow-sm"
      >
        {children}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-[10px] group-hover:text-primary transition-colors">▼</div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, display }: any) {
  return (
    <div className="py-2">
      <div className="flex justify-between items-end mb-4">
        <label className="text-[10px] font-grotesk font-medium tracking-widest text-muted-foreground uppercase">{label}</label>
        <span className="font-grotesk text-sm font-bold tracking-wide text-on-surface leading-none">{display}</span>
      </div>
      <div className="relative h-1 bg-border/10 rounded-full cursor-pointer flex items-center group">
        <div className="absolute left-0 h-full bg-primary/20 rounded-full group-hover:bg-primary transition-colors" style={{ width: `${((value - min) / (max - min)) * 100}%` }} />
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div 
          className="absolute w-3 h-3 bg-primary rounded-full shadow-md -translate-x-1/2 pointer-events-none transition-transform group-hover:scale-125"
          style={{ left: `${((value - min) / (max - min)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between p-4 border border-border/10 bg-surface-container-low rounded-md shadow-sm transition-colors hover:border-border/30">
      <span className="text-[10px] font-grotesk font-medium tracking-widest text-muted-foreground uppercase">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-grotesk text-sm font-medium text-on-surface leading-none tracking-widest uppercase">{value}</span>
        <div className="relative w-6 h-6 rounded-full overflow-hidden shadow-inner border border-border/20">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 m-0 border-none"
          />
        </div>
      </div>
    </div>
  );
}

function SegmentButtons<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex border border-border/10 bg-surface-container-low rounded-md overflow-hidden shadow-sm p-1 gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 p-2 text-[10px] font-grotesk font-medium tracking-widest uppercase transition-all rounded-sm ${
            value === opt.value
              ? 'bg-on-surface text-surface-container-lowest shadow-sm'
              : 'text-muted-foreground hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Custom Hook for controls
function useActiveControls() {
  const selectedStyleId = useAppStore(state => state.selectedStyleId);
  const customOverrides = useAppStore(state => state.customOverrides);
  const setCustomOverrides = useAppStore(state => state.setCustomOverrides);
  const activeTemplate = { ...getTemplate(selectedStyleId), ...customOverrides };
  const set = (key: string, value: any) => setCustomOverrides({ [key]: value });
  return { activeTemplate, set };
}

// ─── TYPOGRAPHY PANEL ────────────────────────────────────────────────────────
export function TypographyPanel() {
  const { activeTemplate, set } = useActiveControls();
  
  return (
    <div className="space-y-8 p-6">
      <section>
        <SectionHeader label="Supporting Typography" />
        <div className="space-y-4">
          <div>
            <Label>Font</Label>
            <Select value={activeTemplate.fontFamily} onChange={(v: string) => set('fontFamily', v)}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </div>
          <Slider
            label="Base Size"
            min={12} max={80} step={1}
            value={activeTemplate.baseSize}
            onChange={(v: number) => set('baseSize', v)}
            display={`${activeTemplate.baseSize}px`}
          />
          <div>
            <Label>Text Case</Label>
            <Select value={activeTemplate.textTransform} onChange={(v: string) => set('textTransform', v)}>
              <option value="none">Normal</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </Select>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader label="Hero Typography" />
        <div className="space-y-4">
          <div>
            <Label>Hero Font</Label>
            <Select
              value={activeTemplate.heroFontFamily ?? activeTemplate.fontFamily}
              onChange={(v: string) => set('heroFontFamily', v)}
            >
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </div>
          <Slider
            label="Hero Scale"
            min={1.0} max={4.0} step={0.1}
            value={activeTemplate.heroScale}
            onChange={(v: number) => set('heroScale', v)}
            display={`×${activeTemplate.heroScale.toFixed(1)}`}
          />
          <div>
            <Label>Hero Weight</Label>
            <Select
              value={String(activeTemplate.heroFontWeight ?? activeTemplate.fontWeight)}
              onChange={(v: string) => set('heroFontWeight', isNaN(Number(v)) ? v : Number(v))}
            >
              <option value="300">Light (300)</option>
              <option value="400">Regular (400)</option>
              <option value="600">SemiBold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">ExtraBold (800)</option>
              <option value="900">Black (900)</option>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── COLOR PANEL ─────────────────────────────────────────────────────────────
export function ColorPanel() {
  const { activeTemplate, set } = useActiveControls();
  const isEditorial = activeTemplate.layoutType === 'editorial';

  return (
    <div className="space-y-8 p-6">
      <section>
        <SectionHeader label="Colors" />
        <div className="space-y-4">
          <ColorRow
            label={isEditorial ? 'Supporting Color' : 'Base Color'}
            value={activeTemplate.baseColor}
            onChange={v => set('baseColor', v)}
          />
          <ColorRow
            label="Hero / Highlight Color"
            value={activeTemplate.heroColor}
            onChange={v => set('heroColor', v)}
          />
          {!isEditorial && (
            <ColorRow
              label="Accent Color"
              value={activeTemplate.accentColor}
              onChange={v => set('accentColor', v)}
            />
          )}
        </div>
      </section>
    </div>
  );
}

// ─── ANIMATION PANEL ─────────────────────────────────────────────────────────
export function AnimationPanel() {
  const { activeTemplate, set } = useActiveControls();

  return (
    <div className="space-y-8 p-6">
      <section>
        <SectionHeader label="Animation" />
        <div className="space-y-4">
          <div>
            <Label>Base Animation</Label>
            <Select
              value={activeTemplate.entranceAnimation}
              onChange={(v: string) => set('entranceAnimation', v)}
            >
              <option value="none">None</option>
              <option value="fade">Fade In</option>
              <option value="fade-up">Fade Up ↑</option>
              <option value="fade-down">Fade Down ↓</option>
              <option value="slide-up">Slide Up</option>
              <option value="slide-down">Slide Down</option>
              <option value="pop">Pop</option>
              <option value="scale">Scale In</option>
              <option value="bounce">Bounce</option>
              <option value="blur-in">Blur In</option>
              <option value="reveal">Reveal</option>
              <option value="rise">Rise</option>
              <option value="soft-reveal">Soft Reveal (Cinematic)</option>
              <option value="focus-in">Focus In</option>
              <option value="elastic">Elastic</option>
            </Select>
          </div>
          <div>
            <Label>Hero Animation</Label>
            <Select
              value={activeTemplate.heroEntranceAnimation || ''}
              onChange={(v: string) => set('heroEntranceAnimation', v || undefined)}
            >
              <option value="">Same as Base</option>
              <option value="none">None</option>
              <option value="fade">Fade In</option>
              <option value="fade-up">Fade Up ↑</option>
              <option value="pop">Pop</option>
              <option value="scale">Scale In</option>
              <option value="blur-in">Blur In</option>
              <option value="reveal">Reveal</option>
            </Select>
          </div>
          <Slider
            label="Animation Speed"
            min={0.3} max={2.5} step={0.1}
            value={activeTemplate.animationSpeed ?? 1.0}
            onChange={(v: number) => set('animationSpeed', v)}
            display={
              (activeTemplate.animationSpeed ?? 1.0) < 0.7 ? 'Fast'
              : (activeTemplate.animationSpeed ?? 1.0) > 1.6 ? 'Slow'
              : 'Normal'
            }
          />
          <div>
            <Label>Word Highlight</Label>
            <Select value={activeTemplate.wordActivation} onChange={(v: string) => set('wordActivation', v)}>
              <option value="none">None</option>
              <option value="color-fill">Color Fill</option>
              <option value="scale-up">Scale Up</option>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── LAYOUT PANEL ────────────────────────────────────────────────────────────
export function LayoutPanel() {
  const { activeTemplate, set } = useActiveControls();

  return (
    <div className="space-y-8 p-6">
      <section>
        <SectionHeader label="Layout" />
        <div className="space-y-4">
          <div>
            <Label>Layout Type</Label>
            <Select value={activeTemplate.layoutType} onChange={(v: string) => set('layoutType', v)}>
              <option value="editorial">Editorial (Hero + Context)</option>
              <option value="inline">Inline (Standard)</option>
              <option value="stacked">Stacked (Vertical)</option>
              <option value="asymmetric">Asymmetric (Poster)</option>
              <option value="corner-hero">Corner Hero</option>
              <option value="split-hero">Split Hero</option>
              <option value="giant-bg">Giant Background Word</option>
              <option value="sentence-hero">Sentence Hero</option>
              <option value="kinetic">Kinetic</option>
            </Select>
          </div>
          <div>
            <Label>Alignment</Label>
            <SegmentButtons
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
              value={activeTemplate.alignment}
              onChange={v => set('alignment', v)}
            />
          </div>
          <div>
            <Label>Position</Label>
            <Select value={activeTemplate.position} onChange={(v: string) => set('position', v)}>
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
            </Select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Slider
                label="Offset Y"
                min={-500} max={500} step={10}
                value={activeTemplate.offsetY ?? 0}
                onChange={(v: number) => set('offsetY', v)}
                display={`${activeTemplate.offsetY ?? 0}px`}
              />
            </div>
            <div className="flex-1">
              <Slider
                label="Offset X"
                min={-500} max={500} step={10}
                value={activeTemplate.offsetX ?? 0}
                onChange={(v: number) => set('offsetX', v)}
                display={`${activeTemplate.offsetX ?? 0}px`}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── NUMBERS PANEL ───────────────────────────────────────────────────────────
export function NumbersPanel() {
  const { activeTemplate, set } = useActiveControls();

  return (
    <div className="space-y-8 p-6">
      <section>
        <SectionHeader label="Number Emphasis" />
        <div className="space-y-4">
          <div>
            <Label>Emphasis Level</Label>
            <SegmentButtons
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'always', label: 'Always' },
                { value: 'never', label: 'Never' },
              ]}
              value={activeTemplate.numberEmphasis || 'auto'}
              onChange={v => set('numberEmphasis', v)}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
            <Label>Count Up Animation</Label>
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary cursor-pointer"
              checked={!!activeTemplate.countUpEnabled}
              onChange={e => set('countUpEnabled', e.target.checked)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── DEPTH PANEL ─────────────────────────────────────────────────────────────
export function DepthPanel() {
  const { activeTemplate, set } = useActiveControls();

  return (
    <div className="space-y-8 p-6">
      <section>
        <SectionHeader label="Depth / Compositing" />
        <div className="space-y-4">
          <SegmentButtons
            options={[
              { value: 'front', label: 'Front' },
              { value: 'behind-subject', label: 'Behind Subject' },
              { value: 'mixed', label: 'Mixed' },
            ]}
            value={activeTemplate.captionDepth}
            onChange={v => set('captionDepth', v)}
          />
        </div>
      </section>
    </div>
  );
}

// ─── RESET BUTTON COMPONENT ──────────────────────────────────────────────────
export function ResetControlsButton() {
  const setCustomOverrides = useAppStore(state => state.setCustomOverrides);
  return (
    <div className="p-6 border-t border-border/20 bg-surface-container-low">
      <button
        onClick={() => setCustomOverrides({})}
        className="w-full flex items-center justify-center gap-2 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground hover:text-on-surface hover:bg-surface-container border border-border/20 transition-all"
      >
        <RefreshCw className="w-4 h-4" />
        Reset to Template
      </button>
    </div>
  );
}
