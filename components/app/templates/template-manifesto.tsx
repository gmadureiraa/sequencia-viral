"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import {
  resolveImgSrc,
  renderRichText,
  CANVAS_W,
  CANVAS_H,
  MONO_STACK,
} from "./utils";

/**
 * Template 01 — Futurista (id interno `manifesto`)
 *
 * Ref visual: @brandsdecoded (Instagram). Padrão de capa cinematográfica
 * com imagem full-bleed + título CAPS no terço inferior sobre shadow
 * localizada + handle pill centralizado. Variantes internas:
 *
 * - cover: full-bleed image + handle pill + title CAPS bottom third
 * - photo (legacy): bg preto, eyebrow + title CAPS + imagem meio + body bottom
 * - headline (legacy): bg preto puro, título huge CAPS + body (sem imagem)
 * - split (legacy): text + imagem meio + text (antes vs depois)
 * - quote (legacy): fallback → headline
 * - cta: último slide, accent button + seguir handle
 *
 * Overhaul 2026-04-22 — 3 novas variantes BrandsDecoded style:
 * - solid-brand: fundo cor da marca + título CAPS topo + imagem quadrada meio
 * - text-only: bg escuro + kicker mono + parágrafos com divisória (sem título huge)
 * - full-photo-bottom: imagem full-bleed + título + body no terço inferior sobre gradient
 */

const ACCENT_DEFAULT = "#FF4500";
const INK = "#0A0A0A";
const PAPER = "#F7F5EF";
const DEFAULT_EDITORIAL_HEADER = "Sequência Viral";
const DEFAULT_DISPLAY_STACK =
  '"Inter", "Archivo Black", system-ui, sans-serif';
const SERIF_STACK = '"Instrument Serif", Georgia, "Times New Roman", serif';
const SANS_STACK = '"Inter", system-ui, sans-serif';

