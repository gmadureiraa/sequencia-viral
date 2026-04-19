"use client";

import { motion } from "framer-motion";
import { BASE_ASSET, REVEAL } from "./shared";

export function Manifesto() {
  return (
    <section
      id="manifesto"
      className="relative overflow-hidden"
      style={{
        background: "var(--sv-ink)",
        color: "var(--sv-paper)",
        padding: "96px 0",
        borderTop: "1px solid var(--sv-ink)",
        borderBottom: "1px solid var(--sv-ink)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          inset: "-50%",
          background:
            "repeating-conic-gradient(from 0deg at 50% 50%, transparent 0 8deg, rgba(124,240,103,.07) 8deg 9deg)",
          animation: "sv-spin-slow 120s linear infinite",
        }}
      />
      <div className="relative mx-auto max-w-[1240px] px-6">
        <div
          className="grid items-end gap-14"
          style={{ gridTemplateColumns: "1fr auto" }}
        >
          <div>
            <div
              className="mb-7 inline-flex items-center gap-2"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--sv-green)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 34,
                  height: 1,
                  background: "var(--sv-green)",
                }}
              />
              Manifesto · um braço da Kaleidos Digital
            </div>
            <motion.h2
              {...REVEAL}
              className="sv-display"
              style={{
                fontSize: "clamp(32px, 4.3vw, 56px)",
                lineHeight: 1.08,
                letterSpacing: "-0.018em",
                maxWidth: 900,
                fontWeight: 400,
              }}
            >
              Toda semana você grava, escreve, pensa. E toda semana{" "}
              <span className="sv-st">perde horas no Canva</span> tentando virar
              aquilo em post. A Sequência Viral resolve a parte chata:{" "}
              <em style={{ color: "var(--sv-green)" }}>
                transforma o que você já produziu
              </em>{" "}
              em carrossel editorial, com a sua voz{" "}
              <em style={{ color: "var(--sv-green)" }}>e pronto pra postar</em>.
            </motion.h2>
          </div>
          <motion.div
            {...REVEAL}
            className="sv-anim-float-slow"
            style={{
              width: 140,
              aspectRatio: "1/1",
              position: "relative",
              ["--sv-r" as string]: "-4deg",
            } as React.CSSProperties}
          >
            <img
              src={`${BASE_ASSET}/manifest-cutout.png`}
              alt=""
              aria-hidden
              className="h-full w-full object-contain"
              style={{ filter: "invert(1) brightness(1.1) contrast(1.1)" }}
            />
          </motion.div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          #manifesto > div > div { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </section>
  );
}
