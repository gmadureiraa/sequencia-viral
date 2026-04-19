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
 * Template 03 — Autoral Zine
 *
 * Paleta: creme `#F7F5EF` + preto + pink `#D262B2`.
 * Estética editorial/zine: elementos desalinhados, serif italic grande,
 * polaroid com shadow pink, glifos soltos.
 */

const TemplateAutoral = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateAutoral(
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

    const basePaper = slideStyle === "dark" ? "#1C1C1E" : "#F7F5EF";
    const paper = bgColor || basePaper;
    const ink = isAutoralDark(paper) ? "#F7F5EF" : "#0A0A0A";
    const defaultPink = "#D262B2";
    const pink = accentOverride || defaultPink;

    const isCover = variant === "cover";
    const isPhoto = variant === "photo";
    const isSplit = variant === "split";
    const isQuote = variant === "quote";
    const isCta = variant === "cta";

    const defaultSerifStack =
      '"Instrument Serif", "Atelier", Georgia, "Times New Roman", serif';
    const serifStack = displayFontOverride || defaultSerifStack;
    const sansStack = '"SVInter", "Inter", system-ui, sans-serif';
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    // Rotação determinística baseada no slideNumber (efeito zine).
    const bodyRotate = ((slideNumber % 3) - 1) * 0.6;
    const imgRotate = slideNumber % 2 === 0 ? -1.8 : 1.4;
    const headingRotate = -1.4;

    const glyphs = ["✦", "✺", "❋", "✧"];
    const glyph = glyphs[slideNumber % glyphs.length];

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
            background: paper,
            color: ink,
            boxSizing: "border-box",
            overflow: "hidden",
            fontFamily: sansStack,
            display: "flex",
            flexDirection: "column",
            padding: "80px 84px 80px",
          }}
        >
          {/* Textura de dots sutis */}
          {showBg && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "radial-gradient(circle, rgba(10,10,10,0.055) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
                opacity: 0.7,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Cover: imagem preenchendo canvas inteiro */}
          {showBg && isCover && hasImage && (
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
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(247,245,239,0.3) 0%, rgba(10,10,10,0.65) 100%)",
                  zIndex: 0,
                }}
              />
            </>
          )}

          {/* Glifos soltos pink */}
          {showBg && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: 120,
                  right: 70,
                  fontSize: 78,
                  color: pink,
                  zIndex: 1,
                  lineHeight: 1,
                  transform: "rotate(12deg)",
                }}
              >
                {glyph}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 220,
                  left: 60,
                  fontSize: 54,
                  color: pink,
                  zIndex: 1,
                  lineHeight: 1,
                  transform: "rotate(-8deg)",
                  opacity: 0.7,
                }}
              >
                ✦
              </div>
            </>
          )}

          {/* Kicker topo */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 40,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontFamily: MONO_STACK,
                fontSize: 20,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: ink,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: pink,
                  border: `2px solid ${ink}`,
                }}
              />
              Ed. Nº {String(slideNumber).padStart(2, "0")} · Diário editorial
            </div>
            <div
              style={{
                fontFamily: MONO_STACK,
                fontSize: 18,
                letterSpacing: "0.18em",
                color: "rgba(10,10,10,0.55)",
              }}
            >
              {String(slideNumber).padStart(2, "0")} /{" "}
              {String(totalSlides).padStart(2, "0")}
            </div>
          </div>

          {/* Conteúdo central — varia por variant */}
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
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {showTitle && (
                  <h1
                    style={{
                      fontFamily: serifStack,
                      fontSize: 78 * ts,
                      fontWeight: 400,
                      fontStyle: "italic",
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      margin: 0,
                      color: ink,
                      transform: `rotate(${headingRotate}deg)`,
                      transformOrigin: "left top",
                    }}
                  >
                    {renderRichText(heading, pink)}
                  </h1>
                )}
                {showBody && (
                  <p
                    style={{
                      fontFamily: serifStack,
                      fontSize: 26 * ts,
                      lineHeight: 1.42,
                      margin: 0,
                      color: ink,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {renderRichText(body, pink)}
                  </p>
                )}
              </div>
              {showBg && (
                <div
                  style={{
                    background: hasImage
                      ? `url(${bodyImgSrc}) center/cover`
                      : basePaper,
                    border: `1.5px solid ${ink}`,
                    boxShadow: `6px 6px 0 ${pink}`,
                    minHeight: 0,
                    height: "100%",
                    transform: `rotate(${imgRotate}deg)`,
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
                  fontFamily: serifStack,
                  fontSize: 220,
                  color: pink,
                  lineHeight: 0.8,
                  fontStyle: "italic",
                }}
              >
                &ldquo;
              </div>
              {showTitle && (
                <h1
                  style={{
                    fontFamily: serifStack,
                    fontSize: 100 * ts,
                    fontWeight: 400,
                    fontStyle: "italic",
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    color: ink,
                  }}
                >
                  {renderRichText(heading, pink)}
                </h1>
              )}
              {showBody && (
                <p
                  style={{
                    fontFamily: serifStack,
                    fontSize: 28 * ts,
                    lineHeight: 1.42,
                    margin: 0,
                    color: ink,
                    maxWidth: 780,
                    whiteSpace: "pre-line",
                    fontStyle: "italic",
                  }}
                >
                  {renderRichText(body, pink)}
                </p>
              )}
            </div>
          ) : isCover ? (
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 28,
                minHeight: 0,
                paddingBottom: 100,
              }}
            >
              {showTitle && (
                <h1
                  style={{
                    fontFamily: serifStack,
                    fontSize: 140 * ts,
                    fontWeight: 400,
                    fontStyle: "italic",
                    lineHeight: 0.95,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    color: hasImage ? "#F7F5EF" : ink,
                    transform: `rotate(${headingRotate}deg)`,
                    transformOrigin: "left top",
                  }}
                >
                  {renderRichText(heading, pink)}
                </h1>
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
                gap: 32,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {showTitle && (
                <h1
                  style={{
                    fontFamily: serifStack,
                    fontSize: (isPhoto ? 84 : 120) * ts,
                    fontWeight: 400,
                    fontStyle: "italic",
                    lineHeight: 0.98,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    color: ink,
                    transform: `rotate(${headingRotate}deg)`,
                    transformOrigin: "left top",
                  }}
                >
                  {renderRichText(heading, pink)}
                </h1>
              )}

              {showBody && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: 860,
                    background: isAutoralDark(paper) ? "#0A0A0A" : "#FFFFFF",
                    border: `1.5px solid ${ink}`,
                    padding: "24px 32px",
                    transform: `rotate(${bodyRotate}deg) translate(${
                      slideNumber % 2 ? 8 : -6
                    }px, 0)`,
                    boxShadow: `6px 6px 0 ${pink}`,
                  }}
                >
                  <p
                    style={{
                      fontFamily: serifStack,
                      fontSize: (isPhoto ? 24 : 30) * ts,
                      lineHeight: 1.42,
                      margin: 0,
                      color: ink,
                      whiteSpace: "pre-line",
                      fontWeight: 400,
                    }}
                  >
                    {renderRichText(body, pink)}
                  </p>
                </div>
              )}

              {showBg && hasImage && (
                <div
                  style={{
                    alignSelf: slideNumber % 2 === 0 ? "flex-end" : "flex-start",
                    width: isPhoto ? "92%" : "72%",
                    flex: "1 1 auto",
                    minHeight: 0,
                    background: basePaper,
                    border: `20px solid ${basePaper}`,
                    boxShadow: `6px 6px 0 ${pink}, 0 0 0 1.5px ${ink}`,
                    transform: `rotate(${imgRotate}deg)`,
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bodyImgSrc}
                    crossOrigin="anonymous"
                    alt={heading}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
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
                    background: pink,
                    color: "#0A0A0A",
                    padding: "20px 36px",
                    border: `2px solid #0A0A0A`,
                    fontFamily: serifStack,
                    fontSize: 30,
                    fontStyle: "italic",
                    fontWeight: 400,
                    boxShadow: `5px 5px 0 #0A0A0A`,
                  }}
                >
                  Seguir {profile.handle} <span>→</span>
                </div>
              )}
            </div>
          )}

          {/* Footer: wordmark + handle */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              marginTop: 32,
              paddingTop: 22,
              borderTop: `1.5px solid ${ink}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: serifStack,
                fontStyle: "italic",
                fontSize: 40,
                lineHeight: 1,
                color: ink,
              }}
            >
              Sequência Viral
              <span
                style={{ color: pink, fontSize: 24, verticalAlign: "super" }}
              >
                ®
              </span>
            </div>
            <div
              style={{
                fontFamily: MONO_STACK,
                fontSize: 20,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(10,10,10,0.6)",
              }}
            >
              {profile.handle}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

function isAutoralDark(color: string): boolean {
  const m = color.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return false;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const l = (r * 299 + g * 587 + b * 114) / 1000;
  return l <= 140;
}

export default TemplateAutoral;
