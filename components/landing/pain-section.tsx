"use client";

import { motion } from "framer-motion";
import { REVEAL, SectionHead } from "./shared";

export interface PainCard {
  tag: string;
  title: React.ReactNode;
  body: React.ReactNode;
  cross: string;
}

const DEFAULT_PAINS: PainCard[] = [
  {
    tag: "Sintoma 01",
    title: (
      <>
        Escrever um carrossel <em>bom</em> leva 3h.
      </>
    ),
    body: "Você grava o vídeo, escreve o artigo, tem a ideia. Aí passa a tarde inteira brigando com Canva pra transformar aquilo em 6 slides. O conteúdo nasce cansado.",
    cross: "Produtividade zerada",
  },
  {
    tag: "Sintoma 02",
    title: (
      <>
        O ChatGPT devolve texto <em>sem cara.</em>
      </>
    ),
    body: "Você pede um carrossel e vem aquele copy genérico que qualquer creator do nicho poderia postar. Emoji demais, bullet demais, adjetivo demais. Parece IA.",
    cross: "Identidade diluída",
  },
  {
    tag: "Sintoma 03",
    title: (
      <>
        Arrastar texto no Canva é <em>produção</em>, não criação.
      </>
    ),
    body: "Cada slide vira 20 minutos de alinhar caixa, escolher cor, revisar fonte. Você achou que ia ter ideia — só tá operando ferramenta. A energia some antes do 3º slide.",
    cross: "Execução cansa criação",
  },
  {
    tag: "Sintoma 04",
    title: (
      <>
        Consistência vira <em>pressão</em> em vez de hábito.
      </>
    ),
    body: "Começa a semana prometendo 5 posts. Posta 2 na segunda e some até sexta. O algoritmo pune a pausa, você pune o ego. O ciclo se repete.",
    cross: "Reach despencando",
  },
];

export interface PainSectionProps {
  /** Sub do SectionHead. Default: "A dor antes da cura". */
  sub?: string;
  /** Tag do SectionHead. Default: "Familiar?". */
  tag?: string;
  /** Título principal. Aceita ReactNode. */
  heading?: React.ReactNode;
  /** 4 cards de dor. Default: dores genéricas de produção. */
  pains?: PainCard[];
  /** Conteúdo do banner plot-twist (verde). Eyebrow + título. */
  plotTwist?: {
    eyebrow?: string;
    title?: React.ReactNode;
    caption?: React.ReactNode;
  };
}

export function PainSection(props: PainSectionProps = {}) {
  const {
    sub = "A dor antes da cura",
    tag = "Familiar?",
    heading,
    pains = DEFAULT_PAINS,
    plotTwist,
  } = props;
  return (
    <section
      id="dor"
      style={{
        padding: "96px 0",
        background: "var(--sv-soft)",
        borderTop: "1px solid var(--sv-ink)",
        borderBottom: "1px solid var(--sv-ink)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="00" sub={sub} tag={tag}>
          {heading ?? (
            <>
              Você tem <em>ideia</em>.{" "}
              <span style={{ color: "var(--sv-muted)" }}>
                O que falta é tempo pra virar post.
              </span>
            </>
          )}
        </SectionHead>

        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {pains.map((p, i) => (
            <motion.article
              key={p.tag}
              {...REVEAL}
              transition={{ ...REVEAL.transition, delay: i * 0.05 }}
              className="relative flex flex-col justify-between"
              style={{
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: "4px 4px 0 0 var(--sv-ink)",
                padding: "26px 24px 22px",
                minHeight: 240,
              }}
            >
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <span
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "var(--sv-muted)",
                    }}
                  >
                    {p.tag}
                  </span>
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 24,
                      height: 24,
                      border: "1.5px solid var(--sv-ink)",
                      background: "var(--sv-pink)",
                      fontFamily: "var(--sv-mono)",
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </span>
                </div>
                <h3
                  className="sv-display"
                  style={{
                    fontSize: 22,
                    fontWeight: 400,
                    letterSpacing: "-0.015em",
                    lineHeight: 1.08,
                    marginBottom: 10,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    color: "var(--sv-muted)",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                  }}
                >
                  {p.body}
                </p>
              </div>
              <div
                className="mt-5 inline-flex w-fit items-center gap-2 pt-4"
                style={{
                  borderTop: "1px dashed var(--sv-ink)",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--sv-pink)",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    background: "var(--sv-pink)",
                    borderRadius: "50%",
                  }}
                />
                {p.cross}
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div
          {...REVEAL}
          className="mt-10 flex flex-wrap items-center justify-between gap-6"
          style={{
            padding: "28px 28px",
            background: "var(--sv-green)",
            color: "var(--sv-ink)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "4px 4px 0 0 var(--sv-ink)",
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--sv-ink)",
                fontWeight: 700,
                opacity: 0.6,
              }}
            >
              {plotTwist?.eyebrow ?? "O plot twist"}
            </span>
            <p
              className="sv-display mt-2"
              style={{
                fontSize: 26,
                lineHeight: 1.15,
                letterSpacing: "-0.015em",
                maxWidth: 720,
                color: "var(--sv-ink)",
                fontWeight: 400,
              }}
            >
              {plotTwist?.title ?? (
                <>
                  O conteúdo <em>já existe</em> na sua cabeça, no seu YouTube, no seu
                  blog. O que falta é uma ferramenta que{" "}
                  <span
                    style={{
                      background: "var(--sv-ink)",
                      color: "var(--sv-green)",
                      padding: "0 5px",
                      fontStyle: "italic",
                    }}
                  >
                    termine o trabalho.
                  </span>
                </>
              )}
            </p>
          </div>
          <div
            className="flex flex-col text-right"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-ink)",
              fontWeight: 700,
              opacity: 0.55,
            }}
          >
            {plotTwist?.caption ?? (
              <>
                <span>Desliza pra baixo</span>
                <span style={{ opacity: 1 }}>— é a cura ↓</span>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
