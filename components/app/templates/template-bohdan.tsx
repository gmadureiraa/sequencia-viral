"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

import { MediaTag } from "./media-tag";
/**
 * Template 07 — Bohdan Editorial
 *
 * Ref visual: @jeremybohdan IG `DXB6ZTDiJsz` (carrossel "Design a carousel
 * with me") + `DR13l-MCN7P` + `DO3xNnRCBFV`. Imagens em
 * `docs/template-refs/template-DXB6ZTDiJsz/`.
 *
 * Estética design-forward: foto B&W contraste alto + serif italic dramático
 * em LIME (#C8FF3D) + handwritten/marker para ênfase + sans bold. Cada slide
 * tem header consistente "Design a carousel with me." + numerador ao lado.
 *
 * Variantes:
 *  - cover              → foto B&W full-bleed + título serif italic gigante em
 *                         lime (centro-baixo) + small caps preheader
 *  - full-photo-bottom  → foto B&W full-bleed + headline em lime serif italic
 *                         no terço inferior + sub branco
 *  - solid-brand        → bg preto + numerador "/NN" lime + título serif italic
 *                         huge em lime + handwritten secondary all-caps
 *  - text-only          → bg preto, título serif italic lime + body sans bold
 *  - split / photo      → bg paper + título serif italic preto + corpo sans +
 *                         imagem direita (rotacionada leve, design-mockup feel)
 *  - photo-overlay      → foto B&W full-bleed + título serif italic em lime +
 *                         body sans branco (alinhamento topo-esquerda)
 *  - quote              → fundo preto + serif italic centrado em lime
 *  - cta                → fundo preto + tese lime serif italic + sub handwritten
 */

const INK = "#0E0E0E";
const PAPER = "#FAFAF7";
const LIME = "#C8FF3D";
const MUTED_DARK = "rgba(250,250,247,0.62)";
const MUTED_LIGHT = "rgba(14,14,14,0.55)";

const SERIF_STACK =
  '"PP Editorial New", "Cormorant Garamond", "Playfair Display", "Times New Roman", Georgia, serif';
const SANS_STACK =
  '"Geist", "SVInter", "Inter", "Plus Jakarta Sans", system-ui, sans-serif';
const HAND_STACK =
  '"Caveat", "Permanent Marker", "Indie Flower", cursive';

const HEADER_LABEL = "Design a carousel with me.";

