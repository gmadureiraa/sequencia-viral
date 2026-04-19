import { TopNav } from "@/components/landing/top-nav";
import { Hero } from "@/components/landing/hero";
import { Ticker } from "@/components/landing/shared";
import { PainSection } from "@/components/landing/pain-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Manifesto } from "@/components/landing/manifesto";
import { DemoSection } from "@/components/landing/demo-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CompareSection } from "@/components/landing/compare-section";
import { GallerySection } from "@/components/landing/gallery-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

/* ─────────────────────────────────────────────────────────────────
   Sequência Viral — Landing brutalist editorial (Kaleidos Digital)
   Orquestração dos componentes de landing. Design tokens em
   globals.css (.sv-*). Cada seção vive em components/landing/*.
   ───────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <main
      style={{
        background: "var(--sv-paper)",
        color: "var(--sv-ink)",
        fontFamily: "var(--sv-sans)",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <TopNav />
      <Hero />
      <Ticker />
      <PainSection />
      <HowItWorks />
      <Manifesto />
      <DemoSection />
      <FeaturesSection />
      <CompareSection />
      <GallerySection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
