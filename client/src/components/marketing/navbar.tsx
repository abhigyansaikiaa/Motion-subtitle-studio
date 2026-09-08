import React from 'react';
import { useAppStore } from '../../lib/store';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';

export function Navbar() {
  const user = useAppStore(state => state.user);
  const setToken = useAppStore(state => state.setToken);
  const setUser = useAppStore(state => state.setUser);

  async function handleLogout() {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
    window.location.hash = '#/';
  }

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-50"
    >
      <div className="h-14 px-6 rounded-[2rem] border border-border/50 bg-surface/80 backdrop-blur-2xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="#/" className="flex items-center gap-2 text-on-surface hover:opacity-80 transition-opacity">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-headline-md font-bold tracking-widest uppercase text-sm">
              MOTION SUBTITLE
            </span>
          </a>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-[13px] font-semibold tracking-wide text-muted-foreground hover:text-on-surface transition-colors">Features</a>
          <a href="#templates" className="text-[13px] font-semibold tracking-wide text-muted-foreground hover:text-on-surface transition-colors">Templates</a>
          <a href="#pricing" className="text-[13px] font-semibold tracking-wide text-muted-foreground hover:text-on-surface transition-colors">Pricing</a>
        </nav>
        
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high border border-border/50">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span className="font-mono text-xs font-medium">{user.credits} CR</span>
              </div>
              <a href="#/studio" className="px-5 py-2 bg-foreground text-background rounded-full text-[13px] font-bold hover:opacity-90 transition-all flex items-center gap-1.5">
                Studio <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-muted-foreground hover:text-on-surface text-[13px] font-semibold transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <a href="#/auth?mode=login" className="px-4 py-2 text-muted-foreground hover:text-on-surface text-[13px] font-semibold transition-colors">
                Log in
              </a>
              <a href="#/auth?mode=signup" className="px-5 py-2 bg-foreground text-background rounded-full text-[13px] font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm">
                Get Started
              </a>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
