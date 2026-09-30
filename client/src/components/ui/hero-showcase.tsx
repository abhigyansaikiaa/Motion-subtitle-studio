import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Play } from 'lucide-react';

export function HeroShowcase() {
  const { scrollYProgress } = useScroll();
  const yText = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const scaleVideo = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <div className="relative w-full min-h-screen bg-surface-container-lowest flex flex-col justify-start pt-32 overflow-hidden text-on-surface border-b border-border/10">
      
      <div className="relative z-10 w-full max-w-[90rem] mx-auto px-6 flex flex-col items-start lg:items-center lg:text-center">
        
        {/* Top Label */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-12 border-b border-primary/20 pb-3"
        >
          <span className="text-xs font-grotesk tracking-[0.2em] text-muted-foreground uppercase">Motion Subtitle Studio</span>
        </motion.div>
        
        {/* Headline */}
        <motion.div style={{ y: yText }} className="flex flex-col lg:items-center w-full">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="font-editorial text-5xl md:text-7xl lg:text-9xl tracking-tight leading-[0.9] text-on-surface mb-10 max-w-7xl uppercase"
          >
            Make every word <br className="hidden lg:block"/>
            <span className="text-primary pr-4">move with the story.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-2xl text-muted-foreground max-w-3xl mb-16 font-grotesk leading-relaxed tracking-wide lg:text-center"
          >
            The premium video caption editor designed for tactile kinetic typography. Build dynamic, word-timed cinematic experiences directly in your browser.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto"
          >
            <a href="#/studio" className="w-full sm:w-auto flex items-center justify-center gap-3 px-12 py-5 rounded-full bg-on-surface text-surface-container-lowest font-grotesk font-medium text-sm uppercase tracking-widest hover:bg-primary-fixed hover:text-surface-container-lowest transition-colors shadow-lg">
              Start Creating <Play className="w-4 h-4 fill-current" />
            </a>
            <a href="#templates" className="w-full sm:w-auto px-12 py-5 rounded-full bg-transparent text-on-surface font-grotesk font-medium text-sm border border-border/20 hover:border-border/50 hover:bg-surface-container-low transition-colors uppercase tracking-widest">
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
          className="mt-32 w-full max-w-6xl aspect-video overflow-hidden rounded-xl border border-border/10 bg-black relative flex items-center justify-center group shadow-2xl shadow-black/40"
        >
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors z-20 cursor-pointer backdrop-blur-[2px] group-hover:backdrop-blur-none">
            <div className="w-24 h-24 rounded-full bg-surface-container-lowest/10 backdrop-blur-md flex items-center justify-center border border-surface-container-lowest/20 group-hover:scale-105 group-hover:bg-primary transition-all duration-500">
              <Play className="w-8 h-8 text-surface-container-lowest fill-surface-container-lowest ml-2 group-hover:text-on-primary group-hover:fill-on-primary transition-colors" />
            </div>
          </div>
          
          {/* Abstract Mock Video Frame */}
          <div className="w-full h-full bg-[#050505] relative overflow-hidden">
            
            {/* Mock Captions */}
            <div className="absolute bottom-20 inset-x-0 flex flex-col items-center z-10">
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
                 className="text-on-surface text-4xl md:text-6xl font-editorial font-medium tracking-tight text-center uppercase"
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