function splitParagraphs(body: string): string[] {
  if (!body) return [];
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const TemplateBohdan = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateBohdan(
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

    const accent = accentOverride || LIME;
    const ts = Math.max(0.6, Math.min(1.6, textScale));
    const serifStack = displayFontOverride || SERIF_STACK;

    const defaultRotation: Array<
      | "cover"
      | "full-photo-bottom"
      | "solid-brand"
      | "photo-overlay"
      | "split"
      | "text-only"
      | "photo"
      | "quote"
      | "cta"
    > = [
      "cover",
      "full-photo-bottom",
      "solid-brand",
      "photo-overlay",
      "text-only",
      "split",
      "solid-brand",
      "full-photo-bottom",
      "text-only",
      "cta",
    ];
    const resolvedVariant =
      variant ??
      defaultRotation[(slideNumber - 1) % defaultRotation.length];
    const isLast = isLastSlide || slideNumber === totalSlides;
    const effectiveVariant =
      isLast && resolvedVariant !== "cover" ? "cta" : resolvedVariant;

    const isDarkVariant =
      effectiveVariant === "solid-brand" ||
      effectiveVariant === "text-only" ||
      effectiveVariant === "quote" ||
      effectiveVariant === "cta";
    const isFullPhoto =
      effectiveVariant === "cover" ||
      effectiveVariant === "full-photo-bottom" ||
      effectiveVariant === "photo-overlay";

    const surfaceBg = bgColor || (isDarkVariant ? INK : PAPER);
    const textColor = isDarkVariant ? PAPER : INK;
    const headerColor = isFullPhoto ? PAPER : isDarkVariant ? PAPER : INK;

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
            background: isFullPhoto && hasImage && showBg ? INK : surfaceBg,
            color: textColor,
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            fontFamily: SANS_STACK,
            borderRadius: 0,
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
          ) : effectiveVariant === "full-photo-bottom" ? (
            <PhotoBottomCaptionLayout
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
          ) : effectiveVariant === "solid-brand" ? (
            <LessonDarkLayout
              heading={heading}
              body={body}
              accent={accent}
              ts={ts}
              serifStack={serifStack}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              showTitle={showTitle}
              showBody={showBody}
            />
          ) : effectiveVariant === "split" || effectiveVariant === "photo" ? (
            <CardCollageLayout
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
            <TextOnlyDarkLayout
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

          {/* Header consistente em todos os slides — "Design a carousel with me."
              à esquerda + numerador "NN/TOTAL" à direita. Gradiente sutil em
              variantes full-photo pra garantir legibilidade. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "44px 70px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 4,
              fontFamily: SANS_STACK,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: headerColor,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                opacity: isFullPhoto ? 0.95 : 0.85,
                textShadow: isFullPhoto
                  ? "0 1px 8px rgba(0,0,0,0.45)"
                  : undefined,
              }}
            >
              {HEADER_LABEL}
            </span>
            <span
              style={{
                fontFamily: SANS_STACK,
                fontWeight: 600,
                opacity: isFullPhoto ? 0.95 : 0.85,
                textShadow: isFullPhoto
                  ? "0 1px 8px rgba(0,0,0,0.45)"
                  : undefined,
                letterSpacing: "0.04em",
              }}
            >
              {String(slideNumber).padStart(2, "0")}/
              {String(totalSlides).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

// ────────────────────────────────────────────────────────────────────
// Sub-layouts
// ────────────────────────────────────────────────────────────────────

interface LayoutBase {
  heading: string;
  body: string;
  accent: string;
  ts: number;
  serifStack: string;
  showTitle: boolean;
  showBody: boolean;
}

interface LayoutWithImage extends LayoutBase {
  imageSrc?: string;
}

interface LayoutWithImageAndPara extends LayoutWithImage {
  paragraphs: string[];
}

interface LayoutWithPara extends LayoutBase {
  paragraphs: string[];
}

interface LessonDarkProps extends LayoutBase {
  slideNumber: number;
  totalSlides: number;
}

/** COVER — foto B&W full-bleed + título serif italic gigante em lime. */
function CoverLayout({
  heading,
  body,
  imageSrc,
  accent,
  ts,
  serifStack,
  showTitle,
  showBody,
}: LayoutWithImage) {
  return (
    <>
      {imageSrc ? (
        <>          <MediaTag
                src={imageSrc!}
                alt={heading}
                style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(1) contrast(1.08)",
              zIndex: 0,
            }}
              />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.92) 100%)",
              zIndex: 1,
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: INK,
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: "1 1 0",
          display: "flex",
          flexDirection: "column",
          padding: "120px 80px 110px",
        }}
      >
        <div style={{ flex: 1 }} />

        {showBody && body && (
          <div
            style={{
              fontFamily: SANS_STACK,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: PAPER,
              opacity: 0.9,
              marginBottom: 26,
              textShadow: "0 1px 8px rgba(0,0,0,0.55)",
            }}
          >
            {body.split("\n")[0].slice(0, 60)}
          </div>
        )}

        {showTitle && heading && (
          <h1
            style={{
              fontFamily: serifStack,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 132 * ts,
              lineHeight: 0.92,
              letterSpacing: "-0.025em",
              margin: 0,
              color: accent,
              whiteSpace: "pre-line",
              textShadow: "0 4px 22px rgba(0,0,0,0.55)",
            }}
          >
            {renderRichText(heading, accent)}
          </h1>
        )}
      </div>
    </>
  );
}

/** FULL-PHOTO-BOTTOM — foto B&W cobre tudo + caption serif italic lime no fundo. */
function PhotoBottomCaptionLayout({
  heading,
  body,
  imageSrc,
  accent,
  ts,
  serifStack,
  showTitle,
  showBody,
}: LayoutWithImage) {
  return (
    <>
      {imageSrc ? (
        <>          <MediaTag
                src={imageSrc!}
                alt={heading}
                style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(1) contrast(1.08)",
              zIndex: 0,
            }}
              />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 32%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.92) 100%)",
              zIndex: 1,
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: INK,
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: "1 1 0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "100px 80px 110px",
          gap: 22,
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 84 * ts,
              lineHeight: 0.96,
              letterSpacing: "-0.02em",
              margin: 0,
              color: accent,
              whiteSpace: "pre-line",
              maxWidth: 880,
              textShadow: "0 3px 18px rgba(0,0,0,0.55)",
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
              lineHeight: 1.4,
              margin: 0,
              color: PAPER,
              maxWidth: 760,
              whiteSpace: "pre-line",
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

