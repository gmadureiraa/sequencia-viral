"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 06 — Editorial
 *
 * Ref visual: @blankschoolbr IG `DT28nYbDWoO` (10 slides em
 * `docs/template-refs/blank/`).
 *
 * Estética editorial minimalista tipo revista/e-book: fundo off-white
 * #F9F9F9, titulos em serif (Instrument Serif/Playfair) negrito, corpo em
 * SANS Inter regular com bullets + listas (numeradas e por marcador).
 *
 * Cada slide tem layout DIFERENTE — capa + corpo uniforme não funciona
 * pra essa estética. Variantes:
 *  - cover              → foto full-bleed + título serif gigante (centro-baixo)
 *  - photo-overlay      → foto full-bleed + texto serif/sans alinhado topo-left
 *  - photo              → texto esquerda + imagem direita (50/50)
 *  - split              → texto esquerda + imagem vertical direita (1/0.75)
 *  - full-photo-bottom  → imagem topo grande + título serif + lista (numerada
 *                         ou bullets) embaixo
 *  - solid-brand        → título serif gigante centralizado, body abaixo
 *  - text-only          → título serif + parágrafos sans + bullets
 *  - quote              → serif italic centrado (citação)
 *  - cta                → tese serif (com mix preto/cinza) + sub sans bold
 *
 * Paleta: paper #F9F9F9, ink #222, muted #555. Accent só pinta bullets e
 * grifos rich-text — a marca é a tipografia.
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
 * Detecta listas no parágrafo. Retorna `{ kind: 'bullet' | 'numbered', items }`
 * ou `null` quando não é lista. Lista numerada precisa de pelo menos 2 linhas
 * que começam por `1.`, `2.`, `1)`, etc.
 */
function parseList(
  para: string
): { kind: "bullet" | "numbered"; items: string[] } | null {
  const lines = para
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const allNumbered = lines.every((l) => /^\d+[.)]\s+/.test(l));
  if (allNumbered) {
    return {
      kind: "numbered",
      items: lines.map((l) => l.replace(/^\d+[.)]\s+/, "")),
    };
  }
  const allBulleted = lines.every((l) => /^[-•*]\s+/.test(l));
  if (allBulleted) {
    return {
      kind: "bullet",
      items: lines.map((l) => l.replace(/^[-•*]\s+/, "")),
    };
  }
  return null;
}

const TemplateBlank = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateBlank(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
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
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    // Display font override é aplicado ao heading serif. Se user definiu
    // um stack custom (provável sans), respeitamos — senão default Playfair/Instrument.
    const serifStack = displayFontOverride || SERIF_STACK;

    // Variant resolution — cada slide do carrossel ganha um layout distinto.
    // Rotação default segue a estrutura observada em `docs/template-refs/blank/`:
    // capa → photo-overlay → text-only → split → text-only → text-only →
    // photo → solid-brand → full-photo-bottom → cta.
    const defaultRotation: Array<
      | "cover"
      | "photo-overlay"
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
      "photo-overlay",
      "text-only",
      "split",
      "text-only",
      "text-only",
      "photo",
      "solid-brand",
      "full-photo-bottom",
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
          ) : effectiveVariant === "photo-overlay" ? (
            <PhotoOverlayLayout
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

          {/* Footer Blank removido (24/04 — pedido Gabriel). Mantemos só
              o slide-counter discreto (canto inferior direito) nas variantes
              que não cobrem foto inteira. */}
          {effectiveVariant !== "cover" &&
            effectiveVariant !== "photo-overlay" &&
            effectiveVariant !== "cta" && (
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

/** PHOTO-OVERLAY — foto full-bleed igual cover, mas com texto serif/sans
 *  alinhado no terço SUPERIOR-ESQUERDO do canvas (igual slide 2 da ref).
 *  Preserva legibilidade com gradiente top→bottom forte no topo. */
function PhotoOverlayLayout({
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
                "linear-gradient(180deg, rgba(245,245,240,0.92) 0%, rgba(245,245,240,0.78) 35%, rgba(245,245,240,0.18) 70%, rgba(15,15,20,0.05) 100%)",
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
          justifyContent: "flex-start",
          padding: "100px 80px 60px",
          gap: 22,
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontWeight: 700,
              fontSize: 50 * ts,
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

/** PHOTO-RIGHT — 2 colunas 50/50: texto esquerda + imagem direita full-height. */
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
        gridTemplateColumns: "1fr 1fr", // meio-a-meio (era 1.1/0.9)
        gap: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: "90px 70px 100px 80px",
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontWeight: 700,
              fontSize: 52 * ts,
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

/** PHOTO-TOP — imagem horizontal cobre terço superior, texto embaixo bem
 *  formatado. Igual ref @blankschoolbr "Matt Gray". */
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
      }}
    >
      {imageSrc ? (
        <div
          style={{
            width: "100%",
            height: 480,
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
      <div
        style={{
          flex: 1,
          padding: "60px 80px 110px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontWeight: 700,
              fontSize: 50 * ts,
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

/** CTA — promessa serif centralizada, sem botão (apenas tese fechando) */
function CtaLayout({
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
        textAlign: "center",
        padding: "110px 100px 110px",
        gap: 32,
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: serifStack,
            fontWeight: 700,
            fontSize: 64 * ts,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: INK,
            whiteSpace: "pre-line",
            margin: 0,
            maxWidth: 900,
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: SANS_STACK,
            fontSize: 26 * ts,
            fontWeight: 500,
            lineHeight: 1.42,
            margin: 0,
            color: MUTED,
            whiteSpace: "pre-line",
            maxWidth: 760,
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
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
        const parsed = parseList(para);
        if (parsed) {
          return (
            <ul
              key={i}
              style={{
                margin: 0,
                paddingLeft: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {parsed.items.map((item, j) => (
                <li
                  key={j}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    color: INK,
                  }}
                >
                  <span
                    style={{
                      color: parsed.kind === "numbered" ? INK : accent,
                      fontWeight: parsed.kind === "numbered" ? 700 : 900,
                      lineHeight: 1.45,
                      flexShrink: 0,
                      minWidth: parsed.kind === "numbered" ? 24 : "auto",
                    }}
                  >
                    {parsed.kind === "numbered" ? `${j + 1}.` : "•"}
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
