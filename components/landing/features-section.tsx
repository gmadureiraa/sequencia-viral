"use client";

import { motion } from "framer-motion";
import { BASE_ASSET, REVEAL, SectionHead } from "./shared";

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
function FeatMeta({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 8.5,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,.4)",
      }}
    >
      {children}
    </span>
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

export function FeaturesSection() {
  return (
    <section id="features" style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="03" sub="Features" tag="Produto">
          Tudo que você precisa.{" "}
          <span style={{ color: "var(--sv-muted)" }}>Nada que não precisa.</span>
        </SectionHead>

        <div
          className="sv-bento grid gap-4"
          style={{
            gridTemplateColumns: "repeat(12, 1fr)",
            gridAutoRows: "minmax(140px, auto)",
          }}
        >
          {/* Big preview card c-7 */}
          <motion.div
            {...REVEAL}
            className="sv-feat sv-card"
            style={{
              gridColumn: "span 7",
              padding: 0,
              background: "var(--sv-green)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <div
              className="relative flex flex-col justify-between"
              style={{ padding: 28 }}
            >
              <div>
                <FeatKicker>Preview real</FeatKicker>
                <FeatTitle>
                  O slide que você vê
                  <br />é o slide que <em>sai</em>.
                </FeatTitle>
                <p style={{ color: "var(--sv-ink)", opacity: 0.75, fontSize: 13.5, lineHeight: 1.55 }}>
                  Tipografia, cores e formato exatos. Sem surpresa no export. Sem
                  &quot;quase igual&quot;.
                </p>
              </div>
              <div className="mt-5 flex gap-1">
                {[1, 0.3, 0.3, 0.3].map((o, i) => (
                  <span
                    key={i}
                    style={{
                      width: 14,
                      height: 3,
                      background: "var(--sv-ink)",
                      opacity: o,
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>
              <img
                src={`${BASE_ASSET}/hero-megaphone.png`}
                alt=""
                aria-hidden
                className="sv-anim-float-slow absolute"
                style={
                  {
                    right: -10,
                    bottom: -10,
                    width: 80,
                    opacity: 0.8,
                    ["--sv-r" as string]: "8deg",
                  } as React.CSSProperties
                }
              />
            </div>
            <div
              className="flex flex-col justify-between"
              style={{
                background: "var(--sv-ink)",
                color: "var(--sv-paper)",
                padding: 28,
                borderLeft: "1.5px solid var(--sv-ink)",
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent 0 20px, rgba(124,240,103,.06) 20px 22px)",
              }}
            >
              <FeatMeta>Slide 01 / 04</FeatMeta>
              <h4
                className="sv-display"
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.05,
                }}
              >
                O algoritmo premia consistência,{" "}
                <em style={{ color: "var(--sv-green)" }}>não genialidade.</em>
              </h4>
              <FeatMeta>@sequencia-viral</FeatMeta>
            </div>
          </motion.div>

          {/* Referências visuais c-5 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat relative"
            style={{ gridColumn: "span 5" }}
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
              Novo
            </span>
            <FeatKicker>Referências visuais</FeatKicker>
            <FeatTitle>
              Cole <em>3 imagens</em> da sua marca.
            </FeatTitle>
            <FeatBody>
              A IA extrai paleta, textura e linguagem visual. Toda imagem gerada vira uma extensão coerente da sua estética.
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
              ↓ Aplicado em todo slide
            </div>
          </motion.div>

          {/* Templates c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Multi-template</FeatKicker>
            <FeatTitle>
              4 templates <em>editoriais</em>.
            </FeatTitle>
            <FeatBody>
              Twitter, Principal, Futurista, Autoral. Cada um com pegada própria.
            </FeatBody>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { name: "Twitter", bg: "var(--sv-ink)" },
                { name: "Principal", bg: "var(--sv-green)" },
                { name: "Futurista", bg: "var(--sv-pink)" },
                {
                  name: "Autoral",
                  bg: "var(--sv-white)",
                  image:
                    "radial-gradient(circle at 2px 2px, var(--sv-ink) 1px, transparent 1.5px)",
                  size: "8px 8px",
                },
              ].map((tpl) => (
                <div
                  key={tpl.name}
                  style={{
                    border: "1px solid var(--sv-ink)",
                    padding: 8,
                    background: "var(--sv-white)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 8.5,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    boxShadow: "2px 2px 0 0 var(--sv-ink)",
                    transition: "transform 0.2s",
                  }}
                >
                  <div
                    style={{
                      height: 44,
                      border: "1px solid var(--sv-ink)",
                      marginBottom: 6,
                      background: tpl.bg,
                      backgroundImage: tpl.image,
                      backgroundSize: tpl.size,
                    }}
                  />
                  {tpl.name}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Brand voice c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Voz da IA</FeatKicker>
            <FeatTitle>
              O tom é <em>seu</em>,<br />
              não do ChatGPT.
            </FeatTitle>
            <FeatBody>
              Configure pilares, audiência, tabus, exemplos de posts. A IA escreve dentro dessas regras.
            </FeatBody>
            <div className="mt-4 flex flex-col gap-2">
              <VoiceBox title="Entrada" body="@meuperfil · 30 posts + regras" />
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
              <VoiceBox title="Saída" body="Carrossel com o seu tom" highlight />
            </div>
          </motion.div>

          {/* Editor variantes c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Editor</FeatKicker>
            <FeatTitle>
              <em>Variantes</em> por slide.
            </FeatTitle>
            <FeatBody>
              Cada slide vira 6 layouts: capa, headline, foto, quote, split, CTA. Troca em um clique.
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

          {/* Imagem contextual c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Imagem contextual</FeatKicker>
            <FeatTitle>
              Cada slide com <em>sua</em> imagem.
            </FeatTitle>
            <FeatBody>
              A IA gera ilustração coerente com o texto do slide. Sem stock photo genérico.
            </FeatBody>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["01", "02", "03"].map((n, i) => (
                <div
                  key={n}
                  style={{
                    aspectRatio: "1/1",
                    border: "1.5px solid var(--sv-ink)",
                    background:
                      i === 0
                        ? "var(--sv-green)"
                        : i === 1
                          ? "var(--sv-ink)"
                          : "var(--sv-pink)",
                    boxShadow: "2px 2px 0 0 var(--sv-ink)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 6,
                      fontFamily: "var(--sv-mono)",
                      fontSize: 7.5,
                      letterSpacing: "0.18em",
                      color: i === 1 ? "var(--sv-green)" : "var(--sv-ink)",
                    }}
                  >
                    {n}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Export c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Exportação</FeatKicker>
            <FeatTitle>
              PNG <em>pixel-perfect</em>
              <br />+ PDF deck.
            </FeatTitle>
            <FeatBody>
              1080×1350 pronto pro Instagram. PDF pra enviar pro cliente.
            </FeatBody>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ExportRow fmt="PNG" title="1080×1350" sub="pixel-perfect" />
              <ExportRow fmt="PDF" title="Deck" sub="p/ enviar" ink />
            </div>
          </motion.div>

          {/* Advanced mode c-12 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{
              gridColumn: "span 12",
              display: "grid",
              gridTemplateColumns: "1fr 1.6fr",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div>
              <FeatKicker>Modo avançado</FeatKicker>
              <FeatTitle>
                Quando você quer <em>controle</em> total.
              </FeatTitle>
              <FeatBody>
                Triagem de fontes → 3 headlines → espinha dorsal → copy final. Cada
                etapa editável. Cada palavra sua.
              </FeatBody>
            </div>
            <div className="grid grid-cols-4 gap-[10px]">
              {[
                { n: "01", t: "Triagem", cls: "a1" },
                { n: "02", t: "Headlines", cls: "a2" },
                { n: "03", t: "Espinha", cls: "a3" },
                { n: "04", t: "Copy", cls: "a4" },
              ].map((a) => {
                const style: React.CSSProperties =
                  a.cls === "a1"
                    ? { background: "var(--sv-soft)" }
                    : a.cls === "a2"
                      ? { background: "var(--sv-green)" }
                      : a.cls === "a3"
                        ? {
                            background: "var(--sv-ink)",
                            color: "var(--sv-paper)",
                            boxShadow: "3px 3px 0 0 var(--sv-green)",
                          }
                        : { background: "var(--sv-pink)" };
                const numColor =
                  a.cls === "a1"
                    ? "var(--sv-pink)"
                    : a.cls === "a3"
                      ? "var(--sv-green)"
                      : undefined;
                return (
                  <div
                    key={a.n}
                    style={{
                      border: "1px solid var(--sv-ink)",
                      padding: 14,
                      boxShadow: "3px 3px 0 0 var(--sv-ink)",
                      ...style,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: numColor,
                      }}
                    >
                      {a.n}
                    </span>
                    <div
                      className="sv-display"
                      style={{
                        fontSize: 18,
                        letterSpacing: "-0.015em",
                        marginTop: 4,
                        fontStyle: "italic",
                      }}
                    >
                      {a.t}
                    </div>
                  </div>
                );
              })}
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
