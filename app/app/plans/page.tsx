"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLANS, FREE_PLAN_USAGE_LIMIT, formatBrl } from "@/lib/pricing";
import posthog from "posthog-js";

type Interval = "month" | "year";

type PlanCard = {
  id: "free" | "pro" | "business";
  number: string;
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  features: readonly string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
};

const FREE_FEATURES = [
  `${FREE_PLAN_USAGE_LIMIT} carrosséis grátis pra testar`,
  "Até 12 slides por carrossel",
  "Todas as origens (YouTube, blog, Instagram, ideia)",
  "Editor completo e export PNG",
  "Template Thread (X) padrão",
];

const CREATOR_FEATURES = PLANS.pro.features.slice(0, 7);
// Pro features construidas manualmente pra enfatizar 'Tudo que Creator tem' +
// diferenciais reais (acesso antecipado, agendamento, suporte prioritario).
// Nao puxamos de PLANS.business.features — aquele e mais detalhado e repetia
// coisas do Creator.
const PRO_FEATURES = [
  "300 carrosséis/mês",
  "Tudo que o Creator tem",
  "Acesso antecipado a novos templates",
  "Agendamento + publicação automática (em breve)",
  "Export PNG + PDF",
  "Suporte prioritário",
];

function buildCards(interval: Interval): PlanCard[] {
  const annual = interval === "year";

  // Valores vem de lib/pricing.ts em centavos BRL. Mensal-equivalente do
  // anual = priceAnnual / 12 (ex: 47040/12 = 3920 = R$ 39,20).
  const creatorMonthly = PLANS.pro.priceMonthly; // 4900
  const creatorAnnualTotal = PLANS.pro.priceAnnual; // 47040
  const creatorAnnualMonthlyEquiv = Math.round(creatorAnnualTotal / 12);

  const proMonthly = PLANS.business.priceMonthly; // 9700
  const proAnnualTotal = PLANS.business.priceAnnual; // 93120
  const proAnnualMonthlyEquiv = Math.round(proAnnualTotal / 12);

  return [
    {
      id: "free",
      number: "01",
      name: "Grátis",
      price: "R$ 0",
      priceNote: "pra sempre",
      tagline: "Pra testar o fluxo sem compromisso.",
      features: FREE_FEATURES,
      ctaLabel: "Começar agora",
      ctaHref: "/app/login",
    },
    {
      id: "pro",
      number: "02",
      name: PLANS.pro.name, // "Creator"
      price: annual
        ? formatBrl(creatorAnnualMonthlyEquiv)
        : formatBrl(creatorMonthly),
      priceNote: annual
        ? `por mês · total anual ${formatBrl(creatorAnnualTotal)}`
        : "por mês · preço de lançamento",
      tagline: annual
        ? "Pra quem posta toda semana — 20% off no anual."
        : "Pra quem posta toda semana.",
      features: CREATOR_FEATURES,
      ctaLabel: annual ? `Assinar ${PLANS.pro.name} anual` : `Assinar ${PLANS.pro.name}`,
      ctaHref: `/app/checkout?plan=pro${annual ? "&interval=year" : ""}`,
      highlight: true,
    },
    {
      id: "business",
      number: "03",
      name: PLANS.business.name, // "Pro"
      price: annual
        ? formatBrl(proAnnualMonthlyEquiv)
        : formatBrl(proMonthly),
      priceNote: annual
        ? `por mês · total anual ${formatBrl(proAnnualTotal)}`
        : "por mês · preço de lançamento",
      tagline: annual
        ? "Pra quem posta todo dia — 20% off no anual."
        : "Pra quem posta todo dia.",
      features: PRO_FEATURES,
      ctaLabel: annual
        ? `Assinar ${PLANS.business.name} anual`
        : `Assinar ${PLANS.business.name}`,
      ctaHref: `/app/checkout?plan=business${annual ? "&interval=year" : ""}`,
    },
  ];
}

const FAQ = [
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Cancela pelo portal do Stripe nas configurações. O plano fica ativo até o fim do ciclo e depois volta pro grátis.",
  },
  {
    q: "Meus carrosséis ficam salvos se eu voltar pro grátis?",
    a: "Tudo que você já gerou permanece. O limite mensal só afeta novas gerações a partir do downgrade.",
  },
  {
    q: "Tem plano anual?",
    a: "Sim. O anual dá 20% de desconto vs mensal (Creator sai R$ 39,20/mês cobrado anual, Pro R$ 77,60/mês). Cancele quando quiser, reembolso se cancelar no mês que assinou.",
  },
  {
    q: "O preço é em real?",
    a: "Sim. Cobrado em BRL via Stripe, direto no cartão brasileiro. Sem spread cambial, sem IOF de fatura internacional.",
  },
  {
    q: "Qual a diferença entre Creator e Pro?",
    a: "Creator é pra quem publica 2-3× por semana (10 carrosséis/mês). Pro é pra quem publica todo dia ou gerencia mais de uma marca (300 carrosséis/mês + suporte prioritário). Ambos geram carrosséis de até 12 slides.",
  },
];

