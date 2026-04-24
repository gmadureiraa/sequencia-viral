"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 05 — Ambitious (motivacional)
 *
 * Ref visual: @anajords Instagram post C-5R-65uI8c.
 * Foto full-bleed em cada slide + texto central grande em sans-serif BOLD ITALIC
 * branco, posição vertical variando (alto / meio / baixo) pra criar ritmo.
 *
 * Hashtag `#beambitious` (ou accent customizável) aparece sutil como assinatura.
 *
 * Variantes internas (mapeadas das `SlideVariantName`):
 *  - cover            → texto alto (terço superior), eagle glyph
 *  - headline         → texto centralizado vertical
 *  - photo            → texto baixo (terço inferior)
 *  - full-photo-bottom→ alias de photo (layout baixo)
 *  - solid-brand      → alias de headline (centralizado)
 *  - text-only        → alias de cover (alto)
 *  - cta              → texto centralizado + pílula #beambitious destacada
 *
 * A altura do texto é o vocabulário principal. Todas as variantes compartilham
 * o mesmo tratamento: imagem dominante + shadow difusa pra texto legível + peso
 * italic forte. Isso garante que slides de voz/OCR não quebrem o ritmo visual.
 */

const INK = "#0A0A0A";
const PAPER = "#F5F5F5";
const ACCENT_DEFAULT = "#EACB7C"; // amber (eagle-like) suave, igual ao mood @anajords

type VPos = "top" | "center" | "bottom";

function resolveVPos(slideNumber: number, variant?: string): VPos {
  if (variant === "cover" || variant === "text-only") return "top";
  if (variant === "photo" || variant === "full-photo-bottom") return "bottom";
  if (variant === "headline" || variant === "solid-brand" || variant === "cta")
    return "center";
  // rotação default slide-index
  const mod = slideNumber % 3;
  return mod === 1 ? "top" : mod === 2 ? "bottom" : "center";
}

function justifyFor(v: VPos): React.CSSProperties["justifyContent"] {
  if (v === "top") return "flex-start";
  if (v === "bottom") return "flex-end";
  return "center";
}

const TemplateAmbitious = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateAmbitious(
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
      variant,
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
    const handleLabel = (profile.handle || "").replace(/^@/, "").trim();
    const vPos = resolveVPos(slideNumber, variant);

    // Stack: sans-serif bold italic pra replicar a voz dos prints @anajords.
    // Inter/SVInter suporta italic variável — usamos fontStyle italic + weight 900.
    const defaultDisplay =
      '"SVInter", "Inter", "Helvetica Neue", Arial, system-ui, sans-serif';
    const displayStack = displayFontOverride || defaultDisplay;
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    // Tamanho do texto principal é grande, mas respira — 64px default. Evita
    // cortar linhas longas em 1080px de canvas.
    const mainSize = 60 * ts;
    const bodySize = 26 * ts;

    // Fallback bg escuro quando não tem imagem (mantém a estética dark).
    const fallbackBg = bgColor || INK;

    const isCta = variant === "cta" || isLastSlide;

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
            background: fallbackBg,
            color: PAPER,
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            fontFamily: displayStack,
          }}
        >
          {/* ── Full-bleed image ── */}
          {showBg && hasImage && (
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
              {/* Shadow sutil em cima + embaixo pra garantir legibilidade do
                  texto em qualquer vPos. Zona do meio fica limpa. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0.08) 30%, rgba(10,10,10,0.08) 65%, rgba(10,10,10,0.55) 100%)",
                  zIndex: 1,
                }}
              />
            </>
          )}

          {/* ── Texto principal, posição vertical varia ── */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              justifyContent: justifyFor(vPos),
              padding:
                vPos === "top"
                  ? "110px 80px 40px"
                  : vPos === "bottom"
                    ? "40px 80px 130px"
                    : "40px 80px 40px",
              gap: 22,
            }}
          >
            {showTitle && heading && (
              <h1
                style={{
                  fontFamily: displayStack,
                  fontWeight: 900,
                  fontStyle: "italic",
                  fontSize: mainSize,
                  lineHeight: 1.05,
                  letterSpacing: "-0.012em",
                  margin: 0,
                  color: PAPER,
                  textAlign: "center",
                  textShadow:
                    "0 2px 18px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.45)",
                  whiteSpace: "pre-line",
                }}
              >
                {renderRichText(heading, accent)}
              </h1>
            )}
            {showBody && body && (
              <p
                style={{
                  fontFamily: displayStack,
                  fontWeight: 500,
                  fontStyle: "italic",
                  fontSize: bodySize,
                  lineHeight: 1.35,
                  letterSpacing: "0.005em",
                  margin: 0,
                  color: "rgba(245,245,245,0.92)",
                  textAlign: "center",
                  textShadow: "0 1px 8px rgba(0,0,0,0.6)",
                  whiteSpace: "pre-line",
                  maxWidth: 820,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                {renderRichText(body, accent)}
              </p>
            )}

            {/* CTA → pílula accent com handle ou #beambitious */}
            {isCta && (
              <div
                style={{
                  marginTop: 20,
                  alignSelf: "center",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 28px",
                  background: accent,
                  color: INK,
                  fontFamily: displayStack,
                  fontStyle: "italic",
                  fontWeight: 900,
                  fontSize: 24,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  borderRadius: 999,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                }}
              >
                {handleLabel ? `Seguir @${handleLabel}` : "#beambitious"}
                <span style={{ fontSize: 26, fontStyle: "normal" }}>🦅</span>
              </div>
            )}
          </div>

          {/* ── Hashtag/assinatura bottom-left (escondida no CTA pra não duplicar) ── */}
          {!isCta && (
            <div
              style={{
                position: "absolute",
                left: 60,
                bottom: 40,
                zIndex: 3,
                fontFamily: displayStack,
                fontStyle: "italic",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: "rgba(245,245,245,0.82)",
                textShadow: "0 1px 6px rgba(0,0,0,0.6)",
              }}
            >
              #beambitious
              <span style={{ marginLeft: 8, color: accent }}>🦅</span>
            </div>
          )}

          {/* ── Slide counter bottom-right ── */}
          {!isCta && (
            <div
              style={{
                position: "absolute",
                right: 60,
                bottom: 40,
                zIndex: 3,
                fontFamily: displayStack,
                fontSize: 20,
                fontWeight: 700,
                color: "rgba(245,245,245,0.72)",
                textShadow: "0 1px 6px rgba(0,0,0,0.6)",
              }}
            >
              {slideNumber}/{totalSlides}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default TemplateAmbitious;
