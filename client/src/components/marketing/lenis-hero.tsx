import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { TEMPLATES, getTemplate } from '../../lib/templates';
import { LiveCaptionPreview } from './live-caption';

// Templates cycled on the hero stage — a spread of the viral pack's range.
const STAGE_IDS = ['hormozi', 'karaoke', 'neon-glow', 'hype', 'wave', 'glitch'];
const STAGE_TEMPLATES = STAGE_IDS.map(id => {
  try { return getTemplate(id); } catch { return TEMPLATES[0]; }
});

const META = ['70 templates', '90+ languages', 'word-level timing', '4k export'];

export function LenisHero() {
  const { scrollYProgress } = useScroll();
  const yHeadline = useTransform(scrollYProgress, [0, 0.6], [0, 180]);
  const yStage = useTransform(scrollYProgress, [0, 0.6], [0, 90]);
  const opacityMeta = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const [stageIdx, setStageIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStageIdx(i => (i + 1) % STAGE_TEMPLATES.length), 4200);
    return () => clearInterval(id);
  }, []);
  const stageTemplate = STAGE_TEMPLATES[stageIdx];

  return (
    <div className="relative w-full bg-background text-foreground overflow-hidden">
      <div className="max-w-[100rem] mx-auto px-6 md:px-10 pt-36 md:pt-44">

        {/* Kicker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="flex items-center justify-between border-b border-foreground/15 pb-4 mb-10 md:mb-14"
        >
          <span className="font-mono text-[11px] tracking-[0.25em] text-foreground/60 uppercase">
            [ Word-level caption engine ]
          </span>
          <span className="font-mono text-[11px] tracking-[0.25em] text-foreground/60 uppercase hidden sm:block">
            v1.0 — live
          </span>
        </motion.div>

        {/* Headline */}
        <motion.div style={{ y: yHeadline }} className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="font-editorial font-extrabold uppercase leading-[0.88] tracking-tight text-[11.5vw] md:text-[11vw]"
          >
            Make every<br />
            <span className="text-stroke">word move</span>
          </motion.h1>

          <div className="mt-10 md:mt-14 flex flex-col md:flex-row md:items-end justify-between gap-10">
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-xl text-base md:text-lg text-foreground/60 leading-relaxed font-grotesk"
            >
              Upload your video. Get precise word-level timestamps.
              Style every syllable with kinetic typography templates —
              then render broadcast-ready MP4s straight from your browser.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-4"
            >
              <a
                href="#/studio"
                className="group inline-flex items-center gap-3 bg-foreground text-background font-grotesk font-semibold text-sm uppercase tracking-widest px-8 py-4 hover:bg-foreground/85 transition-colors"
              >
                Start creating
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#templates"
                className="inline-flex items-center gap-3 border border-foreground/25 text-foreground font-grotesk font-semibold text-sm uppercase tracking-widest px-8 py-4 hover:border-foreground/70 hover:bg-foreground/5 transition-colors"
              >
                Browse 70 styles
              </a>
            </motion.div>
          </div>
        </motion.div>

        {/* Live stage */}
        <motion.div style={{ y: yStage }} className="mt-16 md:mt-24 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative aspect-[16/10] md:aspect-[21/9] bg-black border border-foreground/15 overflow-hidden"
          >
            {/* faint grid backdrop */}
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '72px 72px',
              }}
            />
            {/* scanline shimmer */}
            <div className="absolute inset-x-0 top-0 h-px bg-foreground/30" />

            {/* Template label */}
            <div className="absolute top-5 left-6 z-20 flex items-center gap-3">
              <span className="w-2 h-2 bg-foreground animate-pulse" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={stageTemplate.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/70"
                >
                  {stageTemplate.name} — {String(stageIdx + 1).padStart(2, '0')}/{STAGE_TEMPLATES.length}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="absolute top-5 right-6 z-20 font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/40">
              live preview
            </div>

            {/* The live caption */}
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stageTemplate.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-4xl"
                >
                  <LiveCaptionPreview
                    template={stageTemplate}
                    maxHeroScale={1.35}
                    wordMs={520}
                    className="text-3xl md:text-5xl"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* progress hairline */}
            <div className="absolute bottom-0 inset-x-0 h-[2px] bg-foreground/10">
              <motion.div
                key={stageIdx}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 4.2, ease: 'linear' }}
                className="h-full w-full bg-foreground origin-left"
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Meta strip */}
        <motion.div
          style={{ opacity: opacityMeta }}
          className="mt-10 md:mt-14 pb-16 md:pb-24 grid grid-cols-2 md:grid-cols-5 gap-6 items-center"
        >
          {META.map(m => (
            <div key={m} className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/50">
              <span className="text-foreground/90">●</span>&nbsp;&nbsp;{m}
            </div>
          ))}
          <div className="hidden md:flex items-center gap-2 justify-end font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/50">
            scroll <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
