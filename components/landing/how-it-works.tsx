"use client";

import { motion } from "framer-motion";
import { BASE_ASSET, REVEAL, SectionHead } from "./shared";

export interface HowItWorksStep {
  n: string;
  img: string;
  title: React.ReactNode;
  body: React.ReactNode;
}

export interface HowItWorksProps {
  sub?: string;
  tag?: string;
  heading?: React.ReactNode;
  steps?: HowItWorksStep[];
}

const DEFAULT_STEPS: HowItWorksStep[] = [
  {
    n: "01",
    img: "hero-ear.png",
    title: (
      <>
        <em>Cole</em> a fonte.
      </>
    ),
    body: "Link de YouTube, artigo de blog, post do Instagram, PDF ou só uma ideia em uma frase. A IA escuta e entende.",
  },
  {
    n: "02",
    img: "step-typewriter.png",
    title: (
      <>
        A IA <em>pensa</em>.
      </>
    ),
    body: "A IA lê sua fonte, aprende seu tom pelo DNA das suas redes e monta um carrossel completo com imagens próprias em ~60 segundos.",
  },
  {
    n: "03",
    img: "hero-megaphone.png",
    title: (
      <>
        Edite. Exporte. <em>Poste</em>.
      </>
    ),
    body: "Ajuste texto e imagem inline. Exporta PNG 1080×1350 pixel-perfect. Abre no celular, posta. Acabou.",
  },
];

export function HowItWorks(props: HowItWorksProps = {}) {
  const {
    sub = "Como funciona",
    tag = "Manual",
    heading,
    steps = DEFAULT_STEPS,
  } = props;

  return (
    <section id="como" style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="02" sub={sub} tag={tag}>
          {heading ?? (
            <>
              Três passos.{" "}
              <span style={{ color: "var(--sv-muted)" }}>Nenhum deles envolve</span>{" "}
              <em>editar no Canva</em>.
            </>
          )}
        </SectionHead>

        <style>{`
          @media (max-width: 760px) {
            #como .sv-how-grid { grid-template-columns: 1fr !important; }
            #como .sv-how-grid > article { border-right: none !important; border-bottom: 1px solid var(--sv-ink); }
            #como .sv-how-grid > article:last-child { border-bottom: none; }
          }
        `}</style>
        <div
          className="sv-how-grid grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            borderTop: "1.5px solid var(--sv-ink)",
            borderBottom: "1.5px solid var(--sv-ink)",
          }}
        >
          {steps.map((s, i) => (
            <motion.article
              key={s.n}
              {...REVEAL}
              className="group relative overflow-hidden transition-colors hover:bg-[var(--sv-green)]"
              style={{
                padding: "32px 28px 28px",
                borderRight:
                  i < steps.length - 1 ? "1px solid var(--sv-ink)" : "none",
              }}
            >
              <div className="mb-14 flex items-start justify-between gap-4">
                <div
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 64,
                    lineHeight: 0.82,
                    fontStyle: "italic",
                    color: "var(--sv-ink)",
                  }}
                >
                  {s.n}
                </div>
                <div
                  className="relative flex-shrink-0 transition-transform duration-300 group-hover:rotate-[4deg] group-hover:scale-105"
                  style={{
                    width: 78,
                    height: 78,
                    transform: "rotate(-6deg)",
                  }}
                >
                  <img
                    src={`${BASE_ASSET}/${s.img}`}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                    style={{
                      filter: "drop-shadow(3px 3px 0 rgba(0,0,0,.15))",
                    }}
                  />
                </div>
              </div>
              <h3
                className="sv-display"
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.05,
                  marginBottom: 8,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  color: "var(--sv-muted)",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  maxWidth: 280,
                }}
              >
                {s.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          #como .grid { grid-template-columns: 1fr !important; }
          #como .grid > article { border-right: none !important; border-bottom: 1px solid var(--sv-ink); }
          #como .grid > article:last-child { border-bottom: none; }
        }
      `}</style>
    </section>
  );
}
