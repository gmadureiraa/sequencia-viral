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
 * Variante /landing/v5 — ANGLE: ANTI-CANVA
 * Target: já usa Canva, sente atrito com templates, quer sair.
 * Hipótese: converte melhor quem já tem a dor da ferramenta atual e
 * reconhece o processo manual como limitador.
 * Evento PostHog: lp_viewed { lp_variant: "anti-canva" }
 */
export default function LandingAntiCanva() {
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
      <LpVariantTracker variant="anti-canva" />
      <TopNav />
      <Hero
        eyebrow="O Canva não foi feito pra carrossel"
        h1={
          <>
            <span className="block">Pare de arrastar</span>
            <span className="block">
              <span className="sv-splash">caixa de texto</span>.
            </span>
            <span className="block">
              Comece a <span className="sv-under">escrever</span>.
            </span>
          </>
        }
        subtitle={
          <>
            Canva é ótimo pra identidade visual. Péssimo pra carrossel.{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
              Arrastar, alinhar, copiar, colar 8 vezes
            </b>{" "}
            — você achou que ia ter ideia, tá operando ferramenta. Aqui é ao contrário.
          </>
        }
        primaryCtaLabel="Sair do Canva grátis →"
        topBadge="✦ Zero Canva"
        bottomBadge="Fim do arrasta-e-solta"
        trustPills={["Zero template", "Sem cartão", "Export direto"]}
      />
      <Ticker />
      <PainSection
        sub="Ferramenta errada, processo certo"
        tag="Canva fatigue"
        heading={
          <>
            200 templates <em>iguais</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Mesmo atalho que todo mundo já descobriu.
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
        eyebrow="Troca o workflow"
        heading={
          <>
            Último carrossel no Canva.
            <br />
            <em style={{ color: "var(--sv-green)" }}>Seja hoje.</em>
          </>
        }
        subtitle="Cola o link do seu vídeo/post/texto. A IA entrega carrossel editorial pronto. Seu Canva que desculpe."
        primaryCtaLabel="Fazer o teste →"
      />
      <Footer />
    </main>
  );
}
