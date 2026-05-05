"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import {
  resolveImgSrc,
  renderRichText,
  CANVAS_W,
  CANVAS_H,
  MONO_STACK,
  isColorDark,
} from "./utils";
import { MediaTag } from "./media-tag";

/**
 * Template 09 — Madureira
 *
 * "Futurista simples": pega a paleta dark navy `#0B0F1E` + accent verde
 * `#00F0A0` do template Futurista, mas reduz a densidade visual. Sem grid
 * técnico, sem brackets, sem corner-marks. Layout mais editorial:
 *
 * - Cover: imagem dominante topo (altura ~60%) + headline bold sans + handle
 *   pequeno em baixo. Sem ruído visual.
 * - Headline / text-only: heading bold sans-serif centralizado, padding
 *   generoso, body sans regular cinza claro.
 * - Photo / split / full-photo-bottom: heading + body + quadrado 1:1 da
 *   imagem (clean, border accent fina, sem corner brackets).
 * - Quote: aspas grandes accent + texto + atribuição.
 * - CTA: handle @ogmadureira em destaque + tagline + comment-gate opcional.
 *
 * Validado pelo Madureira como par com `twitter` pro perfil pessoal.
 * Capa pensada pra aceitar imagem gerada por Imagen 4 ou stock/upload.
 */

const NAVY = "#0B0F1E";
const ACCENT_DEFAULT = "#00F0A0";
const WHITE = "#FFFFFF";
const GREY = "#A0A8BC";

const TemplateMadureira = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateMadureira(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      profile,
      style: slideStyle,
      isLastSlide,
      scale = 0.38,
      exportMode = false,
      accentOverride,
      displayFontOverride,
      textScale = 1,
      variant = "headline",
      bgColor,
      layers,
    },
    ref
  ) {
    const avatarSrc = resolveImgSrc(profile.photoUrl, exportMode);
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const hasImage = Boolean(bodyImgSrc);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const baseBg = slideStyle === "white" ? "#F5F1E8" : NAVY;
    const bg = bgColor || baseBg;
    const isDarkBg = isColorDark(bg);
    const ink = isDarkBg ? WHITE : "#0A0908";
    const muted = isDarkBg ? GREY : "#5C6373";
    const accent = accentOverride || ACCENT_DEFAULT;
    const divider = isDarkBg
      ? "rgba(255,255,255,0.10)"
      : "rgba(10,9,8,0.10)";

    const isCover = variant === "cover";
    const isPhoto = variant === "photo";
    const isSplit = variant === "split";
    const isQuote = variant === "quote";
    const isCta = variant === "cta" || (isLastSlide && !isCover);
    const isFullPhotoBottom = variant === "full-photo-bottom";
    const isTextOnly = variant === "text-only" || variant === "solid-brand";

    const defaultDisplay =
      '"Plus Jakarta Sans", "SVInter", "Inter", system-ui, sans-serif';
    const displayStack = displayFontOverride || defaultDisplay;
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
            background: bg,
            color: ink,
            boxSizing: "border-box",
            overflow: "hidden",
            fontFamily: sansStack,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {isCover ? (
            <CoverSlide
              heading={heading}
              imageUrl={bodyImgSrc}
              hasImage={hasImage}
              showTitle={showTitle}
              showBg={showBg}
              displayStack={displayStack}
              accent={accent}
              ink={ink}
              muted={muted}
              isDarkBg={isDarkBg}
              ts={ts}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              profile={profile}
              avatarSrc={avatarSrc}
            />
          ) : isCta ? (
            <CtaSlide
              heading={heading}
              body={body}
              accent={accent}
              ink={ink}
              muted={muted}
              divider={divider}
              displayStack={displayStack}
              sansStack={sansStack}
              ts={ts}
              profile={profile}
              avatarSrc={avatarSrc}
            />
          ) : isQuote ? (
            <QuoteSlide
              heading={heading}
              body={body}
              showTitle={showTitle}
              showBody={showBody}
              accent={accent}
              ink={ink}
              muted={muted}
              displayStack={displayStack}
              sansStack={sansStack}
              ts={ts}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              profile={profile}
              divider={divider}
            />
          ) : isSplit ? (
            <SplitSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              hasImage={hasImage}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              accent={accent}
              ink={ink}
              muted={muted}
              displayStack={displayStack}
              sansStack={sansStack}
              ts={ts}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              profile={profile}
              divider={divider}
            />
          ) : isFullPhotoBottom ? (
            <FullPhotoBottomSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              hasImage={hasImage}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              accent={accent}
              ink={ink}
              muted={muted}
              displayStack={displayStack}
              sansStack={sansStack}
              ts={ts}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              profile={profile}
              divider={divider}
            />
          ) : isTextOnly ? (
            <TextOnlySlide
              heading={heading}
              body={body}
              showTitle={showTitle}
              showBody={showBody}
              accent={accent}
              ink={ink}
              muted={muted}
              displayStack={displayStack}
              sansStack={sansStack}
              ts={ts}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              profile={profile}
              divider={divider}
            />
          ) : (
            <DefaultSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              hasImage={hasImage}
              isPhoto={isPhoto}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              accent={accent}
              ink={ink}
              muted={muted}
              displayStack={displayStack}
              sansStack={sansStack}
              ts={ts}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              profile={profile}
              divider={divider}
            />
          )}
        </div>
      </div>
    );
  }
);

