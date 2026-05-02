"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H, MONO_STACK } from "./utils";
import { MediaTag } from "./media-tag";

/**
 * Template 08 — Paper Mono Story (ref: @tobi.the.og)
 *
 * Confessional storytelling em formato editorial mínimo.
 * Cream paper-grain `#ECE9DD` + sans bold (Inter 900) lowercase pra títulos
 * numerados (`1. o erro`) + mono (JetBrains Mono) pro body. Fotos com
 * efeito halftone B&W (radial-gradient sobreposto). Handle em mono pequeno
 * canto inferior esquerdo. Seta `→` discreta canto inferior direito.
 *
 * Validado pelo Madureira (2026-04-29) como par editorial preferido junto
 * com `serif-duelo`. Encaixe ideal: histórias em fases numeradas com 1
 * dado concreto (ex: "R$ 80k em 1 mês"), arco emocional erro → lição.
 */

const PAPER = "#ECE9DD";
const INK = "#0E0E10";
const ACCENT_DEFAULT = "#1A1A1A";

const TemplatePaperMono = forwardRef<HTMLDivElement, SlideProps>(
  function TemplatePaperMono(
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
    const avatarSrc = resolveImgSrc(profile.photoUrl, exportMode);
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const bg = bgColor || PAPER;
    const accent = accentOverride || ACCENT_DEFAULT;
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    const defaultDisplay =
      '"SVInter", "Inter", "Helvetica Neue", system-ui, sans-serif';
    const displayStack = displayFontOverride || defaultDisplay;

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta = variant === "cta" || (isLastSlide && variant !== "cover");
    const isQuote = variant === "quote";

    // Tamanhos derivados do canvas 1080x1350
    const FS_HOOK = 88 * ts;          // capa hook
    const FS_TITLE = 64 * ts;         // título numerado interno
    const FS_BODY = 36 * ts;          // body mono
    const FS_QUOTE = 56 * ts;         // citação centralizada
    const FS_CTA = 96 * ts;           // CTA final
    const FS_HANDLE = 24 * ts;
    const FS_ARROW = 56 * ts;

    // Halftone overlay — radial-gradient pequeno repetido em pattern.
    // Recria o efeito do tobi sem depender de SVG externa.
    const halftoneOverlay =
      "radial-gradient(circle, rgba(0,0,0,0.55) 1px, transparent 1.6px)";
    const halftoneSize = "6px 6px";

    const PADDING = isCover ? "100px 90px 80px" : "100px 90px 100px";

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
            background: bg,
            color: INK,
            boxSizing: "border-box",
            padding: PADDING,
            fontFamily: displayStack,
            display: "flex",
            flexDirection: "column",
            // Paper-grain: noise SVG inline + leve cream variation
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
            backgroundRepeat: "repeat",
            overflow: "hidden",
          }}
        >
          {isCta ? (
            <CtaSlide
              heading={heading}
              body={body}
              profile={profile}
              avatarSrc={avatarSrc}
              accent={accent}
              displayStack={displayStack}
              FS_CTA={FS_CTA}
              FS_BODY={FS_BODY}
              FS_HANDLE={FS_HANDLE}
            />
          ) : isCover ? (
            <CoverSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              halftoneOverlay={halftoneOverlay}
              halftoneSize={halftoneSize}
              displayStack={displayStack}
              accent={accent}
              FS_HOOK={FS_HOOK}
              FS_BODY={FS_BODY}
              FS_HANDLE={FS_HANDLE}
              profile={profile}
              avatarSrc={avatarSrc}
            />
          ) : isQuote ? (
            <QuoteSlide
              body={body || heading}
              FS_QUOTE={FS_QUOTE}
              accent={accent}
            />
          ) : (
            <InnerSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              halftoneOverlay={halftoneOverlay}
              halftoneSize={halftoneSize}
              displayStack={displayStack}
              accent={accent}
              FS_TITLE={FS_TITLE}
              FS_BODY={FS_BODY}
            />
          )}

          {/* Footer comum a todos os slides exceto CTA: handle mono + seta */}
          {!isCta && (
            <Footer
              avatarSrc={avatarSrc}
              handle={profile.handle}
              FS_HANDLE={FS_HANDLE}
              FS_ARROW={FS_ARROW}
              isLast={isLastSlide || slideNumber === totalSlides}
            />
          )}
        </div>
      </div>
    );
  }
);