const TemplateManifesto = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateManifesto(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      profile,
      style,
      isLastSlide,
      scale = 0.38,
      exportMode = false,
      accentOverride,
      displayFontOverride,
      textScale = 1,
      variant = "headline",
      bgColor,
      layers,
    },
    ref
  ) {
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const hasImage = Boolean(bodyImgSrc);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const accent = accentOverride || ACCENT_DEFAULT;
    // Editorial header (customizável por user em settings → brand_analysis.__editorial_header)
    const editorialHeader = DEFAULT_EDITORIAL_HEADER;
    const currentYear = new Date().getFullYear();
    const handleLabel = (profile.handle || "").replace(/^@/, "").trim();
    const handleDisplay = handleLabel ? `@${handleLabel}` : "@seuhandle";

    // BUG FIX 2026-04-22: versao anterior fazia headline === cover. Isso
    // causava bug de export onde TODOS slides com variant=headline eram
    // renderizados como capa cheia no preview Instagram/zip. Reverti pra
    // logica original: cover = so slide 1 OU variant explicito 'cover'.
    // Headline eh uma variante INDEPENDENTE, com layout proprio.
    const isCoverLike =
      variant === "cover" || (slideNumber === 1 && !variant);
    const isSplit = variant === "split";
    const isPhoto = variant === "photo" && hasImage;
    const isQuote = variant === "quote";
    const isCta = variant === "cta";
    // Novas variantes BrandsDecoded overhaul
    const isSolidBrand = variant === "solid-brand";
    const isTextOnly = variant === "text-only";
    const isFullPhotoBottom = variant === "full-photo-bottom" && hasImage;

    // Background sempre escuro por padrão (BrandsDecoded style). Light mode
    // disponível via `style: "white"` ou `bgColor` custom.
    const styleIsDark = style !== "white";

    // Para solid-brand: fundo = accent; fg decide por luminância da accent.
    const solidBrandFg = isSolidBrand ? pickFgForBg(accent) : null;

    const resolvedBg = bgColor
      ? bgColor
      : isSolidBrand
        ? accent
        : isCoverLike || isFullPhotoBottom
          ? INK
          : styleIsDark
            ? INK
            : PAPER;
    const resolvedFg = bgColor
      ? pickFgForBg(bgColor)
      : isSolidBrand
        ? (solidBrandFg as string)
        : isCoverLike || isFullPhotoBottom || styleIsDark
          ? PAPER
          : INK;
    // Accent visível contra resolvedBg — se accent = bg (solid-brand), a bolinha
    // vira ink ou paper conforme fg.
    const dotColor = isSolidBrand
      ? resolvedFg
      : accent;

    const displayStack = displayFontOverride || DEFAULT_DISPLAY_STACK;
    const ts = Math.max(0.6, Math.min(1.6, textScale));
    const displayIsItalic = /Instrument Serif/i.test(displayStack);
    const displayTransform: "uppercase" | "none" = displayIsItalic
      ? "none"
      : "uppercase";

    return (
      <div
        className="flex-shrink-0"
        style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          ref={ref}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: resolvedBg,
            color: resolvedFg,
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            fontFamily: SANS_STACK,
          }}
        >
          {/* ═══════ COVER IMAGE FULL-BLEED (cover + full-photo-bottom) ═══════ */}
          {(isCoverLike || isFullPhotoBottom) && showBg && hasImage && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bodyImgSrc}
                crossOrigin="anonymous"
                alt={heading}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 0,
                }}
              />
              {/* Shadow LOCALIZADA no terço inferior — não é gradient linear
                  vertical simples. Zona alta fica clean, zona baixa fica quase
                  preta onde o título mora. Full-photo-bottom usa gradient mais
                  forte e mais alto (40% da altura) pra acomodar título + body. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isFullPhotoBottom
                    ? "linear-gradient(180deg, transparent 0%, transparent 35%, rgba(10,10,10,0.25) 50%, rgba(10,10,10,0.72) 65%, rgba(10,10,10,0.93) 80%, rgba(10,10,10,0.98) 100%)"
                    : "linear-gradient(180deg, transparent 0%, transparent 45%, rgba(10,10,10,0.35) 58%, rgba(10,10,10,0.78) 72%, rgba(10,10,10,0.95) 86%, rgba(10,10,10,0.98) 100%)",
                  zIndex: 1,
                }}
              />
            </>
          )}

          {/* ═══════ HEADER ROW TOPO (oculto em full-photo-bottom) ═══════ */}
          {!isFullPhotoBottom && (
            <div
              style={{
                position: "relative",
                zIndex: 3,
                padding: "40px 60px 0",
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: 16,
                fontFamily: SANS_STACK,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: isSolidBrand
                  ? resolvedFg === INK
                    ? "rgba(10,10,10,0.78)"
                    : "rgba(247,245,239,0.82)"
                  : isCoverLike
                    ? "rgba(247,245,239,0.85)"
                    : "rgba(247,245,239,0.55)",
                textTransform: "none",
                lineHeight: 1,
              }}
            >
              <div>{editorialHeader}</div>
              <div style={{ textAlign: "center", opacity: 0.8 }}>
                {handleDisplay}
              </div>
              <div style={{ textAlign: "right", opacity: 0.7 }}>
                {currentYear} //
              </div>
            </div>
          )}

          {/* ═══════ CONTEÚDO CENTRAL POR VARIANT ═══════ */}

          {isCoverLike ? (
            // ─── COVER: título CAPS bottom third + handle pill ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "0 70px 110px",
                gap: 20,
                minHeight: 0,
              }}
            >
              {/* Handle pill centralizado acima do título */}
              {handleLabel && (
                <div
                  style={{
                    alignSelf: "center",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 22px 10px 18px",
                    background: "rgba(10,10,10,0.55)",
                    border: "1.5px solid rgba(247,245,239,0.22)",
                    borderRadius: 999,
                    fontFamily: SANS_STACK,
                    fontSize: 22,
                    fontWeight: 600,
                    color: PAPER,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={accent}>
                    <path d="M12 2l2.2 6.8H22l-6.4 4.6 2.4 7.4L12 16.4l-6 4.4 2.4-7.4L2 8.8h7.8z" />
                  </svg>
                  @{handleLabel}
                  {/* verified badge */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={accent}
                  >
                    <path d="M12 2l2 2.5 3-.5.5 3 2.5 2-1.5 2.5 1.5 2.5-2.5 2-.5 3-3-.5L12 22l-2-2.5-3 .5-.5-3L4 15l1.5-2.5L4 10l2.5-2 .5-3 3 .5z" />
                    <path
                      d="M9 12l2 2 4-4"
                      stroke="#fff"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}

              {showTitle && (
                <h1
                  style={{
                    fontFamily: displayStack,
                    fontWeight: 900,
                    fontSize: 70 * ts,
                    lineHeight: 0.95,
                    letterSpacing: "-0.035em",
                    margin: 0,
                    color: PAPER,
                    textAlign: "center",
                    textTransform: displayTransform,
                    textShadow:
                      "0 4px 24px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {renderRichText(heading, accent)}
                </h1>
              )}
            </div>
          ) : isSolidBrand ? (
            // ─── SOLID-BRAND: fundo cor da marca + título CAPS topo + imagem quadrada meio + body bottom ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                padding: "50px 70px 80px",
                gap: 36,
                minHeight: 0,
              }}
            >
              {showTitle && (
                <h2
                  style={{
                    fontFamily: displayStack,
                    fontWeight: 900,
                    fontSize: 70 * ts,
                    lineHeight: 0.95,
                    letterSpacing: "-0.035em",
                    margin: 0,
                    color: resolvedFg,
                    textAlign: "center",
                    textTransform: displayTransform,
                    maxWidth: "100%",
                  }}
                >
                  {renderRichText(heading, dotColor)}
                </h2>
              )}
              {showBg && hasImage && (
                <div
                  style={{
                    width: "100%",
                    height: 520,
                    flexShrink: 0,
                    overflow: "hidden",
                    background: `url(${bodyImgSrc}) center/cover`,
                  }}
                />
              )}
              {showBody && body && (
                <p
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 30 * ts,
                    fontWeight: 500,
                    lineHeight: 1.35,
                    margin: 0,
                    color: resolvedFg === INK
                      ? "rgba(10,10,10,0.85)"
                      : "rgba(247,245,239,0.92)",
                    whiteSpace: "pre-line",
                    textAlign: "center",
                  }}
                >
                  {renderRichText(body, dotColor)}
                </p>
              )}
            </div>
          ) : isTextOnly ? (
            // ─── TEXT-ONLY: bg escuro + kicker mono topo + parágrafos sans com divisória ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                padding: "40px 70px 90px",
                gap: 36,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  fontFamily: MONO_STACK,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: accent,
                }}
              >
                {heading && heading.trim().length > 0
                  ? heading.toUpperCase().slice(0, 40)
                  : slideEyebrowFor(slideNumber, totalSlides)}
              </div>
              {showBody && body && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                    fontFamily: SANS_STACK,
                    fontSize: 32 * ts,
                    fontWeight: 400,
                    lineHeight: 1.4,
                    color: resolvedFg,
                  }}
                >
                  {splitParagraphs(body).map((para, i, arr) => (
                    <div key={i}>
                      <p
                        style={{
                          margin: 0,
                          whiteSpace: "pre-line",
                        }}
                      >
                        {renderRichText(para, accent)}
                      </p>
                      {i < arr.length - 1 && (
                        <div
                          style={{
                            marginTop: 28,
                            width: "100%",
                            height: 0,
                            borderTop: "1.5px solid rgba(247,245,239,0.2)",
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isFullPhotoBottom ? (
            // ─── FULL-PHOTO-BOTTOM: imagem full-bleed + título + body no terço inferior ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "0 70px 110px",
                gap: 24,
                minHeight: 0,
              }}
            >
              {showTitle && (
                <h2
                  style={{
                    fontFamily: displayStack,
                    fontWeight: 900,
                    fontSize: 50 * ts,
                    lineHeight: 0.95,
                    letterSpacing: "-0.035em",
                    margin: 0,
                    color: PAPER,
                    textTransform: displayTransform,
                    textShadow:
                      "0 4px 24px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {renderRichText(heading, accent)}
                </h2>
              )}
              {showBody && body && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    fontFamily: SANS_STACK,
                    fontSize: 24 * ts,
                    fontWeight: 400,
                    lineHeight: 1.4,
                    color: "rgba(247,245,239,0.92)",
                  }}
                >
                  {splitParagraphs(body).map((para, i, arr) => (
                    <div key={i}>
                      <p
                        style={{
                          margin: 0,
                          whiteSpace: "pre-line",
                        }}
                      >
                        {renderRichText(para, accent)}
                      </p>
                      {i < arr.length - 1 && (
                        <div
                          style={{
                            marginTop: 16,
                            width: 72,
                            height: 0,
                            borderTop: "1.5px solid rgba(247,245,239,0.3)",
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Bolinha accent (rendering abaixo ainda — ver bloco comum) */}
            </div>
          ) : isSplit ? (
            // ─── SPLIT: text top + image middle + text bottom ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                padding: "40px 60px 60px",
                gap: 28,
                minHeight: 0,
              }}
            >
              {showTitle && (
                <p
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 40 * ts,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    letterSpacing: "-0.025em",
                    margin: 0,
                    color: resolvedFg,
                  }}
                >
                  {renderRichText(heading, accent)}
                </p>
              )}
              {showBg && hasImage && (
                <div
                  style={{
                    flex: "1 1 0",
                    minHeight: 0,
                    width: "100%",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: `url(${bodyImgSrc}) center/cover`,
                  }}
                />
              )}
              {showBody && (
                <p
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 34 * ts,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    margin: 0,
                    color: resolvedFg,
                    whiteSpace: "pre-line",
                  }}
                >
                  {renderRichText(body, accent)}
                </p>
              )}
            </div>
          ) : isPhoto ? (
            // ─── PHOTO: eyebrow + title CAPS top + imagem meio + body bottom ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                padding: "40px 60px 60px",
                gap: 28,
                minHeight: 0,
              }}
            >
              {!isLastSlide && (
                <div
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "rgba(247,245,239,0.55)",
                  }}
                >
                  {slideEyebrowFor(slideNumber, totalSlides)}
                </div>
              )}
              {showTitle && (
                <h2
                  style={{
                    fontFamily: displayStack,
                    fontWeight: 900,
                    fontSize: 80 * ts,
                    lineHeight: 0.95,
                    letterSpacing: "-0.035em",
                    margin: 0,
                    color: resolvedFg,
                    textTransform: displayTransform,
                  }}
                >
                  {renderRichText(heading, accent)}
                </h2>
              )}
              {showBg && hasImage && (
                <div
                  style={{
                    width: "100%",
                    height: 380,
                    flexShrink: 0,
                    borderRadius: 8,
                    overflow: "hidden",
                    background: `url(${bodyImgSrc}) center/cover`,
                  }}
                />
              )}
              {showBody && (
                <p
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 30 * ts,
                    fontWeight: 400,
                    lineHeight: 1.45,
                    margin: 0,
                    color: styleIsDark
                      ? "rgba(247,245,239,0.82)"
                      : "rgba(10,10,10,0.8)",
                    whiteSpace: "pre-line",
                  }}
                >
                  {renderRichText(body, accent)}
                </p>
              )}
            </div>
          ) : isQuote ? (
            // ─── QUOTE: mantido como visualização editorial centered ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "40px 120px",
                textAlign: "center",
                gap: 32,
              }}
            >
              <div
                style={{
                  fontFamily: SERIF_STACK,
                  fontSize: 220,
                  lineHeight: 0.8,
                  color: accent,
                  fontStyle: "italic",
                }}
              >
                &ldquo;
              </div>
              {showTitle && (
                <h1
                  style={{
                    fontFamily: SERIF_STACK,
                    fontSize: 72 * ts,
                    fontStyle: "italic",
                    fontWeight: 400,
                    lineHeight: 1.12,
                    letterSpacing: "-0.01em",
                    margin: 0,
                    color: resolvedFg,
                  }}
                >
                  {renderRichText(heading, accent)}
                </h1>
              )}
              {showBody && (
                <p
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 26 * ts,
                    lineHeight: 1.45,
                    margin: 0,
                    color: resolvedFg,
                    maxWidth: 720,
                  }}
                >
                  {renderRichText(body, accent)}
                </p>
              )}
            </div>
          ) : (
            // ─── HEADLINE: só tipografia, bg sólido ───
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "60px 60px 100px",
                gap: 40,
                minHeight: 0,
              }}
            >
              {!isLastSlide && (
                <div
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "rgba(247,245,239,0.55)",
                  }}
                >
                  {slideEyebrowFor(slideNumber, totalSlides)}
                </div>
              )}

              {/* Numero gigante tenue ao fundo removido — ficava poluindo visual
                  sem agregar hierarquia. Contador pequeno 'n/total' no bottom-right
                  ja indica posicao no carrossel. */}

              {showTitle && (
                <h1
                  style={{
                    fontFamily: displayStack,
                    fontWeight: 900,
                    fontSize: (isLastSlide ? 88 : 104) * ts,
                    lineHeight: 0.95,
                    letterSpacing: "-0.035em",
                    margin: 0,
                    color: resolvedFg,
                    textTransform: displayTransform,
                  }}
                >
                  {renderRichText(heading, accent)}
                </h1>
              )}

              {showBody && (
                <p
                  style={{
                    fontFamily: SANS_STACK,
                    fontSize: 30 * ts,
                    fontWeight: 400,
                    lineHeight: 1.45,
                    margin: 0,
                    color: styleIsDark
                      ? "rgba(247,245,239,0.78)"
                      : "rgba(10,10,10,0.75)",
                    maxWidth: 860,
                    whiteSpace: "pre-line",
                  }}
                >
                  {renderRichText(body, accent)}
                </p>
              )}

              {(isCta || isLastSlide) && handleLabel && (
                <div
                  style={{
                    marginTop: 16,
                    display: "inline-flex",
                    alignSelf: "flex-start",
                    alignItems: "center",
                    gap: 16,
                    padding: "22px 38px",
                    background: accent,
                    color: INK,
                    fontFamily: SANS_STACK,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    borderRadius: 999,
                  }}
                >
                  Seguir @{handleLabel}
                  <span style={{ fontSize: 28 }}>→</span>
                </div>
              )}
            </div>
          )}

          {/* ═══════ SLIDE COUNTER BOTTOM-RIGHT ═══════ */}
          {!isCoverLike && (
            <div
              style={{
                position: "absolute",
                right: 60,
                bottom: 30,
                zIndex: 3,
                fontFamily: SANS_STACK,
                fontSize: 18,
                fontWeight: 600,
                color: isSolidBrand
                  ? resolvedFg === INK
                    ? "rgba(10,10,10,0.45)"
                    : "rgba(247,245,239,0.55)"
                  : "rgba(247,245,239,0.45)",
              }}
            >
              {slideNumber}/{totalSlides}
            </div>
          )}

          {/* ═══════ BRANDSDECODED DOT — bolinha bottom-left nas novas variantes ═══════ */}
          {(isSolidBrand || isTextOnly || isFullPhotoBottom) && (
            <div
              style={{
                position: "absolute",
                left: 60,
                bottom: 26,
                zIndex: 3,
                fontFamily: SANS_STACK,
                fontSize: 32,
                lineHeight: 1,
                color: dotColor,
              }}
            >
              ●
            </div>
          )}
        </div>
      </div>
    );
  }
);

/**
 * Quebra o body em parágrafos usando blank line (\n\n) como divisor.
 * Retorna pelo menos 1 item; ignora parágrafos em branco.
 */
function splitParagraphs(body: string): string[] {
  if (!body) return [""];
  const parts = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [body];
}

/**
 * Eyebrow por slide — etiqueta curta editorial. Gera genérico por default,
 * mas poderia vir do body/heading no futuro.
 */
function slideEyebrowFor(slideNumber: number, total: number): string {
  if (slideNumber === 1) return "A CAPA";
  if (slideNumber === total) return "O FECHO";
  const labels = [
    "O QUE MUDOU",
    "O SINTOMA",
    "O MECANISMO",
    "O DADO",
    "O CONTRASTE",
    "O PRINCÍPIO",
    "A APLICAÇÃO",
    "O RISCO",
  ];
  return labels[(slideNumber - 2) % labels.length];
}

/** Contraste automático bg/fg por luminância. */
function pickFgForBg(hex: string): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return "#0A0A0A";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const l = (r * 299 + g * 587 + b * 114) / 1000;
  return l > 140 ? "#0A0A0A" : "#F7F5EF";
}

export default TemplateManifesto;
