"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 06 — Blank Editorial
 *
 * Ref visual: @blankschoolbr Instagram post DT28nYbDWoO.
 * Estética editorial minimalista tipo revista/e-book educativo: fundo off-white
 * #F9F9F9, titulos em serif PLAYFAIR/INSTRUMENT negrito, corpo em SANS
 * Plus Jakarta/Inter regular, com bullets + listas + miniaturas.
 *
 * Diferencial: CADA SLIDE tem um layout diferente, não é "capa + corpo
 * uniforme". A variante manda:
 *  - cover              → foto full-bleed com texto bottom (serif sobre escuro)
 *  - headline           → texto puro topo, parágrafos + CTA final (para frase
 *                         introdutória densa com mix de sans e serif)
 *  - photo              → título esquerda + imagem direita (2 colunas)
 *  - split              → duas colunas: texto esquerda + imagem vertical direita
 *  - full-photo-bottom  → imagem topo + texto corpo + chamada final
 *  - solid-brand        → título grande centralizado (fundo paper) + body
 *                         diretamente abaixo (sem imagem)
 *  - text-only          → só texto: título serif + parágrafos + bullets
 *  - quote              → serif italic centrado (citação)
 *  - cta                → '✦ Blank' + promessa serif + CTA sans destacado
 *
 * Paleta: paper #F9F9F9, ink #222, muted #555. Accent: preto (sem destaque
 * de cor, a marca é a tipografia e a composição). Accent prop só altera
 * o glifo `✦ Blank` e bullets.
 */

const PAPER = "#F9F9F9";
const INK = "#222222";
const MUTED = "#555555";
const ACCENT_DEFAULT = "#111111";

const SERIF_STACK =
  '"Instrument Serif", "Playfair Display", "Times New Roman", Georgia, serif';
const SANS_STACK =
  '"SVInter", "Inter", "Plus Jakarta Sans", system-ui, sans-serif';

/**
 * Quebra o body em parágrafos usando blank line (\n\n) como divisor.
 */
function splitParagraphs(body: string): string[] {
  if (!body) return [];
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Detecta linhas-bullet no body (começam com '-', '•' ou '* ').
 * Retorna array de strings sem o marker, ou null se o parágrafo não é lista.
 */
function parseBullets(para: string): string[] | null {
  const lines = para
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  if (!lines.every((l) => /^([-•*]|\d+[.)])\s+/.test(l))) return null;
  return lines.map((l) => l.replace(/^([-•*]|\d+[.)])\s+/, ""));
}