function CoverSlide({
  heading,
  body,
  imageUrl,
  showTitle,
  showBody,
  showBg,
  halftoneOverlay,
  halftoneSize,
  displayStack,
  accent,
  FS_HOOK,
  FS_BODY,
  FS_HANDLE,
  profile,
  avatarSrc,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  halftoneOverlay: string;
  halftoneSize: string;
  displayStack: string;
  accent: string;
  FS_HOOK: number;
  FS_BODY: number;
  FS_HANDLE: number;
  profile: { name: string; handle: string; photoUrl: string };
  avatarSrc?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 60,
        position: "relative",
      }}
    >
      {showTitle && (
        <h1
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_HOOK,
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            color: "#0E0E10",
            margin: 0,
            textTransform: "lowercase",
            maxWidth: "90%",
          }}
        >
          {renderRichText(heading || "", accent)}
        </h1>
      )}

      {showBg && imageUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            flex: "1 1 auto",
            borderRadius: 4,
            overflow: "hidden",
            background: "#1A1A1A",
            minHeight: 360,
          }}
        >
          <MediaTag
            src={imageUrl}
            alt={heading}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(100%) contrast(1.1)",
            }}
          />
          {/* Halftone dot overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: halftoneOverlay,
              backgroundSize: halftoneSize,
              mixBlendMode: "multiply",
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: MONO_STACK,
            fontSize: FS_BODY,
            lineHeight: 1.55,
            color: "#0E0E10",
            margin: 0,
            maxWidth: "85%",
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

function InnerSlide({
  heading,
  body,
  imageUrl,
  showTitle,
  showBody,
  showBg,
  halftoneOverlay,
  halftoneSize,
  displayStack,
  accent,
  FS_TITLE,
  FS_BODY,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  halftoneOverlay: string;
  halftoneSize: string;
  displayStack: string;
  accent: string;
  FS_TITLE: number;
  FS_BODY: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_TITLE,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#0E0E10",
            margin: 0,
            textTransform: "lowercase",
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: MONO_STACK,
            fontSize: FS_BODY,
            lineHeight: 1.6,
            color: "#0E0E10",
            margin: 0,
            whiteSpace: "pre-line",
            maxWidth: "92%",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}

      {showBg && imageUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 380,
            borderRadius: 4,
            overflow: "hidden",
            background: "#1A1A1A",
            marginTop: 20,
          }}
        >
          <MediaTag
            src={imageUrl}
            alt={heading}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(100%) contrast(1.1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: halftoneOverlay,
              backgroundSize: halftoneSize,
              mixBlendMode: "multiply",
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

function QuoteSlide({
  body,
  FS_QUOTE,
  accent,
}: {
  body: string;
  FS_QUOTE: number;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          fontFamily: MONO_STACK,
          fontSize: FS_QUOTE,
          lineHeight: 1.4,
          color: "#0E0E10",
          margin: 0,
          textAlign: "center",
          maxWidth: "85%",
          fontStyle: "italic",
        }}
      >
        &ldquo;{renderRichText(body, accent)}&rdquo;
      </p>
    </div>
  );
}

function CtaSlide({
  heading,
  body,
  profile,
  avatarSrc,
  accent,
  displayStack,
  FS_CTA,
  FS_BODY,
  FS_HANDLE,
}: {
  heading: string;
  body: string;
  profile: { name: string; handle: string; photoUrl: string };
  avatarSrc?: string;
  accent: string;
  displayStack: string;
  FS_CTA: number;
  FS_BODY: number;
  FS_HANDLE: number;
}) {
  // CTA = "salva esse pra usar amanhã" estilo punchline
  // heading vira a linha-chave, body opcional
  const punchline = heading || "salva esse pra usar amanhã.";
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 56,
      }}
    >
      <h2
        style={{
          fontFamily: displayStack,
          fontWeight: 900,
          fontSize: FS_CTA,
          lineHeight: 0.98,
          letterSpacing: "-0.03em",
          color: "#0E0E10",
          margin: 0,
          textTransform: "lowercase",
          maxWidth: "92%",
        }}
      >
        {renderRichText(punchline, accent)}
      </h2>

      {body && (
        <p
          style={{
            fontFamily: MONO_STACK,
            fontSize: FS_BODY,
            lineHeight: 1.55,
            color: "#0E0E10",
            margin: 0,
            maxWidth: "85%",
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontFamily: MONO_STACK,
          fontSize: FS_HANDLE,
          color: "#0E0E10",
          fontWeight: 600,
        }}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt={profile.name}
            crossOrigin="anonymous"
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #0E0E10",
            }}
          />
        ) : null}
        <span>{profile.handle}</span>
      </div>
    </div>
  );
}

function Footer({
  avatarSrc,
  handle,
  FS_HANDLE,
  FS_ARROW,
  isLast,
}: {
  avatarSrc?: string;
  handle: string;
  FS_HANDLE: number;
  FS_ARROW: number;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: 90,
        bottom: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: MONO_STACK,
        fontSize: FS_HANDLE,
        color: "#0E0E10",
        fontWeight: 600,
        zIndex: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt={handle}
            crossOrigin="anonymous"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1.5px solid #0E0E10",
            }}
          />
        ) : null}
        <span>{handle}</span>
      </div>
      {!isLast && (
        <span
          style={{
            fontSize: FS_ARROW,
            lineHeight: 1,
            color: "#0E0E10",
            fontWeight: 400,
          }}
        >
          →
        </span>
      )}
    </div>
  );
}

export default TemplatePaperMono;
