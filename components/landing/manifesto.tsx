"use client";

import { motion } from "framer-motion";

/**
 * Banner minimalista de marca. Antes era uma dobra cheia com imagem + texto
 * gigante + gradient animado. Agora é uma faixa fina, uma linha, cores
 * equilibradas. Assinatura discreta da Kaleidos.
 */
export function Manifesto() {
  return (
    <section
      id="manifesto"
      style={{
        background: "var(--sv-paper)",
        borderTop: "1.5px solid var(--sv-ink)",
        borderBottom: "1.5px solid var(--sv-ink)",
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-6 py-5"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--sv-green)",
              border: "1px solid var(--sv-ink)",
            }}
          />
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--sv-muted)",
              fontWeight: 700,
            }}
          >
            Um braço da Kaleidos Digital
          </span>
        </div>
        <a
          href="https://kaleidos.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="uppercase inline-flex items-center gap-1.5"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--sv-ink)",
            fontWeight: 700,
            textDecoration: "none",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--sv-green)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--sv-ink)")
          }
        >
          kaleidos.com.br ↗
        </a>
      </motion.div>
    </section>
  );
}
