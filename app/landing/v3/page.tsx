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
 * Variante /landing/v3 — ANGLE: VOZ / AUTENTICIDADE
 * Target: creator com marca já estabelecida, medo de parecer "feito com IA".
 * Hipótese: converte melhor quem teme diluir identidade com ferramentas genéricas.
 * Evento PostHog: lp_viewed { lp_variant: "voz" }
 */
export default function LandingVoz() {
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
      <LpVariantTracker variant="voz" />
      <TopNav />
      <Hero
        eyebrow="Sua voz · não ChatGPT"
        h1={
          <>
            <span className="block">Seu carrossel.</span>
            <span className="block">
              Sem cara de <span className="sv-splash">IA</span>.
            </span>
            <span className="block">
              Com a <span className="sv-under">sua voz</span>.
            </span>
          </>
        }
        subtitle={
          <>
            A IA aprende seu tom com 3 posts reais seus e replica em cada slide.{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
              Seus tiques de linguagem, sua cadência, seus exemplos
            </b>
            . Você relê e reconhece como seu.
          </>
        }
        primaryCtaLabel="Testar com minha voz →"
        topBadge="✦ DNA editorial"
        bottomBadge="Sua voz · não template"
        trustPills={["Aprende em 3 posts", "Sem cartão", "5 carrosséis grátis"]}
      />
      <Ticker />
      <PainSection
        sub="A diluição silenciosa"
        tag="Já sentiu?"
        heading={
          <>
            <em>ChatGPT</em> é ótimo.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Mas todo mundo usa. Dá pra reconhecer no primeiro parágrafo.
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
        eyebrow="Seu primeiro carrossel com sua voz"
        heading={
          <>
            Posta um carrossel
            <br />
            <em style={{ color: "var(--sv-green)" }}>que é seu.</em>
          </>
        }
        subtitle="Ninguém precisa saber que teve IA no meio. A única assinatura visível é a sua."
        primaryCtaLabel="Treinar a IA com minha voz →"
      />
      <Footer />
    </main>
  );
}
