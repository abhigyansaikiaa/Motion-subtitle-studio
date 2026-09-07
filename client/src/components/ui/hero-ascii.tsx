import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';

export function HeroAscii() {
  return (
    <div className="relative w-full h-[90vh] bg-surface flex flex-col justify-center overflow-hidden border-b border-surface-container">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-surface-container-high/40 via-surface to-surface pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      {/* Corner Accents */}
      <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-secondary/30" />
      <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-secondary/30" />
      <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-secondary/30" />
      <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-secondary/30" />
      
      {/* Technical Metadata */}
      <div className="absolute top-8 left-16 flex items-center gap-4 text-mono-timestamp text-secondary/60">
        <span className="animate-pulse w-2 h-2 rounded-full bg-primary/80" />
        REC // 1080P_60FPS
      </div>
      <div className="absolute bottom-8 right-16 flex flex-col items-end gap-1 text-mono-timestamp text-secondary/60">
        <span>ENGINE: KINETIC_TYPOGRAPHY</span>
        <span>VER: 2.4.0_PRO</span>
      </div>

      <div className="relative z-10 container mx-auto px-gutter flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div className="flex items-center gap-3 mb-6 px-4 py-1.5 rounded-full border border-surface-container-high bg-surface-container-low/50 backdrop-blur-sm">
            <span className="font-mono-timestamp text-xs text-primary uppercase tracking-widest">Motion Subtitle / Caption Studio</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-[90px] font-headline-lg tracking-tight leading-[1.05] text-on-surface mb-8 max-w-5xl">
            MAKE EVERY WORD <br/>
            <span className="italic font-light text-primary-fixed">MOVE WITH THE STORY.</span>
          </h1>
          
          <p className="font-body-lg text-secondary max-w-2xl mb-12 text-lg md:text-xl">
            The first video caption editor designed for premium typographic motion. Forget generic subtitles—build dynamic, word-timed cinematic experiences in your browser.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <a href="#/studio" className="group relative flex items-center gap-3 px-8 py-4 bg-primary text-on-primary rounded-xl font-label-lg font-bold shadow-[0_0_40px_rgba(255,183,125,0.2)] hover:shadow-[0_0_60px_rgba(255,183,125,0.4)] transition-all overflow-hidden uppercase tracking-wider">
              <span className="relative z-10 flex items-center gap-2">
                Start Creating <Play className="w-4 h-4 fill-current" />
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            </a>
            <a href="#templates" className="px-8 py-4 bg-transparent text-on-surface rounded-xl font-label-lg font-semibold border border-surface-container hover:bg-surface-container-low transition-colors uppercase tracking-wider">
              Explore Templates
            </a>
          </div>
        </motion.div>
      </div>

      {/* Abstract Animated Element representing sound/captions */}
      <motion.div 
        className="absolute bottom-0 inset-x-0 h-32 opacity-20 pointer-events-none flex items-end justify-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="w-2 bg-primary rounded-t-sm"
            animate={{
              height: [20, Math.random() * 100 + 20, 20],
            }}
            transition={{
              duration: Math.random() * 1.5 + 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
