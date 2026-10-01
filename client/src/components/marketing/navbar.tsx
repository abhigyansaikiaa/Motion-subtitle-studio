import React from 'react';
import { useAppStore } from '../../lib/store';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';

const LINKS = [
  { n: '01', label: 'Principles', href: '#features' },
  { n: '02', label: 'Styles', href: '#templates' },
  { n: '03', label: 'Editor', href: '#editor' },
  { n: '04', label: 'Pricing', href: '#pricing' },
];

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
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 w-full z-50 bg-background/85 backdrop-blur-md border-b border-foreground/15"
    >
      <div className="max-w-[100rem] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <a href="#/" className="font-editorial font-extrabold text-lg tracking-tight uppercase leading-none">
          Motion<span className="text-foreground/40">—</span>Subtitle
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map(l => (
            <a
              key={l.n}
              href={l.href}
              className="group font-mono text-[11px] tracking-[0.2em] uppercase text-foreground/55 hover:text-foreground transition-colors"
            >
              <span className="text-foreground/30 mr-1.5">{l.n}</span>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-foreground/60 border border-foreground/20 px-3 py-2">
                <span className="w-1.5 h-1.5 bg-foreground" />
                {user.credits} CR
              </span>
              <a
                href="#/studio"
                className="inline-flex items-center gap-2 bg-foreground text-background font-grotesk font-semibold text-xs uppercase tracking-widest px-5 py-2.5 hover:bg-foreground/85 transition-colors"
              >
                Studio <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={handleLogout}
                className="font-mono text-[11px] tracking-[0.2em] uppercase text-foreground/45 hover:text-foreground transition-colors px-2"
              >
                Out
              </button>
            </>
          ) : (
            <>
              <a
                href="#/auth?mode=login"
                className="font-mono text-[11px] tracking-[0.2em] uppercase text-foreground/55 hover:text-foreground transition-colors px-2"
              >
                Log in
              </a>
              <a
                href="#/auth?mode=signup"
                className="bg-foreground text-background font-grotesk font-semibold text-xs uppercase tracking-widest px-5 py-2.5 hover:bg-foreground/85 transition-colors"
              >
                Get started
              </a>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
