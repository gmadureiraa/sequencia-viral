"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  ROADMAP_ITEMS,
  ROADMAP_STATUS_LABEL,
  type RoadmapItem,
  type RoadmapStatus,
} from "@/lib/roadmap-data";

/**
 * Roadmap interno do app — usa os design tokens sv-* (brutalist editorial
 * Kaleidos). Estrutura: header com legend → grid de cards brutalist (cada
 * item vira um card bordered 1.5px ink com shadow 3-4px) → CTA final.
 */

const STATUS_STYLE: Record<
  RoadmapStatus,
  { bg: string; text: string; dot: string }
> = {
  now: {
    bg: "var(--sv-green)",
    text: "var(--sv-ink)",
    dot: "var(--sv-ink)",
  },
  next: {
    bg: "var(--sv-pink)",
    text: "var(--sv-ink)",
    dot: "var(--sv-ink)",
  },
  later: {
    bg: "var(--sv-paper)",
    text: "var(--sv-ink)",
    dot: "var(--sv-muted)",
  },
};

export default function AppRoadmapPage() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="sv-eyebrow">
          <span className="sv-dot" /> Nº 06 · Roadmap público
        </span>
        <h1
          className="sv-display mt-4"
          style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
            maxWidth: 960,
          }}
        >
          O <em>caminho</em> do Sequência Viral.
        </h1>
        <p
          className="mt-5"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 17,
            color: "var(--sv-muted)",
            maxWidth: 680,
            lineHeight: 1.5,
          }}
        >
          Hoje: gerador manual que já resolve o dia a dia. Em alguns meses, motor
          autônomo que lê o mundo, entende sua marca e publica por você.
        </p>

        {/* Legenda */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["now", "next", "later"] as const).map((s) => {
            const st = STATUS_STYLE[s];
            return (
              <span
                key={s}
                className="uppercase"
                style={{
                  padding: "6px 12px",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  background: st.bg,
                  color: st.text,
                  border: "1.5px solid var(--sv-ink)",
                  boxShadow: "2px 2px 0 0 var(--sv-ink)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: st.dot,
                    border: "1px solid var(--sv-ink)",
                  }}
                />
                {ROADMAP_STATUS_LABEL[s]}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Grid de items */}
      <div
        className="mt-12 grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}
      >
        {ROADMAP_ITEMS.map((item, i) => (
          <RoadmapCard key={item.n} item={item} index={i} />
        ))}
      </div>

      {/* CTA final */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mt-16 mb-10"
        style={{
          padding: "40px 32px",
          background: "var(--sv-ink)",
          color: "var(--sv-paper)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "5px 5px 0 0 var(--sv-green)",
          textAlign: "center",
        }}
      >
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--sv-green)",
            fontWeight: 700,
          }}
        >
          ✦ Quer pedir algo?
        </span>
        <h2
          className="sv-display mt-3"
          style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: "var(--sv-paper)",
          }}
        >
          O roadmap muda com <em>quem usa</em>.
        </h2>
        <p
          className="mt-3 mx-auto"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 15,
            color: "rgba(247,245,239,0.7)",
            maxWidth: 480,
            lineHeight: 1.5,
          }}
        >
          Manda o que você precisa e eu priorizo. Resposta direta, sem
          formulário corporativo.
        </p>
        <a
          href="mailto:madureira@kaleidosdigital.com?subject=Roadmap%20feedback"
          className="mt-6 inline-flex items-center gap-2"
          style={{
            padding: "13px 22px",
            background: "var(--sv-green)",
            border: "1.5px solid var(--sv-paper)",
            boxShadow: "4px 4px 0 0 var(--sv-paper)",
            fontFamily: "var(--sv-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "var(--sv-ink)",
            textDecoration: "none",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translate(-1.5px, -1.5px)";
            e.currentTarget.style.boxShadow =
              "6px 6px 0 0 var(--sv-paper)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translate(0, 0)";
            e.currentTarget.style.boxShadow =
              "4px 4px 0 0 var(--sv-paper)";
          }}
        >
          Mandar sugestão →
        </a>
      </motion.section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card individual
// ─────────────────────────────────────────────────────────────

function RoadmapCard({ item, index }: { item: RoadmapItem; index: number }) {
  const st = STATUS_STYLE[item.status];
  const isNow = item.status === "now";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      style={{
        position: "relative",
        padding: 22,
        background: isNow ? "var(--sv-green)" : "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: isNow
          ? "4px 4px 0 0 var(--sv-ink)"
          : "3px 3px 0 0 var(--sv-ink)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 360,
        transition: "box-shadow 0.2s ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = isNow
          ? "6px 6px 0 0 var(--sv-ink)"
          : "5px 5px 0 0 var(--sv-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = isNow
          ? "4px 4px 0 0 var(--sv-ink)"
          : "3px 3px 0 0 var(--sv-ink)";
      }}
    >
      {/* Header: número + status badge */}
      <div className="flex items-start justify-between gap-3">
        <span
          className="italic"
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: 44,
            lineHeight: 0.9,
            letterSpacing: "-0.02em",
            color: "var(--sv-ink)",
            fontWeight: 400,
          }}
        >
          {item.n}
        </span>
        <span
          className="uppercase shrink-0"
          style={{
            padding: "4px 9px",
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.16em",
            fontWeight: 700,
            background: isNow ? "var(--sv-ink)" : st.bg,
            color: isNow ? "var(--sv-paper)" : st.text,
            border: "1px solid var(--sv-ink)",
          }}
        >
          {ROADMAP_STATUS_LABEL[item.status]}
        </span>
      </div>

      {/* Title */}
      <h3
        className="sv-display"
        style={{
          fontSize: 22,
          lineHeight: 1.1,
          letterSpacing: "-0.015em",
          color: "var(--sv-ink)",
          fontWeight: 400,
        }}
      >
        {item.title}
      </h3>

      {/* Body */}
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: isNow ? "var(--sv-ink)" : "var(--sv-muted)",
        }}
      >
        {item.body}
      </p>

      {/* Bullets */}
      <ul className="flex flex-col gap-1.5">
        {item.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2"
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: "var(--sv-ink)",
            }}
          >
            <ArrowRight
              size={11}
              strokeWidth={2}
              className="shrink-0 mt-[3px]"
              style={{ color: isNow ? "var(--sv-ink)" : "var(--sv-green)" }}
            />
            {b}
          </li>
        ))}
      </ul>

      {/* Tag */}
      <div
        className="mt-auto pt-3 uppercase"
        style={{
          borderTop: "1px dashed var(--sv-ink)",
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--sv-muted)",
          fontWeight: 700,
        }}
      >
        {item.tag}
      </div>
    </motion.article>
  );
}
