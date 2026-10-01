import React from 'react';
import { Navbar } from '../components/marketing/navbar';
import { LenisHero } from '../components/marketing/lenis-hero';
import { TemplateMarquee } from '../components/marketing/template-marquee';
import {
  FeaturesSection,
  HowItWorksSection,
  TemplateShowcase,
  EditorShowcase,
  WordLevelSection,
  PricingSection,
  FAQSection,
} from '../components/marketing/marketing-sections';
import { FooterSection } from '../components/ui/footer-section';

export function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Navbar />
      <main>
        <LenisHero />
        <TemplateMarquee />
        <FeaturesSection />
        <HowItWorksSection />
        <TemplateShowcase />
        <EditorShowcase />
        <WordLevelSection />
        <PricingSection />
        <FAQSection />
      </main>
      <FooterSection />
    </div>
  );
}
