import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Play } from 'lucide-react';

export function HeroShowcase() {
  const { scrollYProgress } = useScroll();
  const yText = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const scaleVideo = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <div className="relative w-full min-h-screen bg-surface-container-lowest flex flex-col justify-start pt-32 overflow-hidden bg-noise text-on-surface border-b border-border/20">
      
      <div className="relative z-10 w-full max-w-[90rem] mx-auto px-6 flex flex-col items-start lg:items-center lg:text-center">
        
        {/* Top Label */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-12 border-b-2 border-primary pb-2"
        >
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Motion Subtitle Studio</span>
        </motion.div>
        
        {/* Headline */}
        <motion.div style={{ y: yText }} className="flex flex-col lg:items-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="font-editorial text-massive tracking-tighter leading-[0.8] text-on-surface mb-10 max-w-6xl uppercase"
          >
            Make every word <br className="hidden lg:block"/>
            <span className="text-primary pr-4">move with the story.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-2xl text-muted-foreground max-w-3xl mb-16 font-grotesk leading-tight tracking-tight lg:text-center"
          >
            The premium video caption editor designed for tactile kinetic typography. Build dynamic, word-timed cinematic experiences directly in your browser.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <a href="#/studio" className="w-full sm:w-auto flex items-center justify-center gap-3 px-12 py-6 bg-on-surface text-surface-container-lowest font-bold text-sm uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors">
              Start Creating <Play className="w-4 h-4 fill-current" />
            </a>
            <a href="#templates" className="w-full sm:w-auto px-12 py-6 bg-transparent text-on-surface font-bold text-sm border-2 border-border/20 hover:border-on-surface transition-colors uppercase tracking-widest">
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
          className="mt-32 w-full max-w-6xl aspect-video overflow-hidden bg-black tactile-border relative flex items-center justify-center group"
        >
          {/* Brutalist Frame */}
          <div className="absolute inset-0 border-[4px] border-surface/20 pointer-events-none z-10" />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors z-20 cursor-pointer">
            <div className="w-24 h-24 bg-primary flex items-center justify-center border border-on-primary group-hover:scale-105 transition-transform">
              <Play className="w-10 h-10 text-on-primary fill-on-primary ml-2" />
            </div>
          </div>
          
          {/* Abstract Mock Video Frame */}
          <div className="w-full h-full bg-[#050505] relative overflow-hidden">
            <div className="absolute inset-0 bg-noise opacity-50" />
            
            {/* Mock Captions */}
            <div className="absolute bottom-20 inset-x-0 flex flex-col items-center">
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
                 className="text-on-surface text-6xl md:text-8xl font-editorial font-bold tracking-tighter text-center uppercase"
               >
                 <span className="opacity-40">WE </span>
                 <span className="text-primary">BUILD</span>
                 <span className="opacity-40"> DIFFERENT.</span>
               </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
