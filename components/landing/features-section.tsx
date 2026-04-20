"use client";

import { motion } from "framer-motion";
import { REVEAL, SectionHead } from "./shared";

function FeatKicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-[6px]"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9.5,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "var(--sv-muted)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          background: "var(--sv-green)",
          border: "1px solid var(--sv-ink)",
          borderRadius: "50%",
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}
function FeatTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="sv-display"
      style={{
        fontSize: 22,
        fontWeight: 400,
        letterSpacing: "-0.015em",
        lineHeight: 1.05,
        margin: "14px 0 8px",
      }}
    >
      {children}
    </h3>
  );
}
function FeatBody({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "var(--sv-muted)",
        fontSize: 13.5,
        lineHeight: 1.55,
      }}
    >
      {children}
    </p>
  );
}
function VoiceBox({
  title,
  body,
  highlight = false,
}: {
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid var(--sv-ink)",
        background: highlight ? "var(--sv-green)" : "var(--sv-white)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 8.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: highlight ? "var(--sv-ink)" : "var(--sv-muted)",
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: "var(--sv-ink)" }}>
        {body}
      </p>
    </div>
  );
}
function ExportRow({
  fmt,
  title,
  sub,
  ink = false,
}: {
  fmt: string;
  title: string;
  sub: string;
  ink?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-[10px]"
      style={{
        padding: 10,
        border: "1px solid var(--sv-ink)",
        background: "var(--sv-white)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          border: "1px solid var(--sv-ink)",
          background: ink ? "var(--sv-ink)" : "var(--sv-green)",
          color: ink ? "var(--sv-paper)" : "var(--sv-ink)",
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.06em",
        }}
      >
        {fmt}
      </span>
      <div style={{ lineHeight: 1.2 }}>
        <b
          style={{
            display: "block",
            fontSize: 11.5,
            fontFamily: "var(--sv-mono)",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </b>
        <span
          style={{
            fontSize: 9,
            color: "var(--sv-muted)",
            fontFamily: "var(--sv-mono)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {sub}
        </span>
      </div>
    </div>
  );
}

export interface FeaturesSectionProps {
  sub?: string;
  tag?: string;
  heading?: React.ReactNode;
  /** Card grande (c-7) — preview real. */
  bigCard?: {
    kicker?: React.ReactNode;
    title?: React.ReactNode;
    body?: React.ReactNode;
    slideHeadline?: React.ReactNode;
    slideHandle?: string;
    slideMeta?: string;
  };
  /** Card de referências visuais (c-5). */
  aestheticCard?: {
    badge?: string;
    kicker?: React.ReactNode;
    title?: React.ReactNode;
    body?: React.ReactNode;
    footer?: React.ReactNode;
  };
  /** Card de brand voice (c-4). */
  voiceCard?: {
    kicker?: React.ReactNode;
    title?: React.ReactNode;
    body?: React.ReactNode;
    inputTitle?: string;
    inputBody?: string;
    outputTitle?: string;
    outputBody?: string;
  };
  /** Card variantes/editor (c-4). */
  editorCard?: {
    kicker?: React.ReactNode;
    title?: React.ReactNode;
    body?: React.ReactNode;
  };
  /** Card imagem contextual (c-4). */
  imageCard?: {
    kicker?: React.ReactNode;
    title?: React.ReactNode;
    body?: React.ReactNode;
  };
}

export function FeaturesSection(props: FeaturesSectionProps = {}) {
  const {
    sub = "Features",
    tag = "Produto",
    heading,
    aestheticCard,
    voiceCard,
    editorCard,
  } = props;
  return (
    <section id="features" style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="03" sub={sub} tag={tag}>
          {heading ?? (
            <>
              Um editor que <em>pensa</em>,{" "}
              <span style={{ color: "var(--sv-muted)" }}>
                não só um gerador que preenche.
              </span>
            </>
          )}
        </SectionHead>

        <div
          className="sv-bento grid gap-4"
          style={{
            gridTemplateColumns: "repeat(12, 1fr)",
            gridAutoRows: "minmax(140px, auto)",
          }}
        >
          {/* Referências visuais c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat relative"
            style={{ gridColumn: "span 4" }}
          >
            <span
              className="absolute"
              style={{
                top: 16,
                right: 16,
                padding: "3px 8px",
                background: "var(--sv-pink)",
                border: "1px solid var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 8.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
              }}
            >
              {aestheticCard?.badge ?? "Novo"}
            </span>
            <FeatKicker>{aestheticCard?.kicker ?? "DNA visual da sua marca"}</FeatKicker>
            <FeatTitle>
              {aestheticCard?.title ?? (
                <>
                  Sua <em>estética</em> virou prompt.
                </>
              )}
            </FeatTitle>
            <FeatBody>
              {aestheticCard?.body ?? (
                <>
                  Cola 3 imagens de referência. A IA destila paleta, iluminação, textura e mood — e replica em TODA imagem gerada. Seu feed para de parecer genérico.
                </>
              )}
            </FeatBody>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { bg: "var(--sv-green)" },
                { bg: "var(--sv-ink)" },
                { bg: "var(--sv-pink)" },
              ].map((r, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1/1",
                    border: "1.5px solid var(--sv-ink)",
                    background: r.bg,
                    boxShadow: "2px 2px 0 0 var(--sv-ink)",
                    backgroundImage:
                      i === 1
                        ? "radial-gradient(circle at 2px 2px, rgba(255,255,255,.15) 1px, transparent 1.5px)"
                        : undefined,
                    backgroundSize: i === 1 ? "8px 8px" : undefined,
                  }}
                />
              ))}
            </div>
            <div
              className="mt-3 text-center"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-pink)",
              }}
            >
              {aestheticCard?.footer ?? "↓ Aplicado em todo slide"}
            </div>
          </motion.div>

          {/* Brand voice c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>{voiceCard?.kicker ?? "Voz da IA"}</FeatKicker>
            <FeatTitle>
              {voiceCard?.title ?? (
                <>
                  O tom é <em>seu</em>,<br />
                  não do ChatGPT.
                </>
              )}
            </FeatTitle>
            <FeatBody>
              {voiceCard?.body ?? (
                <>
                  Configure pilares, audiência, tabus, exemplos de posts. A IA escreve dentro dessas regras.
                </>
              )}
            </FeatBody>
            <div className="mt-4 flex flex-col gap-2">
              <VoiceBox
                title={voiceCard?.inputTitle ?? "Entrada"}
                body={voiceCard?.inputBody ?? "@meuperfil · 30 posts + regras"}
              />
              <div
                style={{
                  textAlign: "center",
                  fontFamily: "var(--sv-mono)",
                  color: "var(--sv-pink)",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                ↓
              </div>
              <VoiceBox
                title={voiceCard?.outputTitle ?? "Saída"}
                body={voiceCard?.outputBody ?? "Carrossel com o seu tom"}
                highlight
              />
            </div>
          </motion.div>

          {/* Editor variantes c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>{editorCard?.kicker ?? "Editor"}</FeatKicker>
            <FeatTitle>
              {editorCard?.title ?? (
                <>
                  <em>Variantes</em> por slide.
                </>
              )}
            </FeatTitle>
            <FeatBody>
              {editorCard?.body ?? (
                <>
                  Cada slide vira 6 layouts: capa, headline, foto, quote, split, CTA. Troca em um clique.
                </>
              )}
            </FeatBody>
            <div className="mt-3 grid grid-cols-3 gap-[6px]">
              {["Capa", "Headline", "Foto", "Quote", "Split", "CTA"].map((v, i) => (
                <div
                  key={v}
                  style={{
                    padding: "8px 6px",
                    border: "1px solid var(--sv-ink)",
                    background: i === 1 ? "var(--sv-green)" : "var(--sv-white)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 8.5,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    textAlign: "center",
                    boxShadow:
                      i === 1 ? "2px 2px 0 0 var(--sv-ink)" : "1px 1px 0 0 var(--sv-ink)",
                  }}
                >
                  {v}
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          #features .sv-bento { grid-template-columns: 1fr !important; }
          #features .sv-feat { grid-column: auto !important; }
          #features .sv-feat[style*="1fr 1.6fr"] { grid-template-columns: 1fr !important; }
          #features .sv-feat[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
