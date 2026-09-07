import React from 'react';
import { motion } from 'motion/react';
import { TEMPLATES } from '../../lib/templates';
import { Sparkles, Zap, LayoutTemplate, Palette, CheckCircle2 } from 'lucide-react';

export function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 bg-background relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-headline-md font-bold tracking-tight text-foreground mb-4">
            Designed for impact. <br/>
            <span className="text-muted-foreground font-medium">Built for creators.</span>
          </h2>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 p-10 rounded-[2rem] bg-surface border border-border/50 shadow-sm flex flex-col justify-end min-h-[340px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap className="w-48 h-48" />
            </div>
            <div className="relative z-10 max-w-sm">
              <h3 className="text-2xl font-bold tracking-tight mb-3">Kinetic Typography</h3>
              <p className="text-muted-foreground leading-relaxed">Words don't just appear. They move, scale, and color-fill in perfect sync with your voice. Built with hardware-accelerated transforms.</p>
            </div>
          </div>

          <div className="p-10 rounded-[2rem] bg-surface border border-border/50 shadow-sm flex flex-col justify-end min-h-[340px]">
            <LayoutTemplate className="w-10 h-10 text-primary mb-6" />
            <h3 className="text-xl font-bold tracking-tight mb-3">Editorial Composition</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">Ditch the ugly lower-thirds. Our templates treat your video like a premium magazine spread.</p>
          </div>

          <div className="p-10 rounded-[2rem] bg-surface border border-border/50 shadow-sm flex flex-col justify-end min-h-[340px]">
            <Sparkles className="w-10 h-10 text-primary mb-6" />
            <h3 className="text-xl font-bold tracking-tight mb-3">Word-Level Control</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">Make any word a Hero word with a single click. Total control over timing and style.</p>
          </div>

          <div className="md:col-span-2 p-10 rounded-[2rem] bg-surface border border-border/50 shadow-sm flex flex-col justify-end min-h-[340px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <Palette className="w-10 h-10 text-primary mb-6 relative z-10" />
            <div className="relative z-10 max-w-sm">
              <h3 className="text-2xl font-bold tracking-tight mb-3">Advanced Customization</h3>
              <p className="text-muted-foreground leading-relaxed">Tune typography, layout, color palettes, and animation physics globally or clip-by-clip.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-32 px-6 bg-surface border-y border-border/30 relative">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-headline-md font-bold tracking-tight text-foreground">
            From raw to rendered <span className="text-muted-foreground font-medium">in minutes.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-12 relative">
          <div className="hidden md:block absolute top-10 left-6 right-6 h-px bg-border/50 z-0" />
          {[
            { step: '01', title: 'Upload', desc: 'Drop your video. Our AI generates perfect word-level timestamps in seconds.' },
            { step: '02', title: 'Choose', desc: 'Select from our premium kinetic typography templates.' },
            { step: '03', title: 'Edit', desc: 'Correct text, set Hero words, and adjust colors in real-time.' },
            { step: '04', title: 'Render', desc: 'Export high-quality MP4 with hard-burned subtitles instantly.' }
          ].map((item, i) => (
            <div key={i} className="relative z-10 flex flex-col pt-4 md:pt-0">
              <div className="w-20 h-20 rounded-2xl bg-background border border-border/50 shadow-sm flex items-center justify-center text-xl font-bold font-mono text-foreground mb-8">
                {item.step}
              </div>
              <h3 className="text-lg font-bold tracking-tight mb-3">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TemplateShowcase() {
  return (
    <section id="templates" className="py-32 px-6 bg-background overflow-hidden relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-headline-md font-bold tracking-tight text-foreground mb-4">
              Premium <span className="text-muted-foreground font-medium">Styles</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Stop using the same templates as everyone else. Stand out with carefully crafted typography inspired by editorial design.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TEMPLATES.slice(0, 4).map((t, i) => (
            <motion.div 
              key={t.id} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: "easeOut" }}
              className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-surface border border-border/40 shadow-sm flex flex-col items-center justify-center p-8 text-center hover:shadow-lg hover:border-border/80 transition-all cursor-pointer"
            >
              <div 
                className="text-3xl mb-4 leading-[1.1] break-words max-w-full"
                style={{ 
                  fontFamily: t.fontFamily, 
                  fontWeight: t.fontWeight, 
                  fontStyle: t.fontStyle, 
                  textTransform: t.textTransform as any,
                  color: t.baseColor 
                }}
              >
                THIS IS <br/>
                <span style={{ color: t.heroColor, fontSize: '1.2em' }}>{t.name}</span>
              </div>
              <div className="absolute bottom-6 inset-x-6 text-left opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">{t.category || 'TEMPLATE'}</div>
                <div className="text-xs text-muted-foreground mt-2 leading-relaxed">{t.description}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorShowcase() { return null; }
export function WordLevelSection() { return null; }

export function PricingSection() {
  return (
    <section id="pricing" className="py-32 px-6 bg-surface border-y border-border/30">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-headline-md font-bold tracking-tight text-foreground mb-6">
          Simple pricing.
        </h2>
        <p className="text-muted-foreground text-lg mb-16">Start for free. Upgrade when you need more power.</p>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div className="p-10 rounded-[2.5rem] bg-background border border-border/50 text-left shadow-sm">
            <h3 className="text-2xl font-bold mb-2">Creator</h3>
            <div className="text-4xl font-bold mb-6">$0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> 10 mins of generation</li>
              <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> 720p export</li>
              <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Basic templates</li>
            </ul>
            <button className="w-full py-4 rounded-full bg-surface text-foreground font-bold border border-border hover:bg-surface-container-low transition-colors">Start Free</button>
          </div>
          
          <div className="p-10 rounded-[2.5rem] bg-foreground text-background text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Sparkles className="w-32 h-32" />
            </div>
            <h3 className="text-2xl font-bold mb-2 relative z-10">Pro</h3>
            <div className="text-4xl font-bold mb-6 relative z-10">$15<span className="text-lg text-background/60 font-normal">/mo</span></div>
            <ul className="space-y-4 mb-10 relative z-10">
              <li className="flex items-center gap-3 text-background/80"><CheckCircle2 className="w-5 h-5 text-primary" /> 120 mins of generation</li>
              <li className="flex items-center gap-3 text-background/80"><CheckCircle2 className="w-5 h-5 text-primary" /> 4K export</li>
              <li className="flex items-center gap-3 text-background/80"><CheckCircle2 className="w-5 h-5 text-primary" /> Premium templates</li>
              <li className="flex items-center gap-3 text-background/80"><CheckCircle2 className="w-5 h-5 text-primary" /> No watermark</li>
            </ul>
            <button className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all relative z-10">Upgrade to Pro</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="py-32 px-6 bg-background">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-headline-md font-bold tracking-tight text-foreground mb-16 text-center">
          Frequently asked questions
        </h2>
        <div className="space-y-8">
          {[
            { q: "What video formats do you support?", a: "We support MP4, MOV, and WebM files up to 200MB or 10 minutes in length." },
            { q: "Do you support languages other than English?", a: "Yes, our AI transcription engine supports over 90 languages including Spanish, French, Hindi, and Japanese." },
            { q: "Can I use my own custom fonts?", a: "Custom font upload is available on our Pro plan. For Creator users, we provide a curated selection of 20+ premium fonts." }
          ].map((faq, i) => (
            <div key={i} className="pb-8 border-b border-border/30">
              <h3 className="text-xl font-bold mb-3">{faq.q}</h3>
              <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
