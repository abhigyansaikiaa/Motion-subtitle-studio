import React from 'react';
import { ArrowUpRight } from 'lucide-react';

const COLS: { head: string; links: { label: string; href: string }[] }[] = [
  {
    head: 'Product',
    links: [
      { label: 'Studio', href: '#/studio' },
      { label: 'Styles', href: '#templates' },
      { label: 'Editor', href: '#editor' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    head: 'Workflow',
    links: [
      { label: 'Upload', href: '#how-it-works' },
      { label: 'Transcribe', href: '#how-it-works' },
      { label: 'Render', href: '#how-it-works' },
    ],
  },
  {
    head: 'Company',
    links: [
      { label: 'Principles', href: '#features' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="w-full bg-background text-foreground border-t border-foreground/15 overflow-hidden">
      <div className="max-w-[100rem] mx-auto px-6 md:px-10 pt-20 md:pt-28">
        <div className="grid md:grid-cols-[1fr_2fr] gap-16 pb-20 md:pb-28">
          <div>
            <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/45 mb-6">
              [ Motion Subtitle Studio ]
            </p>
            <p className="text-foreground/55 font-grotesk leading-relaxed max-w-xs">
              The word-level caption engine for creators who care how every
              syllable lands.
            </p>
            <a
              href="#/studio"
              className="mt-8 inline-flex items-center gap-2 font-grotesk font-semibold text-sm uppercase tracking-widest border-b border-foreground/40 pb-1 hover:border-foreground transition-colors"
            >
              Open the studio <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
            {COLS.map(c => (
              <div key={c.head}>
                <h4 className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/40 mb-6">
                  {c.head}
                </h4>
                <ul className="space-y-4">
                  {c.links.map(l => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="font-grotesk text-sm uppercase tracking-widest text-foreground/65 hover:text-foreground transition-colors"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Giant wordmark */}
      <div className="px-2 select-none" aria-hidden>
        <div className="font-editorial font-extrabold uppercase leading-[0.8] tracking-tight text-center whitespace-nowrap text-[8.5vw] text-foreground/[0.92]">
          Motion Subtitle
        </div>
      </div>

      <div className="border-t border-foreground/15 mt-6">
        <div className="max-w-[100rem] mx-auto px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/40">
            © {new Date().getFullYear()} Motion Subtitle Studio
          </span>
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/40">
            set in Syne & Jakarta — rendered with care
          </span>
        </div>
      </div>
    </footer>
  );
}
