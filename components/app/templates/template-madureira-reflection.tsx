"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 10 — Madureira Reflection
 *
 * Versão text-only (sem imagem) do DS Madureira. Aplica dois layouts:
 *
 *  - Slide capa (variant = "cover"): emoji centralizado + título Fraunces
 *    italic 300, centro do canvas. Replica `01 · Capa emoji` do DS.
 *  - Todos os demais variants: reflexão longa em Geist 400 cream sobre
 *    fundo `--ink-0`. Parágrafos quebrados por linha em branco. Ênfase
 *    via **bold** vira <em> Fraunces italic 300 com cor accent vermilion.
 *    Replica `05 · Reflexão longa` do DS.
 *
 *  Footer mono discreto: `NN · total` esquerda, `@handle` direita.
 *  Pin (square) canto superior direito.
 *
 *  Admin-only (gating na picker page). Mantém o canvas 1080×1350.
 *  Convenções: zero imagem, zero ruído visual; o convite é ler.
 */

const BG = "#000000";
const INK_RULE = "#2b2926";
const FG = "#f4f1ea";
const ACCENT = "#e63a1f";
const MUTE = "#5a5651";

const FRAUNCES =
  '"Fraunces", "Cormorant Garamond", "Times New Roman", Georgia, serif';
const GEIST = '"Geist", "Inter", system-ui, -apple-system, sans-serif';
const MONO =
  '"Geist Mono", "JetBrains Mono", ui-monospace, "Courier New", monospace';

const PAD_X = 115;
const PAD_TOP = 96;
const PAD_BOTTOM = 140;

const EMOJI_PREFIX_RE =
  /^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*)\s+(.*)$/u;

/** Quebra heading com emoji inicial em { emoji, text } pro layout capa. */
function splitEmoji(raw: string): { emoji: string | null; text: string } {
  const m = raw.match(EMOJI_PREFIX_RE);
  if (m) return { emoji: m[1], text: m[2] };
  return { emoji: null, text: raw };
}

/** Quebra body por linha em branco em parágrafos. */
function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Marca **bold** vira <em> Fraunces italic accent — DNA Madureira. */
function renderInline(text: string, key: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <em
          key={`${key}-${i}`}
          style={{
            fontFamily: FRAUNCES,
            fontStyle: "italic",
            fontWeight: 300,
            color: ACCENT,
          }}
        >
          {part.slice(2, -2)}
        </em>
      );
    }
    return <span key={`${key}-${i}`}>{part}</span>;
  });
}

const TemplateMadureiraReflection = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateMadureiraReflection(
    {
      heading,
      body,
      slideNumber,
      totalSlides,
      profile,
      scale = 0.38,
      variant = "headline",
      textScale = 1,
      accentOverride,
    },
    ref,
  ) {
    const accent = accentOverride || ACCENT;
    const isCover = variant === "cover" || slideNumber === 1;

    const headingSplit = splitEmoji((heading || "").trim());
    const paras = paragraphs(body || "");

    return (
      <div
        ref={ref}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          background: BG,
          color: FG,
          position: "relative",
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          fontFamily: GEIST,
        }}
      >
        {/* Pin canto superior direito (selo IG-like) */}
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 32,
            width: 22,
            height: 22,
            border: `1.5px solid ${INK_RULE}`,
          }}
        />

        {isCover ? (
          /* ============= CAPA EMOJI ============= */
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: `0 ${PAD_X}px`,
            }}
          >
            {headingSplit.emoji && (
              <div
                style={{
                  fontSize: 92,
                  lineHeight: 1,
                  marginBottom: 48,
                }}
              >
                {headingSplit.emoji}
              </div>
            )}
            <div
              style={{
                fontFamily: FRAUNCES,
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: 92 * textScale,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: FG,
              }}
            >
              {renderInline(headingSplit.text, "cover")}
            </div>
          </div>
        ) : (
          /* ============= REFLEXÃO LONGA ============= */
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "1.05em",
                fontFamily: GEIST,
                fontWeight: 400,
                fontSize: 38 * textScale,
                lineHeight: 1.5,
                color: FG,
              }}
            >
              {/* heading vira parágrafo de abertura se existir */}
              {heading && heading.trim() && (
                <p style={{ margin: 0 }}>{renderInline(heading.trim(), "head")}</p>
              )}
              {paras.map((p, i) => (
                <p key={i} style={{ margin: 0 }}>
                  {renderInline(p, `p${i}`)}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Footer mono */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: 0,
            right: 0,
            padding: `0 ${PAD_X - 23}px`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: MONO,
            fontSize: 16,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: MUTE,
          }}
        >
          <span>
            {String(slideNumber).padStart(2, "0")} · {String(totalSlides).padStart(2, "0")}
          </span>
          <span style={{ color: MUTE }}>{profile?.handle || "@ogmadureira"}</span>
        </div>
      </div>
    );
  },
);

export default TemplateMadureiraReflection;
