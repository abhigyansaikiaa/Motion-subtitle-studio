import React from 'react';

export function FooterSection() {
  return (
    <footer className="w-full bg-surface-container-lowest pt-32 pb-12 px-6 relative overflow-hidden">
      <div className="max-w-[90rem] mx-auto flex flex-col md:flex-row justify-between gap-16 relative z-10 border-b border-border/10 pb-24">
        
        {/* Brand Column */}
        <div className="flex flex-col gap-6 md:w-1/3">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="font-editorial font-bold text-4xl tracking-tighter uppercase leading-none">
              MOTION<br/>SUBTITLE
            </span>
          </div>
          <p className="text-muted-foreground max-w-sm leading-relaxed font-grotesk text-lg">
            The premium video caption editor designed for tactile kinetic typography. Build dynamic cinematic experiences directly in your browser.
          </p>
        </div>

        {/* Links Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:w-2/3 border-t-2 border-l-2 border-border/20 pt-8 pl-8">
          <div className="flex flex-col gap-4">
            <h4 className="font-editorial text-xl font-bold tracking-tighter text-on-surface uppercase mb-4">Product</h4>
            <a href="#/studio" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Studio</a>
            <a href="#templates" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Templates</a>
            <a href="#pricing" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Pricing</a>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="font-editorial text-xl font-bold tracking-tighter text-on-surface uppercase mb-4">Company</h4>
            <a href="#about" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">About</a>
            <a href="#blog" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Blog</a>
            <a href="#careers" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Careers</a>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="font-editorial text-xl font-bold tracking-tighter text-on-surface uppercase mb-4">Resources</h4>
            <a href="#help" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Help</a>
            <a href="#tutorials" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Tutorials</a>
            <a href="#api" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">API</a>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="font-editorial text-xl font-bold tracking-tighter text-on-surface uppercase mb-4">Social</h4>
            <a href="#twitter" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Twitter (X)</a>
            <a href="#instagram" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">Insta</a>
            <a href="#youtube" className="text-muted-foreground hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors">YouTube</a>
          </div>
        </div>
      </div>
      
      <div className="max-w-[90rem] mx-auto mt-12 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
        <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
          © {new Date().getFullYear()} Motion Subtitle Studio. All rights reserved.
        </div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <a href="#privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#terms" className="hover:text-primary transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
