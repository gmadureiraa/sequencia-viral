import { TopNav } from "@/components/landing/top-nav";
import { Hero } from "@/components/landing/hero";
import { Ticker } from "@/components/landing/shared";
import { PainSection } from "@/components/landing/pain-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DemoSection } from "@/components/landing/demo-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CompareSection } from "@/components/landing/compare-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { LpVariantTracker } from "@/components/landing/lp-variant-tracker";

/**
 * Variante /landing/v2 — ANGLE: VELOCIDADE
 * Target: criador exausto, poucos posts/mês, sente peso do tempo.
 * Hipótese: converte melhor quem sente fricção de tempo no processo atual.
 * Evento PostHog: lp_viewed { lp_variant: "velocidade" }
 */
export default function LandingVelocidade() {
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
      <LpVariantTracker variant="velocidade" />
      <TopNav />
      <Hero
        eyebrow="3h no Canva · 15s aqui"
        h1={
          <>
            <span className="block">3 horas pra fazer</span>
            <span className="block">
              <span className="sv-splash">1 carrossel</span>.
            </span>
            <span className="block">
              Tá na <span className="sv-under">hora</span> de parar.
            </span>
          </>
        }
        subtitle={
          <>
            Quem tem agenda cheia não tem 3 horas pra arrastar caixinha no Canva.
            Cola um link,{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
              a IA escreve e monta em 15 segundos
            </b>
            . Você revisa, ajusta, posta.
          </>
        }
        primaryCtaLabel="Testar 5 grátis →"
        topBadge="✦ Em 15 seg"
        bottomBadge="Seu tempo de volta"
        trustPills={["~15s por carrossel", "Sem cartão", "Cancele quando quiser"]}
      />
      <Ticker />
      <PainSection
        sub="O que você gasta sem ver"
        tag="Realidade"
        heading={
          <>
            Você tem <em>ideia</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              E 3 horas por carrossel que não voltam.
            </span>
          </>
        }
      />
      <HowItWorks />
      <DemoSection />
      <FeaturesSection />
      <CompareSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTA
        eyebrow="Pronto pra ganhar a tarde de volta?"
        heading={
          <>
            Seu próximo carrossel
            <br />
            <em style={{ color: "var(--sv-green)" }}>em 15 segundos.</em>
          </>
        }
        subtitle="Cola um link. A IA escreve, monta, arte inclusa. Você só revisa."
        primaryCtaLabel="Testar grátis →"
      />
      <Footer />
    </main>
  );
}
