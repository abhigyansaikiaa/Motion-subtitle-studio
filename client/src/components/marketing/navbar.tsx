import React from 'react';
import { useAppStore } from '../../lib/store';
import { ArrowRight } from 'lucide-react';
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
      className="fixed top-0 left-0 w-full z-50 bg-surface-container-lowest border-b border-border/20"
    >
      <div className="h-20 px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="#/" className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors">
            <span className="font-editorial font-bold text-2xl tracking-tighter uppercase leading-none">
              MOTION<br/>SUBTITLE
            </span>
          </a>
        </div>
        
        <nav className="hidden md:flex items-center gap-10">
          <a href="#features" className="text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-on-surface transition-colors">Features</a>
          <a href="#templates" className="text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-on-surface transition-colors">Templates</a>
          <a href="#pricing" className="text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-on-surface transition-colors">Pricing</a>
        </nav>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 border border-border/20 bg-surface">
                <span className="w-2 h-2 bg-primary"></span>
                <span className="font-mono text-xs font-bold">{user.credits} CR</span>
              </div>
              <a href="#/studio" className="px-6 py-3 bg-on-surface text-surface-container-lowest text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors flex items-center gap-2">
                Studio <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={handleLogout}
                className="px-4 py-3 text-muted-foreground hover:text-primary text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <a href="#/auth?mode=login" className="px-4 py-3 text-muted-foreground hover:text-primary text-xs font-bold uppercase tracking-widest transition-colors">
                Log In
              </a>
              <a href="#/auth?mode=signup" className="px-8 py-3 bg-on-surface text-surface-container-lowest text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors">
                Get Started
              </a>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
