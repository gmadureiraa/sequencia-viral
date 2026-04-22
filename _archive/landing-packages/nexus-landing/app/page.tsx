import { Navigation } from "@nexus/components/landing/navigation";
import { HeroSection } from "@nexus/components/landing/hero-section";
import { FeaturesSection } from "@nexus/components/landing/features-section";
import { HowItWorksSection } from "@nexus/components/landing/how-it-works-section";
import { InfrastructureSection } from "@nexus/components/landing/infrastructure-section";
import { MetricsSection } from "@nexus/components/landing/metrics-section";
import { IntegrationsSection } from "@nexus/components/landing/integrations-section";
import { SecuritySection } from "@nexus/components/landing/security-section";
import { DevelopersSection } from "@nexus/components/landing/developers-section";
import { CtaSection } from "@nexus/components/landing/cta-section";
import { FooterSection } from "@nexus/components/landing/footer-section";

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
