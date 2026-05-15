"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 10 — Madureira Reflection (full DS, 7 layouts)
 *
 * Implementação completa do Madureira Design System (ref:
 * `/tmp/madureira-ds/extracted/.../components/feed.jsx`). Cobre os 7 layouts
 * Feed_* canônicos do DS, escolhendo o renderer correto a partir de
 * `variant` + heurísticas no `heading`/`body`.
 *
 * Layouts disponíveis:
 *   1. CoverEmoji   — capa com emoji 92px topo + Fraunces italic título center
 *      (acionado em variant="cover" quando heading começa com emoji)
 *   2. CoverType    — capa só tipográfica gigante (Fraunces italic 200px,
 *      lineHeight 0.92) + eyebrow mono `CARROSSEL NN · MÊS` + sub Geist
 *      (acionado em variant="cover" sem emoji ou quando body tem `SUB:`)
 *   3. Curve        — diagrama curva 1.01^365 vs 0.99^365 (acionado quando
 *      body começa com `CURVE:`)
 *   4. Bars         — barras semanais SEG-DOM (acionado quando body
 *      começa com `BARS:`)
 *   5. BulletsSoft  — bullets italic suave, Fraunces light (acionado quando
 *      body tem linhas começando com `- ` ou `• `)
 *   6. Reflection   — reflexão longa em Geist 38px cream (default text-only)
 *   7. CTA          — fechamento com keyword ManyChat em destaque + seal
 *      (acionado em variant="cta")
 *
 * Heuristics-first: schema continua o mesmo do clone (sem variants novos no
 * union). Os layouts especiais Curve/Bars/BulletsExtreme dispara via prefix
 * no body (`CURVE:`, `BARS:`, `LIST:`). Footer mono + pin SE no canto sup.
 * direito, exatamente como no template "single" original.
 *
 *  Admin-only (gating na picker page). Mantém canvas 1080×1350. Convenções
 *  do DS Madureira: fundo preto puro, Fraunces italic 300 pra display,
 *  Geist pra body, Geist Mono pra eyebrows/footer, accent vermilion `#e63a1f`
 *  só em **bold** parsed (vira <em> Fraunces italic).
 */

const BG = "#000000";
const INK_RULE = "#2b2926";
const FG = "#f4f1ea";
const ACCENT = "#e63a1f";
const MUTE = "#5a5651";
const TRACK = "#1a1917";

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

const DAY_RE = /^(SEG|TER|QUA|QUI|SEX|S[ÁA]B|DOM)\s+(\d+)$/i;
const PERCENT_PAIR_RE = /([+-])(\d+(?:[.,]\d+)?)\s*%/g;

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

/** Detecta variantes especiais a partir do body (CURVE:, BARS:, LIST:). */
type DetectedLayout =
  | "curve"
  | "bars"
  | "bullets-soft"
  | "bullets-extreme"
  | null;

function detectLayout(body: string): DetectedLayout {
  const trimmed = body.trim();
  if (/^CURVE:/i.test(trimmed)) return "curve";
  if (/^BARS:/i.test(trimmed)) return "bars";
  if (/^LIST:/i.test(trimmed)) return "bullets-extreme";
  // Heurística: 3+ linhas começando com `- ` ou `• ` → bullets soft.
  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-•]\s+/.test(l));
  if (bullets.length >= 3 && bullets.length / lines.length >= 0.6) {
    return "bullets-soft";
  }
  return null;
}

/** Marca **bold** vira <em> Fraunces italic accent — DNA Madureira. */
function renderInline(
  text: string,
  key: string,
  accent: string,
): React.ReactNode {
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
            color: accent,
          }}
        >
          {part.slice(2, -2)}
        </em>
      );
    }
    return <span key={`${key}-${i}`}>{part}</span>;
  });
}

/** Footer mono `NN · TOTAL` esquerda + `@handle` direita. */
function Footer({
  slideNumber,
  totalSlides,
  handle,
}: {
  slideNumber: number;
  totalSlides: number;
  handle: string;
}) {
  return (
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
      <span style={{ color: MUTE }}>{handle}</span>
    </div>
  );
}

/** Pin selo canto superior direito. */
function Pin() {
  return (
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
  );
}

/** Tenta extrair primeira linha do body como subtítulo (formato `SUB: ...`). */
function extractSub(body: string): { sub: string | null; rest: string } {
  const m = body.match(/^\s*SUB:\s*([^\n]+)\n?([\s\S]*)$/i);
  if (m) return { sub: m[1].trim(), rest: m[2].trim() };
  return { sub: null, rest: body };
}