/** PHOTO-OVERLAY — foto B&W full-bleed + título serif italic lime + body
 *  branco no terço SUPERIOR-ESQUERDO. */
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
}: LayoutWithImageAndPara) {
  return (
    <>
      {imageSrc ? (
        <>          <MediaTag
                src={imageSrc!}
                alt={heading}
                style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(1) contrast(1.08)",
              zIndex: 0,
            }}
              />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 35%, rgba(0,0,0,0.05) 65%, rgba(0,0,0,0.55) 100%)",
              zIndex: 1,
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: INK,
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: "1 1 0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          padding: "120px 80px 60px",
          gap: 22,
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 70 * ts,
              lineHeight: 0.98,
              letterSpacing: "-0.02em",
              margin: 0,
              color: accent,
              whiteSpace: "pre-line",
              maxWidth: 880,
              textShadow: "0 3px 18px rgba(0,0,0,0.55)",
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}
        {showBody && (paragraphs.length > 0 || body) && (
          <div
            style={{
              fontFamily: SANS_STACK,
              fontSize: 22 * ts,
              fontWeight: 500,
              lineHeight: 1.45,
              color: PAPER,
              maxWidth: 720,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              textShadow: "0 1px 8px rgba(0,0,0,0.55)",
            }}
          >
            {(paragraphs.length > 0 ? paragraphs : [body]).map((p, i) => (
              <p key={i} style={{ margin: 0, whiteSpace: "pre-line" }}>
                {renderRichText(p, accent)}
              </p>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** SOLID-BRAND aka LESSON-DARK — fundo preto + numerador "/NN" lime no
 *  topo-esquerdo + título serif italic huge lime + handwritten secondary. */
function LessonDarkLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  slideNumber,
  totalSlides,
  showTitle,
  showBody,
}: LessonDarkProps) {
  const numerator = `/${String(slideNumber).padStart(2, "0")}`;
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "120px 80px 110px",
        gap: 28,
      }}
    >
      <div
        style={{
          fontFamily: serifStack,
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 42,
          lineHeight: 1,
          color: accent,
          letterSpacing: "-0.01em",
          opacity: 0.95,
        }}
      >
        {numerator}
        <span
          style={{
            fontFamily: SANS_STACK,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: MUTED_DARK,
            marginLeft: 14,
            verticalAlign: "middle",
          }}
        >
          de {String(totalSlides).padStart(2, "0")}
        </span>
      </div>

      {showTitle && heading && (
        <h2
          style={{
            fontFamily: serifStack,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 110 * ts,
            lineHeight: 0.94,
            letterSpacing: "-0.025em",
            margin: 0,
            color: accent,
            whiteSpace: "pre-line",
            maxWidth: 940,
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
            color: PAPER,
            maxWidth: 800,
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

/** TEXT-ONLY DARK — fundo preto, título serif italic lime + body sans. */
function TextOnlyDarkLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  paragraphs,
  showTitle,
  showBody,
}: LayoutWithPara) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "120px 80px 110px",
        gap: 30,
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: serifStack,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 78 * ts,
            lineHeight: 1.0,
            letterSpacing: "-0.022em",
            margin: 0,
            color: accent,
            whiteSpace: "pre-line",
            maxWidth: 920,
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}
      {showBody && (paragraphs.length > 0 || body) && (
        <div
          style={{
            fontFamily: SANS_STACK,
            fontSize: 24 * ts,
            fontWeight: 500,
            lineHeight: 1.45,
            color: PAPER,
            maxWidth: 800,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {(paragraphs.length > 0 ? paragraphs : [body]).map((p, i) => (
            <p key={i} style={{ margin: 0, whiteSpace: "pre-line" }}>
              {renderRichText(p, accent)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** CARD-COLLAGE / SPLIT — bg paper + título serif italic preto + corpo sans
 *  + imagem direita ligeiramente rotacionada (design mockup feel). */
function CardCollageLayout({
  heading,
  body,
  imageSrc,
  accent,
  ts,
  serifStack,
  paragraphs,
  showTitle,
  showBody,
}: LayoutWithImageAndPara) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "1 1 0",
        display: "grid",
        gridTemplateColumns: "1fr 0.85fr",
        gap: 40,
        padding: "120px 80px 110px",
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
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: serifStack,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 64 * ts,
              lineHeight: 0.98,
              letterSpacing: "-0.022em",
              margin: 0,
              color: INK,
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}
        {showBody && (paragraphs.length > 0 || body) && (
          <div
            style={{
              fontFamily: SANS_STACK,
              fontSize: 22 * ts,
              fontWeight: 500,
              lineHeight: 1.45,
              color: MUTED_LIGHT,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {(paragraphs.length > 0 ? paragraphs : [body]).map((p, i) => (
              <p key={i} style={{ margin: 0, whiteSpace: "pre-line" }}>
                {renderRichText(p, accent)}
              </p>
            ))}
          </div>
        )}
      </div>
      {imageSrc ? (
        <div
          style={{
            position: "relative",
            transform: "rotate(2.5deg)",
            boxShadow: "8px 10px 0 0 rgba(14,14,14,0.92)",
            border: `2px solid ${INK}`,
            overflow: "hidden",
            alignSelf: "center",
            height: "75%",
          }}
        >          <MediaTag
                src={imageSrc!}
                alt={heading}
                style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: "grayscale(1) contrast(1.08)",
            }}
              />
        </div>
      ) : (
        <div
          style={{
            transform: "rotate(2.5deg)",
            border: `2px dashed ${INK}`,
            background: "rgba(14,14,14,0.04)",
            alignSelf: "center",
            height: "75%",
          }}
        />
      )}
    </div>
  );
}

/** QUOTE — fundo preto + serif italic centralizado em lime. */
function QuoteLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  showTitle,
  showBody,
}: LayoutBase) {
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
        padding: "120px 100px 120px",
        textAlign: "center",
        gap: 32,
      }}
    >
      <div
        style={{
          fontFamily: serifStack,
          fontStyle: "italic",
          fontSize: 200,
          lineHeight: 0.7,
          color: accent,
          opacity: 0.9,
        }}
      >
        &ldquo;
      </div>
      {showTitle && heading && (
        <h1
          style={{
            fontFamily: serifStack,
            fontStyle: "italic",
            fontSize: 64 * ts,
            fontWeight: 500,
            lineHeight: 1.04,
            letterSpacing: "-0.018em",
            margin: 0,
            color: accent,
            maxWidth: 880,
          }}
        >
          {renderRichText(heading, accent)}
        </h1>
      )}
      {showBody && body && (
        <p
          style={{
            fontFamily: HAND_STACK,
            fontSize: 30 * ts,
            lineHeight: 1.3,
            margin: 0,
            color: PAPER,
            maxWidth: 640,
            opacity: 0.95,
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

/** CTA — fundo preto + tese lime serif italic + sub handwritten. */
function CtaLayout({
  heading,
  body,
  accent,
  ts,
  serifStack,
  showTitle,
  showBody,
}: LayoutBase) {
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
        padding: "130px 100px 130px",
        gap: 36,
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: serifStack,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 92 * ts,
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            color: accent,
            whiteSpace: "pre-line",
            margin: 0,
            maxWidth: 920,
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: HAND_STACK,
            fontSize: 38 * ts,
            lineHeight: 1.25,
            margin: 0,
            color: PAPER,
            whiteSpace: "pre-line",
            maxWidth: 780,
            opacity: 0.95,
            transform: "rotate(-1deg)",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}

      {/* Pequena linha lime no fim, igual ref do Bohdan no slide final */}
      <div
        style={{
          marginTop: 12,
          width: 120,
          height: 4,
          background: accent,
          opacity: 0.95,
        }}
      />
    </div>
  );
}

export default TemplateBohdan;
