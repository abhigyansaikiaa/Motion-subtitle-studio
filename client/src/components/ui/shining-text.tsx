import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface ShiningTextProps {
  text: string;
  className?: string;
  duration?: number;
}

export function ShiningText({ text, className, duration = 2 }: ShiningTextProps) {
  return (
    <div className={cn("relative inline-block overflow-hidden", className)}>
      {/* Base text */}
      <span className="text-secondary/50 font-medium">
        {text}
      </span>
      
      {/* Shining effect overlay */}
      <motion.span 
        className="absolute inset-0 bg-clip-text text-transparent font-medium"
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent 0%, #ffffff 50%, transparent 100%)',
          backgroundSize: '200% 100%',
        }}
        animate={{
          backgroundPosition: ['200% 0', '-200% 0'],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
        }}
        aria-hidden="true"
      >
        {text}
      </motion.span>
    </div>
  );
}
