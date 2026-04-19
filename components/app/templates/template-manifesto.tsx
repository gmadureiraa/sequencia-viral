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
 * Template 01 — Manifesto Editorial
 *
 * Paleta: preto + creme + verde lime / pink alternando por slide. Display
 * em Atelier com italic estrutural. Borda 3px preta, kicker mono topo,
 * wordmark de rodapé. Se `imageUrl` estiver presente, trata como "cover"
 * ocupando todo o canvas com overlay escuro (gradiente).
 *
 * Suporta `variant` por-slide (cover / headline / photo / quote / split / cta).
 */

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

    // Alterna accent por slide: slides ímpares em verde lime, pares em pink.
    const defaultAccent = slideNumber % 2 === 1 ? "#7CF067" : "#D262B2";
    const accent = accentOverride || defaultAccent;
    const paper = "#F7F5EF";
    const ink = "#0A0A0A";

    // "cover": foto preenche canvas; "photo": foto ocupa metade inferior;
    // "split": texto à esquerda, imagem à direita; "quote": texto gigante
    // centrado em italic; "cta": destaque no botão; "headline": default.
    const isCoverLike =
      variant === "cover" || (variant === "headline" && hasImage && slideNumber === 1);
    const isSplit = variant === "split" && hasImage;
    const isPhoto = variant === "photo" && hasImage;
    const isQuote = variant === "quote";
    const isCta = variant === "cta";

    // Prioridade: bgColor (per-slide) > variant (cover escuro) > style global.
    const styleIsDark = style === "dark";
    const resolvedBg = bgColor || (isCoverLike ? ink : styleIsDark ? ink : paper);
    const resolvedFg = bgColor
      ? pickFgForBg(bgColor)
      : isCoverLike || styleIsDark
        ? paper
        : ink;

    const defaultDisplayStack =
      '"Atelier", "Instrument Serif", "Times New Roman", Georgia, serif';
    const displayStack = displayFontOverride || defaultDisplayStack;
    const serifStack =
      '"Instrument Serif", Georgia, "Times New Roman", serif';
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    const kickerText = `● BRANDSDECODED · Nº ${String(slideNumber).padStart(
      2,
      "0"
    )}/${String(totalSlides).padStart(2, "0")} · MMXXVI`;

    const coverBgImage = showBg && hasImage && (isCoverLike || isPhoto);

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
            border: `3px solid ${ink}`,
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            fontFamily: serifStack,
          }}
        >
          {/* Cover image + dark gradient overlay quando variant cover/photo ou fallback */}
          {coverBgImage && (
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
                  height: isPhoto ? "55%" : "100%",
                  top: isPhoto ? "auto" : 0,
                  bottom: isPhoto ? 0 : "auto",
                  objectFit: "cover",
                  zIndex: 0,
                }}
              />
              {!isPhoto && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(10,10,10,0.18) 0%, rgba(10,10,10,0.4) 55%, rgba(10,10,10,0.94) 100%)",
                    zIndex: 1,
                  }}
                />
              )}
            </>
          )}

          {/* Kicker topo */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              padding: "78px 90px 0",
              fontFamily: MONO_STACK,
              fontSize: 22 * ts,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: isCoverLike ? accent : resolvedFg,
              fontWeight: 700,
            }}
          >
            {kickerText}
          </div>

          {/* Counter chip */}
          <div
            style={{
              position: "absolute",
              top: 70,
              right: 90,
              zIndex: 3,
              fontFamily: MONO_STACK,
              fontSize: 20,
              letterSpacing: "0.18em",
              color: isCoverLike
                ? "rgba(247,245,239,0.7)"
                : "rgba(10,10,10,0.5)",
            }}
          >
            {String(slideNumber).padStart(2, "0")} /{" "}
            {String(totalSlides).padStart(2, "0")}
          </div>

          {/* Conteúdo central — layouts diferentes por variante */}
          {isSplit ? (
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 40,
                padding: "40px 90px 40px",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 28,
                }}
              >
                {showTitle && (
                  <h1
                    style={{
                      fontFamily: displayStack,
                      fontSize: 86 * ts,
                      fontWeight: 400,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      margin: 0,
                      color: resolvedFg,
                      fontStyle: slideNumber % 2 === 0 ? "italic" : "normal",
                    }}
                  >
                    {renderRichText(heading, accent)}
                  </h1>
                )}
                {showBody && (
                  <p
                    style={{
                      fontFamily: serifStack,
                      fontSize: 30 * ts,
                      lineHeight: 1.42,
                      margin: 0,
                      color: resolvedFg,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {renderRichText(body, accent)}
                  </p>
                )}
              </div>
              {showBg && (
                <div
                  style={{
                    background: hasImage
                      ? `url(${bodyImgSrc}) center/cover`
                      : `repeating-linear-gradient(45deg, ${accent}, ${accent} 12px, ${ink} 12px, ${ink} 24px)`,
                    border: `3px solid ${ink}`,
                  }}
                />
              )}
            </div>
          ) : isQuote ? (
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
                gap: 36,
              }}
            >
              <div
                style={{
                  fontFamily: displayStack,
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
                    fontFamily: displayStack,
                    fontSize: 96 * ts,
                    fontWeight: 400,
                    fontStyle: "italic",
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
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
                    fontFamily: serifStack,
                    fontSize: 30 * ts,
                    lineHeight: 1.42,
                    margin: 0,
                    color: resolvedFg,
                    maxWidth: 720,
                    whiteSpace: "pre-line",
                    fontStyle: "italic",
                  }}
                >
                  {renderRichText(body, accent)}
                </p>
              )}
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: isCoverLike ? "flex-end" : "center",
                padding: isCoverLike ? "0 90px 180px" : "40px 90px 40px",
                gap: 36,
                minHeight: 0,
              }}
            >
              {/* Tick accent bar para slides editoriais (sem imagem) */}
              {!isCoverLike && !isLastSlide && showBg && (
                <div
                  style={{
                    width: 96,
                    height: 8,
                    background: accent,
                  }}
                />
              )}

              {showTitle && (
                <h1
                  style={{
                    fontFamily: displayStack,
                    fontSize: (isCoverLike ? 130 : 118) * ts,
                    fontWeight: 400,
                    lineHeight: 0.98,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    color: resolvedFg,
                    fontStyle: slideNumber % 2 === 0 ? "italic" : "normal",
                  }}
                >
                  {renderRichText(heading, accent)}
                </h1>
              )}

              {showBody && (
                <p
                  style={{
                    fontFamily: serifStack,
                    fontSize: 36 * ts,
                    lineHeight: 1.42,
                    margin: 0,
                    color: isCoverLike ? "rgba(247,245,239,0.88)" : resolvedFg,
                    maxWidth: 860,
                    whiteSpace: "pre-line",
                  }}
                >
                  {renderRichText(body, accent)}
                </p>
              )}

              {(isCta || isLastSlide) && (
                <div
                  style={{
                    marginTop: 24,
                    display: "inline-flex",
                    alignSelf: "flex-start",
                    alignItems: "center",
                    gap: 18,
                    padding: "26px 46px",
                    background: accent,
                    color: ink,
                    fontFamily: MONO_STACK,
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    border: `3px solid ${ink}`,
                    boxShadow: isCta ? `8px 8px 0 ${ink}` : undefined,
                  }}
                >
                  Seguir {profile.handle}
                  <span style={{ fontSize: 30 }}>→</span>
                </div>
              )}
            </div>
          )}

          {/* Footer: wordmark + handle */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              padding: "0 90px 70px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              color: isCoverLike ? paper : ink,
            }}
          >
            <div
              style={{
                fontFamily: displayStack,
                fontSize: 46,
                fontStyle: "italic",
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            >
              Sequência Viral
            </div>
            <div
              style={{
                fontFamily: MONO_STACK,
                fontSize: 22,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: isCoverLike
                  ? "rgba(247,245,239,0.75)"
                  : "rgba(10,10,10,0.6)",
              }}
            >
              {profile.handle}
            </div>
          </div>

          {/* Seta no primeiro slide */}
          {slideNumber === 1 && !isLastSlide && variant !== "quote" && (
            <div
              style={{
                position: "absolute",
                right: 90,
                bottom: 160,
                zIndex: 3,
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: accent,
                border: `3px solid ${ink}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: ink,
                fontSize: 48,
                fontWeight: 900,
              }}
            >
              →
            </div>
          )}
        </div>
      </div>
    );
  }
);

/**
 * Se o bgColor for escuro usa paper, se claro usa ink. Thresholded na
 * luminância perceptual (ITU BT.601).
 */
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