const TemplateBlank = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateBlank(
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
    const bg = bgColor || PAPER;
    const handleLabel = (profile.handle || "").replace(/^@/, "").trim();
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    // Display font override é aplicado ao heading serif. Se user definiu
    // um stack custom (provável sans), respeitamos — senão default Playfair/Instrument.
    const serifStack = displayFontOverride || SERIF_STACK;

    // Variant resolution — cada slide do carrossel ganha um layout distinto.
    // Rotação default quando sem variant: cover → headline → photo → split →
    // text-only → full-photo-bottom → solid-brand → cta.
    const defaultRotation: Array<
      | "cover"
      | "headline"
      | "photo"
      | "split"
      | "text-only"
      | "full-photo-bottom"
      | "solid-brand"
      | "quote"
      | "cta"
    > = [
      "cover",
      "headline",
      "text-only",
      "split",
      "photo",
      "text-only",
      "full-photo-bottom",
      "solid-brand",
      "text-only",
      "cta",
    ];
    const resolvedVariant =
      variant ??
      defaultRotation[(slideNumber - 1) % defaultRotation.length];
    const isLast = isLastSlide || slideNumber === totalSlides;
    const effectiveVariant =
      isLast && resolvedVariant !== "cover" ? "cta" : resolvedVariant;

    const paragraphs = splitParagraphs(body);

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
            background:
              effectiveVariant === "cover" && hasImage ? INK : bg,
            color: INK,
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            fontFamily: SANS_STACK,
          }}
        >
          {effectiveVariant === "cover" ? (
            <CoverLayout
              heading={heading}
              body={body}
              imageSrc={hasImage && showBg ? bodyImgSrc : undefined}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : effectiveVariant === "photo" ? (
            <PhotoRightLayout
              heading={heading}
              body={body}
              imageSrc={hasImage && showBg ? bodyImgSrc : undefined}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              paragraphs={paragraphs}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : effectiveVariant === "split" ? (
            <SplitVerticalLayout
              heading={heading}
              body={body}
              imageSrc={hasImage && showBg ? bodyImgSrc : undefined}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              paragraphs={paragraphs}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : effectiveVariant === "full-photo-bottom" ? (
            <PhotoTopLayout
              heading={heading}
              body={body}
              imageSrc={hasImage && showBg ? bodyImgSrc : undefined}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              paragraphs={paragraphs}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : effectiveVariant === "quote" ? (
            <QuoteLayout
              heading={heading}
              body={body}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : effectiveVariant === "solid-brand" ? (
            <SolidTitleLayout
              heading={heading}
              body={body}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              paragraphs={paragraphs}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : effectiveVariant === "cta" ? (
            <CtaLayout
              heading={heading}
              body={body}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              handleLabel={handleLabel}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : (
            // headline + text-only → TextBlockLayout
            <TextBlockLayout
              heading={heading}
              body={body}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              paragraphs={paragraphs}
              showTitle={showTitle}
              showBody={showBody}
            />
          )}

          {/* ── Footer: ✦ Blank + slide counter (oculto no cover + cta) ── */}
          {effectiveVariant !== "cover" && effectiveVariant !== "cta" && (
            <>
              <div
                style={{
                  position: "absolute",
                  left: 70,
                  bottom: 40,
                  zIndex: 3,
                  fontFamily: SANS_STACK,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: INK,
                }}
              >
                <span style={{ color: accent, marginRight: 6 }}>✦</span>
                Blank
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 70,
                  bottom: 40,
                  zIndex: 3,
                  fontFamily: SANS_STACK,
                  fontSize: 16,
                  fontWeight: 600,
                  color: MUTED,
                }}
              >
                {slideNumber}/{totalSlides}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
);

// ────────────────────────────────────────────────────────────────────
// Sub-layouts — cada um é uma composição editorial distinta.
// ────────────────────────────────────────────────────────────────────

interface LayoutProps {
  heading: string;
  body: string;
  accent: string;
  ts: number;
  serifStack: string;
  showTitle: boolean;
  showBody: boolean;
}

interface LayoutWithImageProps extends LayoutProps {
  imageSrc?: string;
  paragraphs: string[];
}

interface LayoutWithParagraphsProps extends LayoutProps {
  paragraphs: string[];
}

/** COVER — foto full-bleed, '✦ Blank' topo, título serif sobre foto, subtitle */
function CoverLayout({
  heading,
  body,
  imageSrc,
  accent,
  ts,
  serifStack,
  showTitle,
  showBody,
}: LayoutProps & { imageSrc?: string }) {
  return (
    <>
      {imageSrc && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(15,15,20,0.2) 0%, rgba(15,15,20,0.1) 40%, rgba(15,15,20,0.55) 70%, rgba(15,15,20,0.88) 100%)",
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
          padding: "70px 80px 90px",
        }}
      >
        <div
          style={{
            fontFamily: SANS_STACK,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: PAPER,
          }}
        >
          <span style={{ color: accent, marginRight: 8 }}>✦</span>
          Blank
        </div>

        <div style={{ flex: 1 }} />

        {showTitle && heading && (
          <h1
            style={{
              fontFamily: serifStack,
              fontWeight: 700,
              fontSize: 62 * ts,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              margin: 0,
              color: PAPER,
              textAlign: "center",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(heading, accent)}
          </h1>
        )}

        {showBody && body && (
          <p
            style={{
              marginTop: 28,
              fontFamily: SANS_STACK,
              fontSize: 26 * ts,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "rgba(245,245,245,0.92)",
              textAlign: "center",
              whiteSpace: "pre-line",
              maxWidth: 760,
              marginLeft: "auto",
              marginRight: "auto",
              textShadow: "0 1px 8px rgba(0,0,0,0.55)",
            }}
          >
            {renderRichText(body, accent)}
          </p>
        )}
      </div>
    </>
  );
}

/** HEADLINE + TEXT-ONLY — texto puro topo, título serif, corpo sans, bullets. */
function TextBlockLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  paragraphs,
  showTitle,
  showBody,
}: LayoutWithParagraphsProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        padding: "110px 80px 100px",
        gap: 28,
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: serifStack,
            fontWeight: 700,
            fontSize: 54 * ts,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            margin: 0,
            color: INK,
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}
      {showBody && renderParagraphs(paragraphs, body, ts, accent)}
    </div>
  );
}

/** SOLID-BRAND — título centralizado gigante, body curto abaixo */
function SolidTitleLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  paragraphs,
  showTitle,
  showBody,
}: LayoutWithParagraphsProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "100px 80px",
        gap: 32,
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: serifStack,
            fontWeight: 700,
            fontSize: 76 * ts,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            margin: 0,
            color: INK,
            textAlign: "left",
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}
      {showBody && renderParagraphs(paragraphs, body, ts, accent)}
    </div>
  );
}

/** PHOTO-RIGHT — 2 colunas: texto esquerda + imagem direita colada na borda. */
function PhotoRightLayout({
  heading,
  body,
  imageSrc,
  accent,
  ts,
  serifStack,
  paragraphs,
  showTitle,
  showBody,
}: LayoutWithImageProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
        gap: 50,
        padding: "90px 80px 110px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontWeight: 700,
              fontSize: 48 * ts,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              margin: 0,
              color: INK,
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}
        {showBody && renderParagraphs(paragraphs, body, ts, accent)}
      </div>
      {imageSrc ? (
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            minHeight: 0,
            boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
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
      ) : (
        <div
          style={{
            borderRadius: 20,
            border: `1.5px dashed ${MUTED}`,
            background: "#EFEEEA",
          }}
        />
      )}
    </div>
  );
}

