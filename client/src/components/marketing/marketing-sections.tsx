import React, { useState } from 'react';
import { motion } from 'motion/react';
import { TEMPLATES } from '../../lib/templates';
import { LiveCaptionPreview } from './live-caption';
import { ArrowUpRight, Check } from 'lucide-react';

/* ─── Shared section header: mono index + huge grotesque title ─── */
function SectionHead({
  index,
  kicker,
  title,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
}) {
  return (
    <div className="mb-16 md:mb-24">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-4 border-b border-foreground/15 pb-4 mb-10"
      >
        <span className="font-mono text-[11px] tracking-[0.25em] text-foreground/60 uppercase">
          {index}
        </span>
        <span className="font-mono text-[11px] tracking-[0.25em] text-foreground/60 uppercase">
          [ {kicker} ]
        </span>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="font-editorial font-extrabold uppercase tracking-tight leading-[0.9] text-[clamp(1.4rem,7.1vw,8rem)]"
      >
        {title}
      </motion.h2>
    </div>
  );
}

const wrap = 'max-w-[100rem] mx-auto px-6 md:px-10';

/* ─── 01 · Principles ─── */
const PRINCIPLES = [
  {
    n: '01',
    title: 'Kinetic typography',
    body: 'Words don\u2019t just appear. They pop, fill, slide and collide in perfect sync with your voice — hardware-accelerated transforms, zero jank.',
  },
  {
    n: '02',
    title: 'Word-level control',
    body: 'Every word carries its own timestamp. Correct text, retime, or crown any word the hero with a single click.',
  },
  {
    n: '03',
    title: 'Seventy styles',
    body: 'Viral caption packs, editorial layouts, MOGRT-grade motion graphics. One click to reskin an entire video.',
  },
  {
    n: '04',
    title: 'Cloud render',
    body: 'Real-time preview in the browser, broadcast-ready MP4 from the render farm. 4K, hard-burned, no watermark on Pro.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-28 md:py-40 bg-background text-foreground">
      <div className={wrap}>
        <SectionHead
          index="01"
          kicker="principles"
          title={<>Designed for impact.<br /><span className="text-stroke">Built for creators.</span></>}
        />
        <div className="border-t border-foreground/15">
          {PRINCIPLES.map((p, i) => (
            <motion.div
              key={p.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="group grid grid-cols-[auto_1fr] md:grid-cols-[80px_1fr_1fr] gap-6 md:gap-10 items-baseline py-10 md:py-14 border-b border-foreground/15 hover:bg-foreground/[0.03] transition-colors px-2 md:px-4"
            >
              <span className="font-mono text-sm text-foreground/40 group-hover:text-foreground transition-colors">
                {p.n}
              </span>
              <h3 className="font-editorial font-bold uppercase tracking-tight text-3xl md:text-5xl leading-none">
                {p.title}
              </h3>
              <p className="col-span-2 md:col-span-1 text-foreground/55 leading-relaxed font-grotesk md:max-w-md">
                {p.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 02 · Workflow ─── */
const STEPS = [
  { n: '01', title: 'Upload', body: 'Drop your footage. Direct-to-cloud upload, no compression queues.' },
  { n: '02', title: 'Transcribe', body: 'Word-level timestamps generated with speaker-grade accuracy.' },
  { n: '03', title: 'Style', body: 'Pick a template, crown hero words, tune colors live.' },
  { n: '04', title: 'Render', body: 'Export a hard-burned MP4 straight to your downloads.' },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-28 md:py-40 bg-foreground text-background">
      <div className={wrap}>
        <div className="mb-16 md:mb-24">
          <div className="flex items-center gap-4 border-b border-background/20 pb-4 mb-10">
            <span className="font-mono text-[11px] tracking-[0.25em] text-background/60 uppercase">02</span>
            <span className="font-mono text-[11px] tracking-[0.25em] text-background/60 uppercase">[ workflow ]</span>
          </div>
          <h2 className="font-editorial font-extrabold uppercase tracking-tight leading-[0.9] text-[clamp(1.4rem,7.1vw,8rem)]">
            Raw to rendered<br />in minutes.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-background/20">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="p-8 md:p-10 border-r border-b border-background/20 group hover:bg-background hover:text-foreground transition-colors duration-300"
            >
              <div className="font-editorial font-extrabold text-6xl md:text-7xl leading-none text-background/15 group-hover:text-foreground/15 transition-colors mb-8">
                {s.n}
              </div>
              <h3 className="font-editorial font-bold uppercase tracking-tight text-2xl mb-4">{s.title}</h3>
              <p className="text-sm leading-relaxed opacity-60 font-grotesk">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 03 · Template index — all 26 viral styles, live ─── */
export function TemplateShowcase() {
  const viral = TEMPLATES.filter(t => t.category === 'Viral');
  return (
    <section id="templates" className="py-28 md:py-40 bg-background text-foreground">
      <div className={wrap}>
        <SectionHead
          index="03"
          kicker="style index"
          title={<>Twenty-six ways<br />to <span className="text-stroke">go viral.</span></>}
        />
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-foreground/55 font-grotesk text-lg max-w-2xl -mt-10 md:-mt-14 mb-16 md:mb-20 leading-relaxed"
        >
          Every style below is live — real templates, real motion, running right now.
          What you see is exactly what your captions will do.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-foreground/15">
          {viral.map((t, i) => (
            <motion.a
              key={t.id}
              href="#/studio"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="group relative border-r border-b border-foreground/15 bg-black hover:bg-[#0d0d0d] transition-colors"
            >
              <div className="aspect-[16/10] flex items-center justify-center px-8 overflow-hidden">
                <LiveCaptionPreview template={t} maxHeroScale={1.4} wordMs={650} className="text-xl md:text-2xl" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-foreground/15">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] text-foreground/40">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-editorial font-bold uppercase tracking-tight text-lg">
                    {t.name}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </motion.a>
          ))}
        </div>

        <div className="mt-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/45">
            + 44 more styles inside the studio — editorial, MOGRT, cinematic
          </p>
          <a
            href="#/studio"
            className="inline-flex items-center gap-3 bg-foreground text-background font-grotesk font-semibold text-sm uppercase tracking-widest px-8 py-4 hover:bg-foreground/85 transition-colors"
          >
            Open the studio <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── 04 · Editor — interactive hero-word demo (was null) ─── */
const DEMO_WORDS = ['CLICK', 'ANY', 'WORD', 'TO', 'MAKE', 'IT', 'THE', 'HERO'];

export function EditorShowcase() {
  const [hero, setHero] = useState(4);
  return (
    <section id="editor" className="py-28 md:py-40 bg-background text-foreground border-t border-foreground/15">
      <div className={wrap}>
        <SectionHead
          index="04"
          kicker="the editor"
          title={<>Direct the<br />attention.</>}
        />
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="bg-black border border-foreground/15 p-10 md:p-16 min-h-[320px] flex items-center justify-center"
          >
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
              {DEMO_WORDS.map((w, i) => (
                <motion.button
                  key={w}
                  onClick={() => setHero(i)}
                  animate={
                    i === hero
                      ? {
                          scale: 1.9,
                          color: '#E8D5B0',
                          opacity: 1,
                          // Push neighbours aside so the 1.9x hero word never eats their glyphs.
                          marginLeft: `${(0.32 * w.length).toFixed(2)}em`,
                          marginRight: `${(0.32 * w.length).toFixed(2)}em`,
                        }
                      : { scale: 1, color: '#EFEFEF', opacity: 0.35, marginLeft: '0em', marginRight: '0em' }
                  }
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  whileHover={i === hero ? undefined : { opacity: 0.8, scale: 1.08 }}
                  className="font-editorial font-extrabold uppercase tracking-tight text-2xl md:text-3xl cursor-pointer origin-center"
                >
                  {w}
                </motion.button>
              ))}
            </div>
          </motion.div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/45 mb-6">
              try it — this demo is live
            </p>
            <h3 className="font-editorial font-bold uppercase tracking-tight text-3xl md:text-4xl leading-tight mb-6">
              Hero words carry<br />the punchline.
            </h3>
            <p className="text-foreground/55 font-grotesk text-lg leading-relaxed max-w-md">
              One click promotes any word to hero status — bigger, bolder, impossible
              to miss. The rhythm of your edit follows the rhythm of your voice.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 05 · Word-level timing (was null) ─── */
const SAMPLE_TIMELINE = [
  { id: 'w0', word: 'MAKE', start: '00:00.120', end: '00:00.380' },
  { id: 'w1', word: 'EVERY', start: '00:00.400', end: '00:00.660' },
  { id: 'w2', word: 'WORD', start: '00:00.680', end: '00:00.940' },
  { id: 'w3', word: 'MOVE', start: '00:00.960', end: '00:01.240' },
  { id: 'w4', word: 'WITH', start: '00:01.260', end: '00:01.440' },
  { id: 'w5', word: 'THE', start: '00:01.460', end: '00:01.600' },
  { id: 'w6', word: 'STORY', start: '00:01.620', end: '00:02.020' },
];

export function WordLevelSection() {
  return (
    <section className="py-28 md:py-40 bg-background text-foreground border-t border-foreground/15">
      <div className={wrap}>
        <SectionHead
          index="05"
          kicker="precision"
          title={<>Timed to the<br /><span className="text-stroke">millisecond.</span></>}
        />
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <p className="text-foreground/55 font-grotesk text-lg leading-relaxed max-w-md">
            Transcription returns every word with its own in/out point — not
            block subtitles, but a true timeline you can nudge, retime and
            restyle word by word.
            <span className="block mt-6 font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/40">
              sample timeline — your words will differ
            </span>
          </p>
          <div className="border-t border-foreground/15">
            {SAMPLE_TIMELINE.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group flex items-center justify-between py-4 border-b border-foreground/15 font-mono text-sm hover:bg-foreground/[0.04] px-2 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <span className="text-foreground/35 w-8">{r.id}</span>
                  <span className="font-editorial font-bold uppercase tracking-wide text-base group-hover:text-[#E8D5B0] transition-colors">
                    {r.word}
                  </span>
                </div>
                <div className="text-foreground/50 text-xs md:text-sm tabular-nums">
                  {r.start} <span className="text-foreground/30">→</span> {r.end}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 06 · Pricing ─── */
export function PricingSection() {
  return (
    <section id="pricing" className="py-28 md:py-40 bg-background text-foreground border-t border-foreground/15">
      <div className={wrap}>
        <SectionHead
          index="06"
          kicker="pricing"
          title={<>Start free.<br /><span className="text-stroke">Scale when ready.</span></>}
        />
        <div className="grid md:grid-cols-2 border-t border-l border-foreground/15 max-w-5xl">
          <div className="p-10 md:p-14 border-r border-b border-foreground/15 flex flex-col">
            <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/45 mb-8">Creator</span>
            <div className="font-editorial font-extrabold text-7xl tracking-tight mb-10">
              $0<span className="text-xl font-grotesk font-normal text-foreground/45">/mo</span>
            </div>
            <ul className="space-y-5 mb-12 flex-1 font-grotesk">
              {['10 mins of generation', '720p export', 'Core templates'].map(f => (
                <li key={f} className="flex items-center gap-4 text-foreground/65">
                  <Check className="w-4 h-4 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <a href="#/auth?mode=signup" className="block text-center py-5 border border-foreground/25 font-grotesk font-semibold text-sm uppercase tracking-widest hover:border-foreground hover:bg-foreground/5 transition-colors">
              Start free
            </a>
          </div>
          <div className="p-10 md:p-14 border-r border-b border-foreground/15 bg-foreground text-background flex flex-col">
            <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-background/55 mb-8">Pro</span>
            <div className="font-editorial font-extrabold text-7xl tracking-tight mb-10">
              $15<span className="text-xl font-grotesk font-normal text-background/55">/mo</span>
            </div>
            <ul className="space-y-5 mb-12 flex-1 font-grotesk">
              {['120 mins of generation', '4K export', 'All 70 templates', 'No watermark'].map(f => (
                <li key={f} className="flex items-center gap-4 text-background/75">
                  <Check className="w-4 h-4 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <a href="#/auth?mode=signup" className="block text-center py-5 bg-background text-foreground font-grotesk font-semibold text-sm uppercase tracking-widest hover:bg-background/85 transition-colors">
              Upgrade to Pro
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 07 · FAQ ─── */
const FAQS = [
  { q: 'What video formats do you support?', a: 'MP4, MOV and WebM — up to 200MB per upload.' },
  { q: 'Which languages can you transcribe?', a: 'Over 90, including English, Hindi, Hinglish, Spanish, French and Japanese — with auto-detection.' },
  { q: 'Can I use my own fonts?', a: 'Custom font upload is available on Pro. Creator includes a curated set of premium typefaces.' },
  { q: 'Do I keep the rights to my exports?', a: 'Yes. Everything you render is yours, forever — including on the free plan.' },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-28 md:py-40 bg-background text-foreground border-t border-foreground/15">
      <div className={wrap}>
        <SectionHead index="07" kicker="faq" title={<>Questions,<br />answered.</>} />
        <div className="border-t border-foreground/15 max-w-4xl">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-foreground/15">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-8 text-left group px-2"
                >
                  <span className="font-editorial font-bold uppercase tracking-tight text-xl md:text-2xl group-hover:translate-x-1 transition-transform">
                    {f.q}
                  </span>
                  <span className={`font-mono text-2xl text-foreground/50 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="pb-8 px-2 text-foreground/55 font-grotesk text-lg leading-relaxed max-w-2xl">
                    {f.a}
                  </p>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
