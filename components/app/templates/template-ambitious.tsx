"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 05 — Ambição (motivacional)
 *
 * Ref visual: @anajords IG `C-5R-65uI8c` (8 slides em
 * `docs/template-refs/ambitious/`).
 *
 * Foto full-bleed + UM bloco curto de texto branco. Tipografia é o ponto-chave:
 * sans-serif **NÃO condensada**, peso 600-700, **caixa baixa**,
 * **sem italic**. Stack mira SF Pro Display (system) → Inter Display →
 * fallbacks. Texto centrado horizontal com sombra discreta. Posição
 * vertical varia entre slides (top / center-mid / bottom) e é a única
 * coisa que muda visualmente entre os slides.
 */

const INK = "#0A0A0A";
const PAPER = "#F5F5F5";
const ACCENT_DEFAULT = "#EACB7C";

type VPos = "top" | "center" | "bottom";

function resolveVPos(slideNumber: number, variant?: string): VPos {
  if (variant === "cover" || variant === "text-only") return "top";
  if (variant === "photo" || variant === "full-photo-bottom") return "bottom";
  if (
    variant === "headline" ||
    variant === "solid-brand" ||
    variant === "cta" ||
    variant === "quote" ||
    variant === "split"
  )
    return "center";
  // rotação default por slide-index — top / center / bottom em ciclo
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
      scale = 0.38,
      exportMode = false,
      accentOverride,
      displayFontOverride,
      textScale = 1,
      variant,
      bgColor,
      layers,
      slideNumber,
    },
    ref
  ) {
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const hasImage = Boolean(bodyImgSrc);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const accent = accentOverride || ACCENT_DEFAULT;
    const vPos = resolveVPos(slideNumber, variant);

    // Stack que mira SF Pro Display (system Apple), depois Inter Display
    // e Inter regular. NÃO inclui Anton/Oswald — refs do @anajords são
    // claramente sans-serif não condensadas.
    const defaultDisplay =
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Display", "SVInter", "Inter", "Helvetica Neue", system-ui, sans-serif';
    const displayStack = displayFontOverride || defaultDisplay;
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    // Tamanho médio (não gigante) — mira ~38-42px @ preview 0.38, ou seja
    // ~100-110px @ canvas 1080. Igual ref.
    const mainSize = 78 * ts;

    const fallbackBg = bgColor || INK;

    // Combina heading + body como um bloco único — sem hierarquia h1/p.
    const combinedText = [heading, body].filter(Boolean).join("\n\n");
    const showText = (showTitle || showBody) && combinedText.trim().length > 0;

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
              {/* Overlay bem leve só pra dar contraste ao texto sem
                  escurecer a foto (igual ref). */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(10,10,10,0.28) 0%, rgba(10,10,10,0.05) 35%, rgba(10,10,10,0.05) 65%, rgba(10,10,10,0.32) 100%)",
                  zIndex: 1,
                }}
              />
            </>
          )}

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
                  ? "150px 110px 40px"
                  : vPos === "bottom"
                    ? "40px 110px 150px"
                    : "40px 110px 40px",
            }}
          >
            {showText && (
              <p
                style={{
                  fontFamily: displayStack,
                  fontWeight: 600,
                  fontSize: mainSize,
                  lineHeight: 1.18,
                  letterSpacing: "-0.01em",
                  margin: 0,
                  color: PAPER,
                  textAlign: "center",
                  textShadow:
                    "0 2px 14px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35)",
                  whiteSpace: "pre-line",
                }}
              >
                {renderRichText(combinedText, accent)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default TemplateAmbitious;