/** SPLIT-VERTICAL — texto ocupa 60% topo-esquerda, imagem vertical 40% direita. */
function SplitVerticalLayout({
  heading,
  body,
  imageSrc,
  accent,
  ts,
  serifStack,
  paragraphs,
  showTitle,
  showBody,
}: LayoutWithImageProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "grid",
        gridTemplateColumns: "1fr 0.75fr",
        gap: 42,
        padding: "100px 80px 110px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontWeight: 700,
              fontSize: 52 * ts,
              lineHeight: 1.04,
              letterSpacing: "-0.015em",
              margin: 0,
              color: INK,
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}
        {showBody && renderParagraphs(paragraphs, body, ts, accent)}
      </div>
      {imageSrc ? (
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
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
      ) : (
        <div
          style={{
            borderRadius: 20,
            border: `1.5px dashed ${MUTED}`,
            background: "#EFEEEA",
          }}
        />
      )}
    </div>
  );
}

/** PHOTO-TOP — imagem horizontal cobre terço superior, texto embaixo. */
function PhotoTopLayout({
  heading,
  body,
  imageSrc,
  accent,
  ts,
  serifStack,
  paragraphs,
  showTitle,
  showBody,
}: LayoutWithImageProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        padding: "90px 80px 110px",
        gap: 32,
      }}
    >
      {imageSrc ? (
        <div
          style={{
            width: "100%",
            height: 380,
            borderRadius: 20,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
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
      ) : null}
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: serifStack,
            fontWeight: 700,
            fontSize: 46 * ts,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            margin: 0,
            color: INK,
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}
      {showBody && renderParagraphs(paragraphs, body, ts, accent)}
    </div>
  );
}

/** QUOTE — serif italic centrado, estilo citação ponderada. */
function QuoteLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  showTitle,
  showBody,
}: LayoutProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "100px 100px 120px",
        textAlign: "center",
        gap: 32,
      }}
    >
      <div
        style={{
          fontFamily: serifStack,
          fontSize: 180,
          lineHeight: 0.8,
          color: accent,
          fontStyle: "italic",
        }}
      >
        &ldquo;
      </div>
      {showTitle && heading && (
        <h1
          style={{
            fontFamily: serifStack,
            fontSize: 52 * ts,
            fontStyle: "italic",
            fontWeight: 500,
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
            margin: 0,
            color: INK,
            maxWidth: 820,
          }}
        >
          {renderRichText(heading, accent)}
        </h1>
      )}
      {showBody && body && (
        <p
          style={{
            fontFamily: SANS_STACK,
            fontSize: 22 * ts,
            lineHeight: 1.45,
            margin: 0,
            color: MUTED,
            maxWidth: 640,
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

/** CTA — '✦ Blank' marcador topo, promessa serif média, call-to-action */
function CtaLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  handleLabel,
  showTitle,
  showBody,
}: LayoutProps & { handleLabel: string }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        padding: "110px 80px 110px",
        gap: 26,
      }}
    >
      <div
        style={{
          fontFamily: SANS_STACK,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: INK,
        }}
      >
        <span style={{ color: accent, marginRight: 8 }}>✦</span>
        Blank
      </div>

      {showTitle && heading && (
        <h2
          style={{
            marginTop: 24,
            fontFamily: serifStack,
            fontWeight: 700,
            fontSize: 52 * ts,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            color: INK,
            whiteSpace: "pre-line",
            margin: 0,
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: SANS_STACK,
            fontSize: 24 * ts,
            fontWeight: 500,
            lineHeight: 1.42,
            margin: 0,
            color: MUTED,
            whiteSpace: "pre-line",
            maxWidth: 720,
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 14,
          padding: "20px 32px",
          background: INK,
          color: PAPER,
          fontFamily: SANS_STACK,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.02em",
          borderRadius: 999,
        }}
      >
        {handleLabel ? `Seguir @${handleLabel}` : "Comente para receber"}
        <span style={{ fontSize: 24 }}>→</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/** Renderiza parágrafos, detectando listas-bullet e aplicando estilo apropriado. */
function renderParagraphs(
  paragraphs: string[],
  rawBody: string,
  ts: number,
  accent: string
): React.ReactNode {
  if (paragraphs.length === 0 && !rawBody) return null;
  const list = paragraphs.length > 0 ? paragraphs : [rawBody];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        fontFamily: SANS_STACK,
        fontSize: 22 * ts,
        lineHeight: 1.45,
        color: MUTED,
      }}
    >
      {list.map((para, i) => {
        const bullets = parseBullets(para);
        if (bullets) {
          return (
            <ul
              key={i}
              style={{
                margin: 0,
                paddingLeft: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {bullets.map((item, j) => (
                <li
                  key={j}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    color: INK,
                  }}
                >
                  <span
                    style={{
                      color: accent,
                      fontWeight: 900,
                      lineHeight: 1.45,
                      flexShrink: 0,
                    }}
                  >
                    •
                  </span>
                  <span style={{ whiteSpace: "pre-line" }}>
                    {renderRichText(item, accent)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} style={{ margin: 0, whiteSpace: "pre-line" }}>
            {renderRichText(para, accent)}
          </p>
        );
      })}
    </div>
  );
}

export default TemplateBlank;
