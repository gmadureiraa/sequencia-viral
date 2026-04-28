"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { REVEAL, SectionHead } from "./shared";

type Interval = "month" | "year";

function PlanCard({
  ribbon,
  ribbonVariant,
  tag,
  title,
  price,
  unit,
  anchor,
  features,
  cta,
  ctaHref,
  ctaVariant,
  featured = false,
  annualSaving,
}: {
  ribbon: string;
  ribbonVariant: "free" | "pro" | "biz";
  tag?: string;
  title: string;
  price: string;
  unit: string;
  anchor?: string;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaVariant: "primary" | "outline";
  featured?: boolean;
  annualSaving?: string;
}) {
  const ribbonBg =
    ribbonVariant === "free"
      ? "transparent"
      : ribbonVariant === "pro"
        ? "var(--sv-green)"
        : "var(--sv-pink)";
  const ribbonBorder =
    ribbonVariant === "free"
      ? "var(--sv-line)"
      : featured
        ? "var(--sv-green)"
        : "var(--sv-ink)";
  const ribbonColor =
    ribbonVariant === "free"
      ? "var(--sv-muted)"
      : featured && ribbonVariant === "pro"
        ? "var(--sv-green)"
        : "var(--sv-ink)";

  return (
    <motion.article
      {...REVEAL}
      className={`relative flex flex-col gap-[14px] p-5 sm:p-7 ${featured ? "sv-plan-featured" : ""}`}
      style={{
        background: featured ? "var(--sv-ink)" : "var(--sv-white)",
        color: featured ? "var(--sv-paper)" : "var(--sv-ink)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: featured ? "5px 5px 0 0 var(--sv-green)" : "5px 5px 0 0 var(--sv-ink)",
        transform: featured ? "translateY(-8px)" : undefined,
        transition: "transform .25s, box-shadow .25s",
      }}
    >
      <span
        className="self-start"
        style={{
          padding: "4px 10px",
          border: `1px solid ${ribbonBorder}`,
          background: featured && ribbonVariant === "pro" ? "transparent" : ribbonBg,
          color: ribbonColor,
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {ribbon}
      </span>
      {tag && (
        <span
          className="self-start"
          style={{
            padding: "3px 9px",
            background: featured ? "var(--sv-green)" : "var(--sv-pink)",
            color: "var(--sv-ink)",
            border: featured ? "1px solid var(--sv-green)" : "1px solid var(--sv-ink)",
            fontFamily: "var(--sv-mono)",
            fontSize: 8.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            boxShadow: featured ? "2px 2px 0 0 var(--sv-paper)" : "2px 2px 0 0 var(--sv-ink)",
          }}
        >
          {tag}
        </span>
      )}
      <h3
        className="sv-display"
        style={{
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 0.95,
          fontStyle: "italic",
          color: featured ? "var(--sv-paper)" : "var(--sv-ink)",
        }}
      >
        {title}
      </h3>
      <div>
        {anchor && (
          <span
            className="block"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              textDecoration: "line-through",
              color: featured ? "rgba(255,255,255,.5)" : "var(--sv-muted)",
            }}
          >
            {anchor}
          </span>
        )}
        <div className="flex items-baseline gap-[6px]">
          <span
            className="sv-display"
            style={{
              fontSize: 44,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              // Força cor explícita — sem isso, sv-display pode cascatear
              // cor do CSS global (sv-ink) mesmo em card featured escuro.
              color: featured ? "var(--sv-paper)" : "var(--sv-ink)",
            }}
          >
            {price}
          </span>
          {unit && (
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: featured ? "rgba(255,255,255,.6)" : "var(--sv-muted)",
              }}
            >
              {unit}
            </span>
          )}
        </div>
        {annualSaving && (
          <div
            className="mt-1"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--sv-green)",
              fontWeight: 700,
            }}
          >
            {annualSaving}
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-2" style={{ fontSize: 13 }}>
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span style={{ color: "var(--sv-green)", flexShrink: 0 }}>✦</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`sv-btn sv-btn-${ctaVariant === "primary" ? "primary" : "outline"} mt-auto w-full justify-center`}
        style={{ minHeight: 48, padding: "14px 20px", fontSize: 11.5 }}
      >
        {cta}
      </Link>
    </motion.article>
  );
}

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: Interval;
  onChange: (i: Interval) => void;
}) {
  return (
    <motion.div
      {...REVEAL}
      className="mb-8 inline-flex items-center gap-[2px]"
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
            onClick={() => onChange(v)}
            className="uppercase"
            style={{
              padding: "10px 16px",
              minHeight: 40,
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.16em",
              fontWeight: 700,
              background: on ? "var(--sv-ink)" : "transparent",
              color: on ? "var(--sv-paper)" : "var(--sv-ink)",
              border: "none",
              cursor: "pointer",
              transition: "background .15s, color .15s",
              position: "relative",
            }}
          >
            {v === "month" ? "Mensal" : "Anual"}
            {v === "year" && (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1px 6px",
                  background: on ? "var(--sv-green)" : "var(--sv-green)",
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
    </motion.div>
  );
}

export function PricingSection() {
  const [interval, setInterval] = useState<Interval>("month");
  const isAnnual = interval === "year";

  // Precos BRL vem de lib/pricing.ts. Creator R$ 49,90, Pro R$ 97,90 (lançamento).
  // Anchor (riscado): R$ 99,90 Creator, R$ 199,90 Pro.
  // Anual 20% off → Creator R$ 39,92/mes (total R$ 479,04); Pro R$ 78,32/mes (total R$ 939,84).
  const creatorMonth = "R$ 49,90";
  const creatorAnnualMonthlyEq = "R$ 39,92";
  const creatorYearTotal = "R$ 479,04/ano";
  const creatorAnchor = "R$ 99,90";

  const proMonth = "R$ 97,90";
  const proAnnualMonthlyEq = "R$ 78,32";
  const proYearTotal = "R$ 939,84/ano";
  const proAnchor = "R$ 199,90";

  return (
    <section id="pricing" style={{ padding: "0 0 clamp(56px, 9vw, 96px)" }}>
      <style>{`
        @media (max-width: 768px) {
          #pricing .sv-plan-featured { transform: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <SectionHead num="05" sub="Pricing" tag="Preço de lançamento">
          Preço <em>honesto</em>.{" "}
          <span style={{ color: "var(--sv-muted)" }}>Em real, sem pegadinha.</span>
        </SectionHead>

        <IntervalToggle interval={interval} onChange={setInterval} />

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          <PlanCard
            ribbon="Pra experimentar"
            ribbonVariant="free"
            title="Grátis"
            price="R$ 0"
            unit=""
            features={[
              "5 carrosséis grátis pra testar",
              "Até 12 slides por carrossel",
              "Export PNG em alta",
              "Modo rápido + avançado",
              "Templates Futurista + Twitter",
            ]}
            cta="Começar agora"
            ctaHref="/app/login"
            ctaVariant="outline"
          />
          <PlanCard
            featured
            ribbon="Mais popular"
            ribbonVariant="pro"
            tag="Pra criador solo"
            title="Creator"
            price={isAnnual ? creatorAnnualMonthlyEq : creatorMonth}
            unit="/mês"
            anchor={isAnnual ? `${creatorMonth}/mês no mensal` : creatorAnchor}
            annualSaving={isAnnual ? `Cobrado ${creatorYearTotal}` : undefined}
            features={[
              "10 carrosséis/mês",
              "Até 12 slides por carrossel",
              "Voz da IA configurável",
              "Export PNG pronto pra postar",
              "Templates Futurista + Twitter",
              "1 perfil de marca",
              "Transcrição de vídeos",
            ]}
            cta={isAnnual ? "Assinar Creator anual →" : "Assinar Creator →"}
            ctaHref={`/app/checkout?plan=pro${isAnnual ? "&interval=year" : ""}`}
            ctaVariant="primary"
          />
          <PlanCard
            ribbon="Pra criador avançado"
            ribbonVariant="biz"
            title="Pro"
            price={isAnnual ? proAnnualMonthlyEq : proMonth}
            unit="/mês"
            anchor={isAnnual ? `${proMonth}/mês no mensal` : proAnchor}
            annualSaving={isAnnual ? `Cobrado ${proYearTotal}` : undefined}
            features={[
              "100 carrosséis/mês",
              "Tudo que o Creator tem",
              "Acesso antecipado a novos templates",
              "Agendamento + publicação (em breve)",
              "Export PNG + PDF",
              "Suporte prioritário",
            ]}
            cta={isAnnual ? "Assinar Pro anual" : "Assinar Pro"}
            ctaHref={`/app/checkout?plan=business${isAnnual ? "&interval=year" : ""}`}
            ctaVariant="outline"
          />
        </div>
      </div>
    </section>
  );
}