/* ============================================================
 * Cover — imagem dominante topo + headline bold + handle bottom
 * ============================================================ */
function CoverSlide({
  heading,
  imageUrl,
  hasImage,
  showTitle,
  showBg,
  displayStack,
  accent,
  ink,
  muted,
  isDarkBg,
  ts,
  slideNumber,
  totalSlides,
  profile,
  avatarSrc,
}: {
  heading: string;
  imageUrl?: string;
  hasImage: boolean;
  showTitle: boolean;
  showBg: boolean;
  displayStack: string;
  accent: string;
  ink: string;
  muted: string;
  isDarkBg: boolean;
  ts: number;
  slideNumber: number;
  totalSlides: number;
  profile: { name: string; handle: string; photoUrl: string };
  avatarSrc?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Imagem dominante: ocupa ~62% do canvas */}
      {showBg && hasImage && (
        <div
          style={{
            width: "100%",
            height: "62%",
            position: "relative",
            overflow: "hidden",
            background: isDarkBg ? "#1A1F2E" : "#1A1A1A",
          }}
        >
          <MediaTag
            src={imageUrl!}
            alt={heading}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          {/* gradiente bottom pra texto respirar */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 160,
              background: `linear-gradient(180deg, transparent 0%, ${
                isDarkBg ? "rgba(11,15,30,0.85)" : "rgba(245,241,232,0.85)"
              } 100%)`,
            }}
          />
        </div>
      )}
      {/* Fallback sem imagem: bloco accent leve */}
      {showBg && !hasImage && (
        <div
          style={{
            width: "100%",
            height: "62%",
            background: `linear-gradient(135deg, ${accent}22 0%, ${accent}05 100%)`,
            borderBottom: `2px solid ${accent}`,
          }}
        />
      )}

      {/* Bloco texto */}
      <div
        style={{
          flex: 1,
          padding: "60px 80px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        {/* eyebrow Madureira */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            fontFamily: MONO_STACK,
            fontSize: 18 * ts,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 10px ${accent}`,
            }}
          />
          MADUREIRA · Nº {String(slideNumber).padStart(2, "0")}/
          {String(totalSlides).padStart(2, "0")}
        </div>

        {showTitle && (
          <h1
            style={{
              fontFamily: displayStack,
              fontSize: 84 * ts,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              margin: 0,
              color: ink,
            }}
          >
            {renderRichText(heading || "", accent)}
          </h1>
        )}

        {/* handle bottom */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: MONO_STACK,
            fontSize: 22 * ts,
            color: muted,
            fontWeight: 500,
          }}
        >
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt={profile.name}
              crossOrigin="anonymous"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                objectFit: "cover",
                border: `1.5px solid ${accent}`,
              }}
            />
          ) : null}
          <span style={{ color: ink, fontWeight: 600 }}>{profile.handle}</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Default (headline / photo) — texto + imagem 1:1 abaixo
 * ============================================================ */
function DefaultSlide({
  heading,
  body,
  imageUrl,
  hasImage,
  isPhoto,
  showTitle,
  showBody,
  showBg,
  accent,
  ink,
  muted,
  displayStack,
  sansStack,
  ts,
  slideNumber,
  totalSlides,
  profile,
  divider,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  hasImage: boolean;
  isPhoto: boolean;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  accent: string;
  ink: string;
  muted: string;
  displayStack: string;
  sansStack: string;
  ts: number;
  slideNumber: number;
  totalSlides: number;
  profile: { name: string; handle: string; photoUrl: string };
  divider: string;
}) {
  // Quadrado 1:1 quando tem imagem (photo variant ou imagem em headline)
  return (
    <div
      style={{
        flex: 1,
        padding: "90px 80px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}
    >
      <KickerBar
        accent={accent}
        muted={muted}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 32,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: displayStack,
              fontSize: (hasImage ? 60 : 78) * ts,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              margin: 0,
              color: ink,
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}

        {showBody && body && (
          <p
            style={{
              fontFamily: sansStack,
              fontSize: (hasImage || isPhoto ? 24 : 30) * ts,
              lineHeight: 1.55,
              margin: 0,
              color: muted,
              whiteSpace: "pre-line",
              fontWeight: 400,
            }}
          >
            {renderRichText(body, accent)}
          </p>
        )}

        {showBg && hasImage && (
          <div
            style={{
              marginTop: "auto",
              alignSelf: "center",
              width: 560,
              height: 560,
              border: `2px solid ${accent}`,
              overflow: "hidden",
              background: "#1A1F2E",
              flexShrink: 0,
            }}
          >
            <MediaTag
              src={imageUrl!}
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
      </div>

      <FooterBar
        accent={accent}
        ink={ink}
        muted={muted}
        divider={divider}
        handle={profile.handle}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />
    </div>
  );
}

/* ============================================================
 * Split — texto à esquerda, imagem 1:1 à direita
 * ============================================================ */
function SplitSlide({
  heading,
  body,
  imageUrl,
  hasImage,
  showTitle,
  showBody,
  showBg,
  accent,
  ink,
  muted,
  displayStack,
  sansStack,
  ts,
  slideNumber,
  totalSlides,
  profile,
  divider,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  hasImage: boolean;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  accent: string;
  ink: string;
  muted: string;
  displayStack: string;
  sansStack: string;
  ts: number;
  slideNumber: number;
  totalSlides: number;
  profile: { name: string; handle: string; photoUrl: string };
  divider: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "90px 80px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}
    >
      <KickerBar
        accent={accent}
        muted={muted}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 36,
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
          {showTitle && heading && (
            <h2
              style={{
                fontFamily: displayStack,
                fontSize: 56 * ts,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                margin: 0,
                color: ink,
              }}
            >
              {renderRichText(heading, accent)}
            </h2>
          )}
          {showBody && body && (
            <p
              style={{
                fontFamily: sansStack,
                fontSize: 24 * ts,
                lineHeight: 1.5,
                margin: 0,
                color: muted,
                whiteSpace: "pre-line",
                fontWeight: 400,
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
              overflow: "hidden",
              background: "#1A1F2E",
              alignSelf: "center",
              width: "100%",
              aspectRatio: "1 / 1",
            }}
          >
            {hasImage && (
              <MediaTag
                src={imageUrl!}
                alt={heading}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            )}
          </div>
        )}
      </div>

      <FooterBar
        accent={accent}
        ink={ink}
        muted={muted}
        divider={divider}
        handle={profile.handle}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />
    </div>
  );
}

/* ============================================================
 * Full-photo-bottom — texto topo, foto largura total embaixo
 * ============================================================ */
function FullPhotoBottomSlide({
  heading,
  body,
  imageUrl,
  hasImage,
  showTitle,
  showBody,
  showBg,
  accent,
  ink,
  muted,
  displayStack,
  sansStack,
  ts,
  slideNumber,
  totalSlides,
  profile,
  divider,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  hasImage: boolean;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  accent: string;
  ink: string;
  muted: string;
  displayStack: string;
  sansStack: string;
  ts: number;
  slideNumber: number;
  totalSlides: number;
  profile: { name: string; handle: string; photoUrl: string };
  divider: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "90px 80px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <KickerBar
          accent={accent}
          muted={muted}
          slideNumber={slideNumber}
          totalSlides={totalSlides}
          ts={ts}
        />
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: displayStack,
              fontSize: 60 * ts,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              margin: 0,
              color: ink,
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}
        {showBody && body && (
          <p
            style={{
              fontFamily: sansStack,
              fontSize: 24 * ts,
              lineHeight: 1.5,
              margin: 0,
              color: muted,
              whiteSpace: "pre-line",
              fontWeight: 400,
            }}
          >
            {renderRichText(body, accent)}
          </p>
        )}
      </div>
      {showBg && (
        <div
          style={{
            flex: 1,
            width: "100%",
            background: "#1A1F2E",
            borderTop: `2px solid ${accent}`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {hasImage && (
            <MediaTag
              src={imageUrl!}
              alt={heading}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              bottom: 32,
              right: 80,
              fontFamily: MONO_STACK,
              fontSize: 18 * ts,
              color: WHITE,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {profile.handle}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Text only — texto centralizado, sem imagem
 * ============================================================ */
function TextOnlySlide({
  heading,
  body,
  showTitle,
  showBody,
  accent,
  ink,
  muted,
  displayStack,
  sansStack,
  ts,
  slideNumber,
  totalSlides,
  profile,
  divider,
}: {
  heading: string;
  body: string;
  showTitle: boolean;
  showBody: boolean;
  accent: string;
  ink: string;
  muted: string;
  displayStack: string;
  sansStack: string;
  ts: number;
  slideNumber: number;
  totalSlides: number;
  profile: { name: string; handle: string; photoUrl: string };
  divider: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "90px 80px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}
    >
      <KickerBar
        accent={accent}
        muted={muted}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: displayStack,
              fontSize: 78 * ts,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
              margin: 0,
              color: ink,
              maxWidth: 880,
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}
        {showBody && body && (
          <p
            style={{
              fontFamily: sansStack,
              fontSize: 30 * ts,
              lineHeight: 1.5,
              margin: 0,
              color: muted,
              whiteSpace: "pre-line",
              fontWeight: 400,
              maxWidth: 880,
            }}
          >
            {renderRichText(body, accent)}
          </p>
        )}
      </div>

      <FooterBar
        accent={accent}
        ink={ink}
        muted={muted}
        divider={divider}
        handle={profile.handle}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />
    </div>
  );
}

/* ============================================================
 * Quote — aspas grandes accent, texto centralizado
 * ============================================================ */
function QuoteSlide({
  heading,
  body,
  showTitle,
  showBody,
  accent,
  ink,
  muted,
  displayStack,
  sansStack,
  ts,
  slideNumber,
  totalSlides,
  profile,
  divider,
}: {
  heading: string;
  body: string;
  showTitle: boolean;
  showBody: boolean;
  accent: string;
  ink: string;
  muted: string;
  displayStack: string;
  sansStack: string;
  ts: number;
  slideNumber: number;
  totalSlides: number;
  profile: { name: string; handle: string; photoUrl: string };
  divider: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "90px 80px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}
    >
      <KickerBar
        accent={accent}
        muted={muted}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 24,
          padding: "0 20px",
        }}
      >
        <div
          style={{
            fontFamily: displayStack,
            fontSize: 180,
            color: accent,
            lineHeight: 0.7,
            fontWeight: 800,
          }}
        >
          &ldquo;
        </div>
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: displayStack,
              fontSize: 60 * ts,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              margin: 0,
              color: ink,
              maxWidth: 880,
            }}
          >
            {renderRichText(heading, accent)}
          </h2>
        )}
        {showBody && body && (
          <p
            style={{
              fontFamily: sansStack,
              fontSize: 22 * ts,
              lineHeight: 1.5,
              margin: 0,
              color: muted,
              whiteSpace: "pre-line",
              fontStyle: "italic",
              maxWidth: 780,
            }}
          >
            {renderRichText(body, accent)}
          </p>
        )}
      </div>

      <FooterBar
        accent={accent}
        ink={ink}
        muted={muted}
        divider={divider}
        handle={profile.handle}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        ts={ts}
      />
    </div>
  );
}

/* ============================================================
 * CTA — handle em destaque, comment-gate, tagline
 * ============================================================ */
function CtaSlide({
  heading,
  body,
  accent,
  ink,
  muted,
  divider,
  displayStack,
  sansStack,
  ts,
  profile,
  avatarSrc,
}: {
  heading: string;
  body: string;
  accent: string;
  ink: string;
  muted: string;
  divider: string;
  displayStack: string;
  sansStack: string;
  ts: number;
  profile: { name: string; handle: string; photoUrl: string };
  avatarSrc?: string;
}) {
  const punchline = heading || "salva esse pra usar amanhã.";
  const tagline =
    body ||
    "manda pro amigo founder que ainda tá adiando começar a usar IA pra valer.";
  return (
    <div
      style={{
        flex: 1,
        padding: "90px 80px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          fontFamily: MONO_STACK,
          fontSize: 18 * ts,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: accent,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
        MADUREIRA · CTA
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <h2
          style={{
            fontFamily: displayStack,
            fontSize: 84 * ts,
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            margin: 0,
            color: ink,
            maxWidth: 880,
          }}
        >
          {renderRichText(punchline, accent)}
        </h2>
        <p
          style={{
            fontFamily: sansStack,
            fontSize: 26 * ts,
            lineHeight: 1.5,
            margin: 0,
            color: muted,
            whiteSpace: "pre-line",
            fontWeight: 400,
            maxWidth: 820,
          }}
        >
          {renderRichText(tagline, accent)}
        </p>
      </div>

      <div
        style={{
          paddingTop: 32,
          borderTop: `1px solid ${divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt={profile.name}
              crossOrigin="anonymous"
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${accent}`,
              }}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontFamily: sansStack,
                fontSize: 18 * ts,
                color: muted,
                fontWeight: 500,
              }}
            >
              {profile.name}
            </div>
            <div
              style={{
                fontFamily: MONO_STACK,
                fontSize: 24 * ts,
                color: ink,
                fontWeight: 600,
              }}
            >
              {profile.handle}
            </div>
          </div>
        </div>
        <div
          style={{
            background: accent,
            color: NAVY,
            padding: "20px 32px",
            fontFamily: sansStack,
            fontSize: 22 * ts,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          SEGUIR <span style={{ fontSize: 26 }}>→</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Componentes utilitários — kicker e footer reutilizáveis
 * ============================================================ */
function KickerBar({
  accent,
  muted,
  slideNumber,
  totalSlides,
  ts,
}: {
  accent: string;
  muted: string;
  slideNumber: number;
  totalSlides: number;
  ts: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: MONO_STACK,
        fontSize: 18 * ts,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          color: accent,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />
        MADUREIRA
      </div>
      <div style={{ color: muted, fontWeight: 500 }}>
        {String(slideNumber).padStart(2, "0")} /{" "}
        {String(totalSlides).padStart(2, "0")}
      </div>
    </div>
  );
}

function FooterBar({
  accent,
  ink,
  muted,
  divider,
  handle,
  slideNumber,
  totalSlides,
  ts,
}: {
  accent: string;
  ink: string;
  muted: string;
  divider: string;
  handle: string;
  slideNumber: number;
  totalSlides: number;
  ts: number;
}) {
  const isLast = slideNumber === totalSlides;
  return (
    <div
      style={{
        paddingTop: 22,
        borderTop: `1px solid ${divider}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: MONO_STACK,
        fontSize: 16 * ts,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      <div style={{ color: ink, fontWeight: 600 }}>{handle}</div>
      {!isLast && (
        <span
          style={{
            color: accent,
            fontSize: 28 * ts,
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          →
        </span>
      )}
    </div>
  );
}

export default TemplateMadureira;
