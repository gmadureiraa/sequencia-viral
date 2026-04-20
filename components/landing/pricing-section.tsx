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
      className={`relative flex flex-col gap-[14px] ${featured ? "sv-plan-featured" : ""}`}
      style={{
        background: featured ? "var(--sv-ink)" : "var(--sv-white)",
        color: featured ? "var(--sv-paper)" : "var(--sv-ink)",
        border: "1.5px solid var(--sv-ink)",
        padding: 28,
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
              color: "var(--sv-muted)",
            }}
          >
            {anchor}
          </span>
        )}
        <div className="flex items-baseline gap-[6px]">
          <span
            className="sv-display"
            style={{ fontSize: 44, letterSpacing: "-0.025em", lineHeight: 1 }}
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
        className={`sv-btn sv-btn-${ctaVariant === "primary" ? "primary" : "outline"} mt-auto`}
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

  // Preços de LANÇAMENTO em USD — Pro $9.90, Agência $29.90.
  // Anual −20%: $7.92/mês e $23.92/mês (equivalente mensal).
  const proMonth = "$9.90";
  const proAnnualMonthlyEq = "$7.92";
  const proYearTotal = "$95.04/ano";

  const agencyMonth = "$29.90";
  const agencyAnnualMonthlyEq = "$23.92";
  const agencyYearTotal = "$287.04/ano";

  return (
    <section id="pricing" style={{ padding: "0 0 96px" }}>
      <style>{`
        @media (max-width: 768px) {
          #pricing .sv-plan-featured { transform: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="08" sub="Pricing" tag="Preço de lançamento">
          Preço <em>honesto</em>.{" "}
          <span style={{ color: "var(--sv-muted)" }}>Cancele quando quiser.</span>
        </SectionHead>

        <IntervalToggle interval={interval} onChange={setInterval} />

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          <PlanCard
            ribbon="Pra experimentar"
            ribbonVariant="free"
            title="Grátis"
            price="$0"
            unit=""
            features={[
              "5 carrosséis/mês",
              "Export PNG em alta",
              "Modo rápido + avançado",
              "4 templates editoriais",
              "1 perfil de marca",
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
            title="Pro"
            price={isAnnual ? proAnnualMonthlyEq : proMonth}
            unit="/mês"
            anchor={isAnnual ? "$9.90/mês no mensal" : "$19.90"}
            annualSaving={isAnnual ? `Cobrado ${proYearTotal}` : undefined}
            features={[
              "30 carrosséis/mês",
              "Voz da IA configurável",
              "3 referências visuais por marca",
              "Export PNG pronto pra postar",
              "1 perfil de marca",
              "Transcrição de vídeos",
              "Histórico completo",
            ]}
            cta={isAnnual ? "Assinar Pro anual →" : "Assinar Pro →"}
            ctaHref={`/app/checkout?plan=pro${isAnnual ? "&interval=year" : ""}`}
            ctaVariant="primary"
          />
          <PlanCard
            ribbon="Pra criador avançado"
            ribbonVariant="biz"
            title="Agência"
            price={isAnnual ? agencyAnnualMonthlyEq : agencyMonth}
            unit="/mês"
            anchor={isAnnual ? "$29.90/mês no mensal" : "$39.90"}
            annualSaving={isAnnual ? `Cobrado ${agencyYearTotal}` : undefined}
            features={[
              "Carrosséis ilimitados",
              "Voz da IA configurável",
              "3 referências visuais por marca",
              "Export PNG pronto pra postar",
              "1 perfil de marca",
              "Transcrição de vídeos",
              "Suporte prioritário (WhatsApp)",
            ]}
            cta={isAnnual ? "Assinar Agência anual" : "Assinar Agência"}
            ctaHref={`/app/checkout?plan=agency${isAnnual ? "&interval=year" : ""}`}
            ctaVariant="outline"
          />
        </div>
      </div>
    </section>
  );
}
