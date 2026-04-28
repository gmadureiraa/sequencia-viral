"use client";

// LEGACY — não aparece no picker (TEMPLATE_ORDER = ["manifesto", "twitter"]).
// Só renderiza drafts antigos salvos com esse id. Mantido por compat.
import { forwardRef } from "react";
import type { SlideProps } from "./types";
import {
  resolveImgSrc,
  renderRichText,
  CANVAS_W,
  CANVAS_H,
  MONO_STACK,
} from "./utils";

import { MediaTag } from "./media-tag";
/**
 * Template 02 — Futurista Navy
 *
 * Paleta: navy `#0B0F1E` + accent ciano/verde neon `#00F0A0` + branco.
 * Display em Space Grotesk bold caps. Fundo navy com grid sutil 60px.
 * Imagens renderizadas como inset retangular com border 2px accent.
 * Métricas/números em destaque via markers `**bold**` → chip accent.
 */

const TemplateFuturista = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateFuturista(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      profile,
      isLastSlide,
      scale = 0.38,
      exportMode = false,
      accentOverride,
      displayFontOverride,
      textScale = 1,
      style: slideStyle,
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

    const baseNavy = slideStyle === "white" ? "#FFFFFF" : "#0B0F1E";
    const navy = bgColor || baseNavy;
    const isDarkBg = isColorDark(navy);
    const defaultAccent = "#00F0A0";
    const accent = accentOverride || defaultAccent;
    const white = isDarkBg ? "#FFFFFF" : "#0A0A0A";
    const grey = isDarkBg ? "#A0A8BC" : "#4B5563";
    const gridColor = isDarkBg
      ? "rgba(255,255,255,0.05)"
      : "rgba(10,10,10,0.06)";

    const isCover = variant === "cover";
    const isPhoto = variant === "photo";
    const isSplit = variant === "split";
    const isQuote = variant === "quote";
    const isCta = variant === "cta";

    const defaultDisplayStack =
      '"Space Grotesk", "SVInter", "Inter", system-ui, sans-serif';
    const displayStack = displayFontOverride || defaultDisplayStack;
    const sansStack = '"SVInter", "Inter", system-ui, sans-serif';
    const ts = Math.max(0.6, Math.min(1.6, textScale));

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
            background: navy,
            color: white,
            boxSizing: "border-box",
            overflow: "hidden",
            fontFamily: sansStack,
            display: "flex",
            flexDirection: "column",
            padding: "90px 80px 80px",
          }}
        >
          {/* Grid de fundo sutil */}
          {showBg && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
                backgroundSize: "60px 60px",
                zIndex: 0,
              }}
            />
          )}

          {/* Cover: imagem de fundo ocupando todo o canvas */}
          {showBg && isCover && hasImage && (
            <>              <MediaTag
                src={bodyImgSrc!}
                alt={heading}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 0,
                  opacity: 0.55,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(11,15,30,0.35) 0%, rgba(11,15,30,0.9) 100%)",
                  zIndex: 0,
                }}
              />
            </>
          )}

          {/* Halo radial accent no canto */}
          {showBg && (
            <div
              style={{
                position: "absolute",
                top: -200,
                right: -200,
                width: 700,
                height: 700,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)`,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Kicker topo */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 48,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 22px",
                border: `1.5px solid ${accent}`,
                background: `${accent}14`,
                fontFamily: MONO_STACK,
                fontSize: 20 * ts,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: accent,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: accent,
                  boxShadow: `0 0 12px ${accent}`,
                }}
              />
              SV · TECH · Nº {String(slideNumber).padStart(2, "0")}
            </div>
            <div
              style={{
                fontFamily: MONO_STACK,
                fontSize: 20,
                letterSpacing: "0.18em",
                color: grey,
              }}
            >
              {String(slideNumber).padStart(2, "0")} /{" "}
              {String(totalSlides).padStart(2, "0")}
            </div>
          </div>

          {/* Accent line */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              width: 96,
              height: 3,
              background: accent,
              marginBottom: 34,
            }}
          />

          {/* Main content — variantes controlam layout */}
          {isSplit ? (
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 40,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 24,
                }}
              >
                {showTitle && (
                  <h1
                    style={{
                      fontFamily: displayStack,
                      fontSize: 68 * ts,
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: "-0.035em",
                      textTransform: "uppercase",
                      margin: 0,
                      color: white,
                    }}
                  >
                    {renderRichText(heading, accent)}
                  </h1>
                )}
                {showBody && (
                  <p
                    style={{
                      fontFamily: sansStack,
                      fontSize: 26 * ts,
                      lineHeight: 1.5,
                      margin: 0,
                      color: grey,
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
                    border: `2px solid ${accent}`,
                    background: hasImage
                      ? `url(${bodyImgSrc}) center/cover`
                      : `repeating-linear-gradient(0deg, ${accent}22, ${accent}22 2px, transparent 2px, transparent 8px)`,
                    minHeight: 0,
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
                textAlign: "center",
                gap: 28,
                padding: "0 40px",
              }}
            >
              <div
                style={{
                  fontFamily: displayStack,
                  fontSize: 160,
                  color: accent,
                  lineHeight: 0.8,
                }}
              >
                &ldquo;
              </div>
              {showTitle && (
                <h1
                  style={{
                    fontFamily: displayStack,
                    fontSize: 72 * ts,
                    fontWeight: 800,
                    lineHeight: 1.05,
                    letterSpacing: "-0.03em",
                    textTransform: "uppercase",
                    margin: 0,
                    color: white,
                  }}
                >
                  {renderRichText(heading, accent)}
                </h1>
              )}
              {showBody && (
                <p
                  style={{
                    fontFamily: sansStack,
                    fontSize: 26 * ts,
                    lineHeight: 1.5,
                    margin: 0,
                    color: grey,
                    maxWidth: 780,
                    whiteSpace: "pre-line",
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
                justifyContent: isCover ? "flex-end" : "flex-start",
                gap: 32,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {showTitle && (
                <h1
                  style={{
                    fontFamily: displayStack,
                    fontSize:
                      (isCover ? 120 : hasImage && !isPhoto ? 72 : 90) * ts,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: "-0.035em",
                    textTransform: "uppercase",
                    margin: 0,
                    color: white,
                  }}
                >
                  {renderRichText(heading, accent)}
                </h1>
              )}

              {showBody && !isCover && (
                <p
                  style={{
                    fontFamily: sansStack,
                    fontSize: (isPhoto ? 22 : 28) * ts,
                    lineHeight: 1.5,
                    margin: 0,
                    color: grey,
                    maxWidth: 860,
                    whiteSpace: "pre-line",
                    fontWeight: 400,
                  }}
                >
                  {renderRichText(body, accent)}
                </p>
              )}

              {showBg && hasImage && !isCover && (
                <div
                  style={{
                    flex: "1 1 auto",
                    minHeight: 0,
                    border: `2px solid ${accent}`,
                    background: `${accent}0A`,
                    padding: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >                  <MediaTag
                src={bodyImgSrc!}
                alt={heading}
                style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
              />
                  <span
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      width: 24,
                      height: 24,
                      borderTop: `2px solid ${accent}`,
                      borderLeft: `2px solid ${accent}`,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: 16,
                      right: 16,
                      width: 24,
                      height: 24,
                      borderBottom: `2px solid ${accent}`,
                      borderRight: `2px solid ${accent}`,
                    }}
                  />
                </div>
              )}

              {(isCta || isLastSlide) && (
                <div
                  style={{
                    display: "inline-flex",
                    alignSelf: "flex-start",
                    alignItems: "center",
                    gap: 14,
                    background: accent,
                    color: "#0B0F1E",
                    padding: "22px 38px",
                    fontFamily: displayStack,
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    boxShadow: isCta ? `0 0 30px ${accent}88` : undefined,
                  }}
                >
                  Seguir {profile.handle} <span>→</span>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 26,
              borderTop: "1px solid rgba(255,255,255,0.12)",
              fontFamily: MONO_STACK,
              fontSize: 18,
              letterSpacing: "0.2em",
              color: grey,
              textTransform: "uppercase",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: accent,
                  boxShadow: `0 0 10px ${accent}`,
                }}
              />
              SV ○ Nº {String(slideNumber).padStart(2, "0")}/
              {String(totalSlides).padStart(2, "0")}
            </div>
            <div style={{ color: white, fontWeight: 600 }}>
              {profile.handle}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

function isColorDark(color: string): boolean {
  const m = color.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return true; // default dark (navy)
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const l = (r * 299 + g * 587 + b * 114) / 1000;
  return l <= 140;
}

export default TemplateFuturista;
