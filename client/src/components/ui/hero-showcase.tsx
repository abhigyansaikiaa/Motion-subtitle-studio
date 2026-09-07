import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Play, Sparkles } from 'lucide-react';

export function HeroShowcase() {
  const { scrollYProgress } = useScroll();
  const yText = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const scaleVideo = useTransform(scrollYProgress, [0, 1], [1, 1.05]);

  return (
    <div className="relative w-full min-h-screen bg-background flex flex-col justify-start pt-32 overflow-hidden">
      
      {/* Background Soft Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
        
        {/* Top Label */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-border/50 bg-surface/50 backdrop-blur-md shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-foreground uppercase">Motion Subtitle Studio 2.0</span>
        </motion.div>
        
        {/* Headline */}
        <motion.div style={{ y: yText }} className="flex flex-col items-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] font-headline-lg tracking-[-0.04em] leading-[0.95] text-foreground mb-8 max-w-5xl"
          >
            Make every word <br/>
            <span className="text-primary italic font-light pr-4">move with the story.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 font-medium leading-relaxed"
          >
            The premium video caption editor designed for tactile kinetic typography. Build dynamic, word-timed cinematic experiences directly in your browser.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <a href="#/studio" className="w-full sm:w-auto group relative flex items-center justify-center gap-3 px-8 py-4 bg-foreground text-background rounded-full text-sm font-bold shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] hover:scale-[1.02] transition-all overflow-hidden uppercase tracking-wider">
              <span className="relative z-10 flex items-center gap-2">
                Start Creating <Play className="w-4 h-4 fill-current" />
              </span>
            </a>
            <a href="#templates" className="w-full sm:w-auto px-8 py-4 bg-surface text-foreground rounded-full text-sm font-bold border border-border/50 hover:bg-surface-container-low transition-colors uppercase tracking-wider shadow-sm">
              Explore Styles
            </a>
          </motion.div>
        </motion.div>

        {/* Video Mockup / Stage Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ scale: scaleVideo }}
          className="mt-20 w-full max-w-5xl aspect-video rounded-3xl overflow-hidden bg-black shadow-[0_32px_64px_rgba(0,0,0,0.15)] border border-border/20 relative flex items-center justify-center group"
        >
          {/* Faux Interface overlay */}
          <div className="absolute inset-0 border-[8px] border-surface/10 rounded-3xl pointer-events-none z-10" />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors z-20 cursor-pointer">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl border border-white/30 group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
          
          {/* Abstract Mock Video Frame */}
          <div className="w-full h-full bg-gradient-to-br from-surface-container-high to-black relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent)]" />
            
            {/* Mock Captions */}
            <div className="absolute bottom-16 inset-x-0 flex flex-col items-center">
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
                 className="text-white text-5xl md:text-7xl font-bold tracking-tight text-center"
               >
                 <span className="opacity-50">WE </span>
                 <span className="text-primary italic">BUILD</span>
                 <span className="opacity-50"> DIFFERENT.</span>
               </motion.div>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