export default function PlansPage() {
  const { profile } = useAuth();
  const currentPlan = profile?.plan ?? "free";
  const [interval, setInterval] = useState<Interval>("month");
  const CARDS = buildCards(interval);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <span className="sv-eyebrow mb-6">
          <span className="sv-dot" />
          Planos · Edição nº 04
        </span>
        <h1
          className="sv-display mt-6"
          style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            maxWidth: 920,
          }}
        >
          Escolha o plano que <em>cabe</em> no seu ritmo.
        </h1>
        <p
          className="mt-5"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 17,
            color: "var(--sv-muted)",
            maxWidth: 640,
            lineHeight: 1.5,
          }}
        >
          Todos os planos: todas as origens, modo avançado, export em PNG e PDF.
          A diferença é quantos carrosséis por mês e os extras de workflow.
        </p>
      </motion.div>

      {/* Interval toggle */}
      <div
        className="mt-8 inline-flex items-center gap-[2px]"
        style={{
          padding: 3,
          border: "1.5px solid var(--sv-ink)",
          background: "var(--sv-white)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
        }}
      >
        {(["month", "year"] as const).map((v) => {
          const on = interval === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setInterval(v)}
              className="uppercase"
              style={{
                padding: "8px 16px",
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.18em",
                fontWeight: 700,
                background: on ? "var(--sv-ink)" : "transparent",
                color: on ? "var(--sv-paper)" : "var(--sv-ink)",
                border: "none",
                cursor: "pointer",
                transition: "background .15s, color .15s",
              }}
            >
              {v === "month" ? "Mensal" : "Anual"}
              {v === "year" && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "1px 6px",
                    background: "var(--sv-green)",
                    color: "var(--sv-ink)",
                    fontSize: 8.5,
                    letterSpacing: "0.12em",
                  }}
                >
                  −20%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Plans grid */}
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {CARDS.map((card, i) => {
          const isCurrent = currentPlan === card.id;
          const isInk = card.highlight;

          return (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={isInk ? "sv-card-ink relative" : "sv-card relative"}
              style={{ padding: 28, minHeight: "auto", display: "flex", flexDirection: "column" }}
            >
              {isInk && (
                <span
                  className="absolute left-6 inline-flex items-center gap-1.5"
                  style={{
                    top: -14,
                    padding: "6px 12px",
                    background: "var(--sv-green)",
                    border: "1.5px solid var(--sv-paper)",
                    color: "var(--sv-ink)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    boxShadow: "3px 3px 0 0 var(--sv-ink)",
                  }}
                >
                  ✦ Mais escolhido
                </span>
              )}

              <div>
                <span
                  className="sv-kicker"
                  style={{
                    color: isInk ? "rgba(247,245,239,0.6)" : "var(--sv-muted)",
                  }}
                >
                  ● Plano · Nº {card.number}
                </span>

                <h2
                  className="sv-display mt-4"
                  style={{
                    fontSize: 40,
                    lineHeight: 1,
                    letterSpacing: "-0.01em",
                    color: isInk ? "var(--sv-paper)" : "var(--sv-ink)",
                  }}
                >
                  {card.name}
                </h2>

                <p
                  className="mt-2"
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 14,
                    color: isInk ? "rgba(247,245,239,0.7)" : "var(--sv-muted)",
                  }}
                >
                  {card.tagline}
                </p>
              </div>

              <div className="mt-7 flex items-baseline gap-2">
                <span
                  className="sv-display"
                  style={{
                    fontSize: 56,
                    lineHeight: 0.9,
                    letterSpacing: "-0.02em",
                    color: isInk ? "var(--sv-paper)" : "var(--sv-ink)",
                  }}
                >
                  {card.price}
                </span>
                <span
                  className="sv-kicker-sm"
                  style={{
                    color: isInk ? "rgba(247,245,239,0.6)" : "var(--sv-muted)",
                  }}
                >
                  /{card.priceNote}
                </span>
              </div>

              <ul className="mt-7 flex-1 space-y-3">
                {card.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5"
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: isInk ? "rgba(247,245,239,0.92)" : "var(--sv-ink)",
                    }}
                  >
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--sv-green)" }}
                      strokeWidth={2.5}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {isCurrent ? (
                  <div
                    className="flex w-full items-center justify-center gap-2 px-5 py-3"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 10.5,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      border: `1.5px solid ${isInk ? "rgba(247,245,239,0.25)" : "rgba(10,10,10,0.25)"}`,
                      color: isInk ? "rgba(247,245,239,0.6)" : "var(--sv-muted)",
                      background: "transparent",
                    }}
                  >
                    <Check size={13} /> Plano atual
                  </div>
                ) : (
                  <Link
                    href={card.ctaHref}
                    onClick={() =>
                      posthog.capture("plans_cta_clicked", {
                        plan: card.id,
                        from_plan: currentPlan,
                      })
                    }
                    className={isInk ? "sv-btn-primary" : "sv-btn-outline"}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    {card.ctaLabel}
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* FAQ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mt-16"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="sv-kicker" style={{ color: "var(--sv-muted)" }}>
              ● FAQ rápido
            </span>
            <h2
              className="sv-display mt-2"
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            >
              Perguntas <em>rápidas</em>.
            </h2>
          </div>
        </div>

        <hr className="sv-divider" />

        <dl className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt
                className="sv-kicker mb-2"
                style={{ color: "var(--sv-ink)" }}
              >
                {item.q}
              </dt>
              <dd
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--sv-muted)",
                }}
              >
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </motion.section>
    </div>
  );
}
