import React from 'react';
import { Sparkles } from 'lucide-react';

export function FooterSection() {
  return (
    <footer className="w-full bg-background border-t border-border/30 pt-24 pb-12 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-16 relative z-10">
        
        {/* Brand Column */}
        <div className="flex flex-col gap-6 md:w-1/3">
          <div className="flex items-center gap-2 text-foreground">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-headline-md font-bold tracking-widest uppercase">
              MOTION SUBTITLE
            </span>
          </div>
          <p className="text-muted-foreground max-w-sm leading-relaxed">
            The premium video caption editor designed for tactile kinetic typography. Build dynamic cinematic experiences directly in your browser.
          </p>
        </div>

        {/* Links Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:w-2/3">
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-foreground text-sm mb-2">Product</h4>
            <a href="#/studio" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Studio</a>
            <a href="#templates" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Templates</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Pricing</a>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-foreground text-sm mb-2">Company</h4>
            <a href="#about" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">About</a>
            <a href="#blog" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Blog</a>
            <a href="#careers" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Careers</a>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-foreground text-sm mb-2">Resources</h4>
            <a href="#help" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Help Center</a>
            <a href="#tutorials" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Tutorials</a>
            <a href="#api" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">API Docs</a>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-foreground text-sm mb-2">Social</h4>
            <a href="#twitter" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Twitter (X)</a>
            <a href="#instagram" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">Instagram</a>
            <a href="#youtube" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">YouTube</a>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-muted-foreground text-xs font-medium">
          © {new Date().getFullYear()} Motion Subtitle Studio. All rights reserved.
        </div>
        <div className="flex gap-6 text-xs font-medium text-muted-foreground">
          <a href="#privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="#terms" className="hover:text-foreground transition-colors">Terms of Service</a>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(230,92,64,0.03),transparent)] pointer-events-none" />
    </footer>
  );
}
