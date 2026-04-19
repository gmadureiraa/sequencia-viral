"use client";

import { motion } from "framer-motion";

export const BASE_ASSET = "/brand/landing";

export const REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const },
};

export function SectionHead({
  num,
  sub,
  children,
  tag,
}: {
  num: string;
  sub: string;
  children: React.ReactNode;
  tag?: string;
}) {
  return (
    <div
      className="mb-12 grid items-end gap-x-9 gap-y-6"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
    >
      <div
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 64,
          lineHeight: 0.85,
          color: "var(--sv-pink)",
          fontStyle: "italic",
          fontWeight: 400,
        }}
      >
        {num}
        <span
          style={{
            display: "block",
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
            fontStyle: "normal",
            marginTop: 6,
            lineHeight: 1,
          }}
        >
          {sub}
        </span>
      </div>
      <motion.h2
        {...REVEAL}
        className="sv-display"
        style={{
          fontSize: "clamp(28px, 3.8vw, 48px)",
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          fontWeight: 400,
          maxWidth: 820,
        }}
      >
        {children}
      </motion.h2>
      {tag && (
        <span
          className="justify-self-end self-start whitespace-nowrap"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            padding: "4px 10px",
            border: "1px solid var(--sv-ink)",
            background: "var(--sv-white)",
            boxShadow: "2px 2px 0 0 var(--sv-ink)",
          }}
        >
          {tag}
        </span>
      )}
    </div>
  );
}

export function Ticker() {
  const items = [
    { k: "2.143", v: "carrosséis gerados" },
    { k: "~15s", v: "por carrossel" },
    { k: "4 origens", v: "· YouTube · Blog · Reel · Ideia" },
    { k: "30 posts", v: "/mês no Pro" },
  ];
  const doubled = [...items, ...items];
  return (
    <div className="sv-ticker">
      <div className="sv-ticker-track">
        {doubled.map((it, i) => (
          <span key={i} className="flex items-center gap-10">
            <span>
              <span className="sv-hl">{it.k}</span> {it.v}
            </span>
            <span className="sv-star">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
