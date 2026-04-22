import { Navigation } from "@optimus/components/landing/navigation";
import { HeroSection } from "@optimus/components/landing/hero-section";
import { FeaturesSection } from "@optimus/components/landing/features-section";
import { HowItWorksSection } from "@optimus/components/landing/how-it-works-section";
import { InfrastructureSection } from "@optimus/components/landing/infrastructure-section";
import { MetricsSection } from "@optimus/components/landing/metrics-section";
import { IntegrationsSection } from "@optimus/components/landing/integrations-section";
import { SecuritySection } from "@optimus/components/landing/security-section";
import { DevelopersSection } from "@optimus/components/landing/developers-section";
import { CtaSection } from "@optimus/components/landing/cta-section";
import { FooterSection } from "@optimus/components/landing/footer-section";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <InfrastructureSection />
      <MetricsSection />
      <IntegrationsSection />
      <SecuritySection />
      <DevelopersSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
