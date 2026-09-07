import React from 'react';
import { Navbar } from '../components/marketing/navbar';
import { HeroShowcase } from '../components/ui/hero-showcase';
import { 
  FeaturesSection, 
  HowItWorksSection, 
  TemplateShowcase, 
  PricingSection,
  FAQSection 
} from '../components/marketing/marketing-sections';
import { FooterSection } from '../components/ui/footer-section';

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroShowcase />
        <FeaturesSection />
        <HowItWorksSection />
        <TemplateShowcase />
        <PricingSection />
        <FAQSection />
      </main>
      <FooterSection />
    </div>
  );
}
