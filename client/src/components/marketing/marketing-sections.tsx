import React from 'react';
import { motion } from 'motion/react';
import { TEMPLATES } from '../../lib/templates';
import { Sparkles, Zap, LayoutTemplate, Palette, CheckCircle2 } from 'lucide-react';

export function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 bg-surface-container-lowest relative overflow-hidden border-b border-border/20">
      <div className="max-w-[90rem] mx-auto">
        <div className="text-left mb-20 border-b-2 border-primary pb-8">
          <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">Core Principles</h2>
          <h3 className="font-editorial text-7xl font-bold tracking-tighter text-on-surface uppercase leading-[0.85]">
            Designed for impact. <br/>
            <span className="text-primary font-light italic">Built for creators.</span>
          </h3>
        </div>

        {/* Brutalist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t-2 border-l-2 border-border/20">
          
          <div className="md:col-span-2 p-12 lg:p-20 bg-surface-container-low border-r-2 border-b-2 border-border/20 flex flex-col justify-end min-h-[400px] relative overflow-hidden group hover:bg-surface-container transition-colors">
            <div className="absolute top-10 right-10 opacity-5 group-hover:opacity-20 transition-opacity">
              <Zap className="w-64 h-64 text-primary" />
            </div>
            <div className="relative z-10 max-w-lg">
              <h3 className="font-editorial text-5xl font-bold tracking-tighter mb-4 text-on-surface uppercase leading-none">Kinetic<br/>Typography</h3>
              <p className="text-muted-foreground leading-relaxed font-grotesk text-lg">Words don't just appear. They move, scale, and color-fill in perfect sync with your voice. Built with hardware-accelerated transforms.</p>
            </div>
          </div>

          <div className="p-12 bg-surface-container-low border-r-2 border-b-2 border-border/20 flex flex-col justify-end min-h-[400px] group hover:bg-surface-container transition-colors">
            <LayoutTemplate className="w-16 h-16 text-primary mb-8 opacity-50 group-hover:opacity-100 transition-opacity" />
            <h3 className="font-editorial text-4xl font-bold tracking-tighter mb-4 text-on-surface uppercase leading-none">Editorial<br/>Composition</h3>
            <p className="text-muted-foreground leading-relaxed font-grotesk text-sm">Ditch the ugly lower-thirds. Our templates treat your video like a premium magazine spread.</p>
          </div>

          <div className="p-12 bg-surface-container-low border-r-2 border-b-2 border-border/20 flex flex-col justify-end min-h-[400px] group hover:bg-surface-container transition-colors">
            <Sparkles className="w-16 h-16 text-primary mb-8 opacity-50 group-hover:opacity-100 transition-opacity" />
            <h3 className="font-editorial text-4xl font-bold tracking-tighter mb-4 text-on-surface uppercase leading-none">Word-Level<br/>Control</h3>
            <p className="text-muted-foreground leading-relaxed font-grotesk text-sm">Make any word a Hero word with a single click. Total control over timing and style.</p>
          </div>

          <div className="md:col-span-2 p-12 lg:p-20 bg-surface-container-low border-r-2 border-b-2 border-border/20 flex flex-col justify-end min-h-[400px] relative overflow-hidden group hover:bg-surface-container transition-colors">
            <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />
            <Palette className="w-16 h-16 text-primary mb-8 relative z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 max-w-lg">
              <h3 className="font-editorial text-5xl font-bold tracking-tighter mb-4 text-on-surface uppercase leading-none">Advanced<br/>Customization</h3>
              <p className="text-muted-foreground leading-relaxed font-grotesk text-lg">Tune typography, layout, color palettes, and animation physics globally or clip-by-clip.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-32 px-6 bg-on-surface border-y border-border/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none" />
      <div className="max-w-[90rem] mx-auto relative z-10">
        <div className="text-left mb-24 border-b-2 border-surface-container-lowest/20 pb-8">
          <h2 className="text-[10px] font-bold tracking-widest text-surface-container-lowest/60 uppercase mb-4">Workflow</h2>
          <h2 className="font-editorial text-7xl font-bold tracking-tighter text-surface-container-lowest uppercase leading-[0.85]">
            From raw to rendered <br/><span className="font-light italic text-surface-container-lowest/60">in minutes.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-0 border-t-2 border-l-2 border-surface-container-lowest/20">
          {[
            { step: '01', title: 'Upload', desc: 'Drop your video. Our AI generates perfect word-level timestamps in seconds.' },
            { step: '02', title: 'Choose', desc: 'Select from our premium kinetic typography templates.' },
            { step: '03', title: 'Edit', desc: 'Correct text, set Hero words, and adjust colors in real-time.' },
            { step: '04', title: 'Render', desc: 'Export high-quality MP4 with hard-burned subtitles instantly.' }
          ].map((item, i) => (
            <div key={i} className="relative z-10 flex flex-col p-12 border-r-2 border-b-2 border-surface-container-lowest/20 hover:bg-surface-container-lowest/5 transition-colors">
              <div className="text-6xl font-bold font-editorial text-surface-container-lowest/20 mb-8 leading-none">
                {item.step}
              </div>
              <h3 className="font-editorial text-4xl font-bold tracking-tighter mb-4 text-surface-container-lowest uppercase leading-none">{item.title}</h3>
              <p className="text-surface-container-lowest/60 text-sm leading-relaxed font-grotesk">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TemplateShowcase() {
  return (
    <section id="templates" className="py-32 px-6 bg-surface-container-lowest overflow-hidden relative border-b border-border/20">
      <div className="max-w-[90rem] mx-auto">
        <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8 border-b-2 border-primary pb-8">
          <div className="max-w-3xl">
            <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">Aesthetics</h2>
            <h2 className="font-editorial text-7xl font-bold tracking-tighter text-on-surface uppercase leading-[0.85]">
              Premium <span className="font-light italic text-primary">Styles</span>
            </h2>
            <p className="text-muted-foreground text-xl mt-6 font-grotesk max-w-2xl">
              Stop using the same templates as everyone else. Stand out with carefully crafted typography inspired by editorial design.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-t-2 border-l-2 border-border/20">
          {TEMPLATES.slice(0, 4).map((t, i) => (
            <motion.div 
              key={t.id} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: "easeOut" }}
              className="group relative aspect-[4/5] overflow-hidden bg-surface-container-low border-r-2 border-b-2 border-border/20 flex flex-col items-center justify-center p-8 text-center hover:bg-surface-container transition-colors cursor-pointer"
            >
              <div 
                className="text-4xl mb-4 leading-[1.1] break-words max-w-full uppercase"
                style={{ 
                  fontFamily: t.fontFamily, 
                  fontWeight: t.fontWeight, 
                  fontStyle: t.fontStyle, 
                  color: t.baseColor 
                }}
              >
                THIS IS <br/>
                <span style={{ color: t.heroColor, fontSize: '1.2em' }}>{t.name}</span>
              </div>
              <div className="absolute bottom-0 inset-x-0 p-6 bg-surface-container-high/90 border-t-2 border-border/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex flex-col text-left">
                <div className="font-editorial text-sm uppercase tracking-widest text-primary font-bold mb-2">{t.category || 'TEMPLATE'}</div>
                <div className="text-sm text-on-surface leading-relaxed font-grotesk">{t.description}</div>
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
    <section id="pricing" className="py-32 px-6 bg-surface-container-lowest border-b border-border/20">
      <div className="max-w-[90rem] mx-auto text-left">
        <div className="border-b-2 border-primary pb-8 mb-20">
          <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">Investment</h2>
          <h2 className="font-editorial text-7xl font-bold tracking-tighter text-on-surface uppercase leading-[0.85]">
            Simple pricing.
          </h2>
          <p className="text-muted-foreground text-xl mt-6 font-grotesk max-w-2xl">Start for free. Upgrade when you need more power.</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-0 border-t-2 border-l-2 border-border/20 max-w-5xl mx-auto">
          <div className="p-12 lg:p-16 bg-surface-container-low border-r-2 border-b-2 border-border/20 text-left flex flex-col">
            <h3 className="font-editorial text-5xl font-bold tracking-tighter mb-2 uppercase text-on-surface">Creator</h3>
            <div className="text-6xl font-editorial font-bold mb-10 text-on-surface">$0<span className="text-2xl text-muted-foreground font-grotesk font-normal">/mo</span></div>
            <ul className="space-y-6 mb-12 flex-1 font-grotesk text-lg">
              <li className="flex items-center gap-4 text-muted-foreground"><CheckCircle2 className="w-6 h-6 text-primary" /> 10 mins of generation</li>
              <li className="flex items-center gap-4 text-muted-foreground"><CheckCircle2 className="w-6 h-6 text-primary" /> 720p export</li>
              <li className="flex items-center gap-4 text-muted-foreground"><CheckCircle2 className="w-6 h-6 text-primary" /> Basic templates</li>
            </ul>
            <button className="w-full py-6 bg-transparent text-on-surface font-bold border-2 border-border/20 hover:border-on-surface transition-colors uppercase tracking-widest text-sm">Start Free</button>
          </div>
          
          <div className="p-12 lg:p-16 bg-on-surface text-surface-container-lowest text-left relative overflow-hidden border-r-2 border-b-2 border-border/20 flex flex-col">
            <div className="absolute top-10 right-10 opacity-10">
              <Sparkles className="w-48 h-48" />
            </div>
            <h3 className="font-editorial text-5xl font-bold tracking-tighter mb-2 uppercase relative z-10 text-surface-container-lowest">Pro</h3>
            <div className="text-6xl font-editorial font-bold mb-10 relative z-10 text-surface-container-lowest">$15<span className="text-2xl text-surface-container-lowest/60 font-grotesk font-normal">/mo</span></div>
            <ul className="space-y-6 mb-12 flex-1 font-grotesk text-lg relative z-10">
              <li className="flex items-center gap-4 text-surface-container-lowest/80"><CheckCircle2 className="w-6 h-6 text-primary" /> 120 mins of generation</li>
              <li className="flex items-center gap-4 text-surface-container-lowest/80"><CheckCircle2 className="w-6 h-6 text-primary" /> 4K export</li>
              <li className="flex items-center gap-4 text-surface-container-lowest/80"><CheckCircle2 className="w-6 h-6 text-primary" /> Premium templates</li>
              <li className="flex items-center gap-4 text-surface-container-lowest/80"><CheckCircle2 className="w-6 h-6 text-primary" /> No watermark</li>
            </ul>
            <button className="w-full py-6 bg-primary text-on-primary font-bold hover:brightness-110 transition-all relative z-10 uppercase tracking-widest text-sm border-2 border-primary">Upgrade to Pro</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="py-32 px-6 bg-surface-container-lowest">
      <div className="max-w-4xl mx-auto">
        <div className="border-b-2 border-primary pb-8 mb-20 text-center">
          <h2 className="font-editorial text-7xl font-bold tracking-tighter text-on-surface uppercase leading-[0.85]">
            Frequently asked questions
          </h2>
        </div>
        <div className="grid gap-0 border-t-2 border-l-2 border-border/20">
          {[
            { q: "What video formats do you support?", a: "We support MP4, MOV, and WebM files up to 200MB or 10 minutes in length." },
            { q: "Do you support languages other than English?", a: "Yes, our AI transcription engine supports over 90 languages including Spanish, French, Hindi, and Japanese." },
            { q: "Can I use my own custom fonts?", a: "Custom font upload is available on our Pro plan. For Creator users, we provide a curated selection of 20+ premium fonts." }
          ].map((faq, i) => (
            <div key={i} className="p-12 border-r-2 border-b-2 border-border/20 bg-surface-container-low hover:bg-surface-container transition-colors">
              <h3 className="font-editorial text-3xl font-bold mb-4 uppercase tracking-tighter text-on-surface leading-none">{faq.q}</h3>
              <p className="text-muted-foreground leading-relaxed font-grotesk text-lg">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