/** Tenta extrair eyebrow do body (formato `EYEBROW: ...`). */
function extractEyebrow(body: string): { eyebrow: string | null; rest: string } {
  const m = body.match(/^\s*EYEBROW:\s*([^\n]+)\n?([\s\S]*)$/i);
  if (m) return { eyebrow: m[1].trim().toUpperCase(), rest: m[2].trim() };
  return { eyebrow: null, rest: body };
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
    const handle = profile?.handle || "@ogmadureira";
    const isCover = variant === "cover" || slideNumber === 1;
    const isCta = variant === "cta";

    const headingTrim = (heading || "").trim();
    const bodyTrim = (body || "").trim();
    const headingSplit = splitEmoji(headingTrim);
    const detected = detectLayout(bodyTrim);

    // Wrapper compartilhado.
    const frame = (children: React.ReactNode) => (
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
        <Pin />
        {children}
        <Footer
          slideNumber={slideNumber}
          totalSlides={totalSlides}
          handle={handle}
        />
      </div>
    );

    /* ====================================================
       LAYOUT — COVER EMOJI (capa com emoji topo + título serif)
       ==================================================== */
    if (isCover && headingSplit.emoji) {
      return frame(
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
          <div
            style={{
              fontSize: 92,
              lineHeight: 1,
              marginBottom: 48,
            }}
          >
            {headingSplit.emoji}
          </div>
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
            {renderInline(headingSplit.text, "cover-em", accent)}
          </div>
        </div>,
      );
    }

    /* ====================================================
       LAYOUT — COVER TYPE (capa só tipográfica monumental)
       Disparo: variant=cover sem emoji.
       ==================================================== */
    if (isCover && !headingSplit.emoji) {
      const { eyebrow, rest: afterEyebrow } = extractEyebrow(bodyTrim);
      const { sub } = extractSub(afterEyebrow || bodyTrim);
      const eyebrowText =
        eyebrow ||
        `CARROSSEL ${String(slideNumber).padStart(2, "0")} · ${monthLabel()}`;
      return frame(
        <>
          <div
            style={{
              position: "absolute",
              top: 70,
              left: 80,
              fontFamily: MONO,
              fontSize: 20,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: MUTE,
            }}
          >
            {eyebrowText}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 80px",
            }}
          >
            <div
              style={{
                fontFamily: FRAUNCES,
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: 200 * textScale,
                lineHeight: 0.92,
                color: FG,
                letterSpacing: "-0.045em",
              }}
            >
              {renderInline(headingTrim, "cover-tp", accent)}
            </div>
            {sub && (
              <div
                style={{
                  marginTop: 48,
                  fontFamily: GEIST,
                  fontSize: 32 * textScale,
                  color: "#8a8680",
                  lineHeight: 1.4,
                  maxWidth: 800,
                }}
              >
                {renderInline(sub, "cover-tp-sub", accent)}
              </div>
            )}
          </div>
        </>,
      );
    }

    /* ====================================================
       LAYOUT — CURVE (diagrama 1% better)
       Disparo: body começa com `CURVE:` (opcional payload).
       ==================================================== */
    if (detected === "curve") {
      const after = bodyTrim.replace(/^CURVE:\s*/i, "").trim();
      const firstLine = after.split(/\n/)[0]?.trim() || "";
      const titleText = headingTrim || "A MATEMÁTICA DA CONSISTÊNCIA";
      const dataLabel =
        firstLine ||
        "1.01 ³⁶⁵ = 37,78 · 0.99 ³⁶⁵ = 0,03";
      return frame(
        <>
          <div
            style={{
              position: "absolute",
              top: 90,
              left: 0,
              right: 0,
              textAlign: "center",
              padding: "0 80px",
            }}
          >
            <div
              style={{
                fontFamily: GEIST,
                fontWeight: 700,
                fontSize: 56 * textScale,
                color: FG,
                letterSpacing: "-0.005em",
              }}
            >
              {titleText.toUpperCase()}
            </div>
            <div
              style={{
                marginTop: 24,
                fontFamily: MONO,
                fontSize: 20,
                color: "#8a8680",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              {dataLabel}
            </div>
          </div>
          <svg
            viewBox="0 0 1080 700"
            style={{
              position: "absolute",
              left: 0,
              top: 380,
              width: 1080,
              height: 700,
            }}
          >
            {/* eixos */}
            <line x1="160" y1="600" x2="160" y2="80" stroke={FG} strokeWidth="2" />
            <line x1="160" y1="600" x2="960" y2="600" stroke={FG} strokeWidth="2" />
            <polyline points="150,100 160,80 170,100" fill="none" stroke={FG} strokeWidth="2" />
            <polyline points="940,590 960,600 940,610" fill="none" stroke={FG} strokeWidth="2" />
            {/* curva +1% */}
            <path
              d="M 160 400 Q 500 390 700 230 T 920 80"
              fill="none"
              stroke={FG}
              strokeWidth="3"
            />
            {/* curva -1% */}
            <path
              d="M 160 400 Q 500 560 920 580"
              fill="none"
              stroke={FG}
              strokeWidth="3"
            />
            {/* linha 1 (1%) */}
            <line
              x1="160"
              y1="400"
              x2="920"
              y2="400"
              stroke={FG}
              strokeWidth="1.5"
              strokeDasharray="4 8"
            />
            <text
              x="120"
              y="410"
              fill={FG}
              fontFamily="Geist Mono"
              fontSize="22"
              textAnchor="end"
            >
              1%
            </text>
            <text
              x="500"
              y="320"
              fill={FG}
              fontFamily="Geist Mono"
              fontSize="22"
              textAnchor="middle"
            >
              +1% / DIA
            </text>
            <text
              x="500"
              y="510"
              fill="#8a8680"
              fontFamily="Geist Mono"
              fontSize="22"
              textAnchor="middle"
            >
              −1% / DIA
            </text>
            <text
              x="540"
              y="650"
              fill={FG}
              fontFamily="Geist Mono"
              fontSize="20"
              textAnchor="middle"
            >
              1 ANO
            </text>
          </svg>
        </>,
      );
    }

    /* ====================================================
       LAYOUT — BARS (barras semanais)
       Disparo: body começa com `BARS:` seguido de linhas tipo `SEG 100`.
       Default fallback: dataset clássico do DS.
       ==================================================== */
    if (detected === "bars") {
      const after = bodyTrim.replace(/^BARS:\s*/i, "").trim();
      const lines = after
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const parsed: { d: string; v: number }[] = [];
      for (const line of lines) {
        const m = line.match(DAY_RE);
        if (m) {
          const day = m[1].toUpperCase().replace("SAB", "SÁB");
          const value = Math.max(0, Math.min(100, Number(m[2]) || 0));
          parsed.push({ d: day, v: value });
        }
      }
      const data =
        parsed.length > 0
          ? parsed
          : [
              { d: "SEG", v: 100 },
              { d: "TER", v: 80 },
              { d: "QUA", v: 5 },
              { d: "QUI", v: 20 },
              { d: "SEX", v: 70 },
              { d: "SÁB", v: 90 },
              { d: "DOM", v: 10 },
            ];
      const eyebrowText = (headingTrim || "ISSO É DISCIPLINA…").toUpperCase();
      return frame(
        <>
          <div
            style={{
              position: "absolute",
              top: 120,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: MONO,
              fontSize: 26,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: FG,
            }}
          >
            {eyebrowText}
          </div>
          <div
            style={{
              position: "absolute",
              top: 290,
              left: 130,
              right: 130,
              display: "grid",
              gap: 22,
            }}
          >
            {data.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 80px",
                  alignItems: "center",
                  gap: 24,
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 26,
                    letterSpacing: "0.18em",
                    color: FG,
                  }}
                >
                  {r.d}
                </div>
                <div
                  style={{
                    height: 18,
                    background: TRACK,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${r.v}%`,
                      background: r.v < 30 ? accent : FG,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 24,
                    color: FG,
                    textAlign: "right",
                  }}
                >
                  {r.v}%
                </div>
              </div>
            ))}
          </div>
        </>,
      );
    }

    /* ====================================================
       LAYOUT — BULLETS SOFT (italic centered, Fraunces light)
       Disparo: body com 3+ linhas começando com `- ` ou `• `.
       ==================================================== */
    if (detected === "bullets-soft") {
      const lines = bodyTrim
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => /^[-•]\s+/.test(l))
        .map((l) => l.replace(/^[-•]\s+/, ""));
      return frame(
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
                fontSize: 76,
                lineHeight: 1,
                marginBottom: 40,
              }}
            >
              {headingSplit.emoji}
            </div>
          )}
          {headingTrim && (
            <div
              style={{
                fontFamily: FRAUNCES,
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: 50 * textScale,
                lineHeight: 1.2,
                color: FG,
                marginBottom: 36,
              }}
            >
              {renderInline(headingSplit.text, "bs-head", accent)}
            </div>
          )}
          <div
            style={{
              fontFamily: FRAUNCES,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: 42 * textScale,
              lineHeight: 1.55,
              color: FG,
              display: "grid",
              gap: 0,
            }}
          >
            {lines.map((line, i) => (
              <div key={i}>· {renderInline(line, `bs-l${i}`, accent)}</div>
            ))}
          </div>
        </div>,
      );
    }

    /* ====================================================
       LAYOUT — BULLETS EXTREME (left + ol numerada, sans)
       Disparo: body começa com `LIST:` seguido de linhas (numera auto).
       ==================================================== */
    if (detected === "bullets-extreme") {
      const after = bodyTrim.replace(/^LIST:\s*/i, "").trim();
      const lines = after
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^(?:\d+[.)\s-]+|[-•]\s+)/, ""));
      const eyebrowText = `${String(lines.length).padStart(2, "0")} PILARES`;
      return frame(
        <>
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 80,
              fontFamily: MONO,
              fontSize: 20,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: MUTE,
            }}
          >
            {eyebrowText}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 80px",
            }}
          >
            <div
              style={{
                fontFamily: FRAUNCES,
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: 88 * textScale,
                lineHeight: 1,
                color: FG,
                letterSpacing: "-0.03em",
                marginBottom: 56,
                maxWidth: 800,
              }}
            >
              {renderInline(headingTrim, "be-head", accent)}
            </div>
            <ol
              style={{
                color: FG,
                fontFamily: GEIST,
                fontSize: 34 * textScale,
                lineHeight: 1.45,
                paddingLeft: 0,
                listStylePosition: "inside",
                margin: 0,
              }}
            >
              {lines.map((line, i) => (
                <li key={i} style={{ margin: 0 }}>
                  {renderInline(line, `be-l${i}`, accent)}
                </li>
              ))}
            </ol>
          </div>
        </>,
      );
    }

    /* ====================================================
       LAYOUT — CTA (fechamento com keyword)
       Disparo: variant === "cta".
       Procura **palavra** no body — vira keyword accent UPPER.
       ==================================================== */
    if (isCta) {
      const keyword = extractKeyword(bodyTrim) || handle.toUpperCase();
      const bodyWithoutKeyword = bodyTrim.replace(/\*\*[^*]+\*\*/, "").trim();
      const ctaTitle = headingTrim || "Salve esse post.\nVolte amanhã.";
      const showBody =
        bodyWithoutKeyword &&
        bodyWithoutKeyword !== ctaTitle &&
        !PERCENT_PAIR_RE.test(bodyWithoutKeyword);
      return frame(
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
          {/* Mark seal: quadrado outline 88 + inner */}
          <div
            style={{
              marginBottom: 56,
              width: 88,
              height: 88,
              border: `2.5px solid ${FG}`,
              position: "relative",
            }}
            aria-hidden
          >
            <div
              style={{
                position: "absolute",
                inset: 18,
                background: FG,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: FRAUNCES,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: 100 * textScale,
              lineHeight: 1,
              color: FG,
              letterSpacing: "-0.03em",
              marginBottom: 36,
              whiteSpace: "pre-line",
            }}
          >
            {renderInline(ctaTitle, "cta-head", accent)}
          </div>
          {showBody && (
            <div
              style={{
                fontFamily: GEIST,
                fontSize: 30 * textScale,
                color: "#8a8680",
                lineHeight: 1.45,
                marginBottom: 36,
                maxWidth: 760,
              }}
            >
              {renderInline(bodyWithoutKeyword, "cta-body", accent)}
            </div>
          )}
          <div
            style={{
              fontFamily: MONO,
              fontSize: 22,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            → {keyword}
          </div>
        </div>,
      );
    }

    /* ====================================================
       LAYOUT — REFLECTION (default text-only longa)
       Disparo: fallback pra todos os demais variants.
       ==================================================== */
    const paras = paragraphs(bodyTrim);
    return frame(
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
          {headingTrim && (
            <p style={{ margin: 0 }}>
              {renderInline(headingTrim, "head", accent)}
            </p>
          )}
          {paras.map((p, i) => (
            <p key={i} style={{ margin: 0 }}>
              {renderInline(p, `p${i}`, accent)}
            </p>
          ))}
        </div>
      </div>,
    );
  },
);

/** Mês em PT-BR uppercase pra eyebrow `CARROSSEL NN · MÊS`. */
function monthLabel(): string {
  const months = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];
  return months[new Date().getMonth()] || "MAIO";
}

/** Extrai **palavra** do body (primeiro match) — vira keyword CTA. */
function extractKeyword(body: string): string | null {
  const m = body.match(/\*\*([^*]+)\*\*/);
  if (m) return m[1].trim().toUpperCase();
  return null;
}

export default TemplateMadureiraReflection;
