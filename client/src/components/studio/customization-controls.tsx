import React from 'react';
import { useAppStore } from '../../lib/store';
import { getTemplate } from '../../lib/templates';
import { RefreshCw } from 'lucide-react';

const FONT_OPTIONS = [
  { value: "'Plus Jakarta Sans', sans-serif", label: "Plus Jakarta Sans (Modern)" },
  { value: "'Newsreader', serif", label: "Newsreader (Editorial)" },
  { value: "'Inter', sans-serif", label: "Inter (Clean)" },
  { value: "'Outfit', sans-serif", label: "Outfit (Geometric)" },
  { value: "system-ui, sans-serif", label: "System Default" },
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-4 pb-2 border-b border-border/50">
      <h4 className="text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">{label}</h4>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-foreground mb-1.5">{children}</label>;
}

function Select({ value, onChange, children }: any) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors appearance-none"
    >
      {children}
    </select>
  );
}

function Slider({ label, min, max, step, value, onChange, display }: any) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <span className="text-xs font-mono text-muted-foreground">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1 bg-border rounded-full appearance-none outline-none"
      />
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded-full cursor-pointer bg-transparent border border-border p-0.5 overflow-hidden"
        />
      </div>
    </div>
  );
}

function SegmentButtons<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border bg-surface">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 p-2 text-xs font-medium transition-all ${
            value === opt.value
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-foreground hover:bg-surface-container-high'
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
          <Slider
            label="Vertical Offset (Y)"
            min={-500} max={500} step={10}
            value={activeTemplate.offsetY ?? 0}
            onChange={(v: number) => set('offsetY', v)}
            display={`${activeTemplate.offsetY ?? 0}px`}
          />
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
    <div className="p-6 border-t border-border">
      <button
        onClick={() => setCustomOverrides({})}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-surface-container hover:bg-surface-container-high rounded-full transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Reset to Template
      </button>
    </div>
  );
}
