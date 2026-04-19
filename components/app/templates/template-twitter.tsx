"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 04 — Twitter v2 (tweet screenshot)
 *
 * Paleta: branco + preto + azul X `#1D9BF0`.
 * Mockup clean de tweet. Header com avatar 100px + nome bold + verified
 * badge + @handle. Body e heading em Inter 39px (hierarquia via **bold**).
 * Imagem abaixo do texto. Action bar opcional no último slide.
 */

const TemplateTwitter = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateTwitter(
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
    const avatarSrc = resolveImgSrc(profile.photoUrl, exportMode);
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const baseBg = slideStyle === "dark" ? "#0A0A0A" : "#ffffff";
    const bg = bgColor || baseBg;
    const isDarkBg = isTwitterDark(bg);
    const fg = isDarkBg ? "#F5F5F5" : "#0A0A0A";
    const muted = isDarkBg ? "#9CA3AF" : "#6b7280";
    const defaultVerifiedBlue = "#1D9BF0";
    const verifiedBlue = accentOverride || defaultVerifiedBlue;
    const borderColor = isDarkBg ? "#262626" : "#e5e7eb";

    const isCover = variant === "cover";
    const isPhoto = variant === "photo";
    const isSplit = variant === "split";
    const isQuote = variant === "quote";
    const isCta = variant === "cta";

    const defaultFontFamily =
      '"SVInter", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
    const fontFamily = displayFontOverride || defaultFontFamily;
    const ts = Math.max(0.6, Math.min(1.6, textScale));

    const FS_NAME = 41 * ts;
    const FS_HANDLE = 31 * ts;
    const FS_BODY = 39 * ts;
    const FS_HEADING = 39 * ts;

    return (
      <div
        className="flex-shrink-0"
        style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          position: "relative",
          overflow: "hidden",
          borderRadius: 44 * scale,
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
            color: fg,
            borderRadius: 44,
            display: "flex",
            flexDirection: "column",
            padding: "64px 70px 56px",
            fontFamily,
            overflow: "hidden",
            border: `2px solid ${borderColor}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
            boxSizing: "border-box",
          }}
        >
          {/* Header: Avatar + Name + @handle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 40,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${verifiedBlue}, #0A0A0A)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 40,
                fontWeight: 900,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  crossOrigin="anonymous"
                  alt={profile.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: FS_NAME,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: fg,
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {profile.name}
                </span>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 22 22"
                  fill="none"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
                    fill={verifiedBlue}
                  />
                </svg>
              </div>
              <div
                style={{
                  fontSize: FS_HANDLE,
                  color: muted,
                  lineHeight: 1.2,
                  marginTop: 4,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {profile.handle}
              </div>
            </div>

            {/* Counter topo-direita */}
            <div
              style={{
                fontSize: 26,
                color: muted,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                alignSelf: "flex-start",
              }}
            >
              {slideNumber}/{totalSlides}
            </div>
          </div>

          {/* Main content — variantes adaptam tweet screenshot */}
          {isSplit ? (
            <div
              style={{
                flex: "1 1 0",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                overflow: "hidden",
                minHeight: 0,
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {showTitle && (
                  <h2
                    style={{
                      fontSize: FS_HEADING * 0.85,
                      fontWeight: 500,
                      lineHeight: 1.25,
                      margin: 0,
                      letterSpacing: "-0.01em",
                      color: fg,
                    }}
                  >
                    {renderRichText(heading)}
                  </h2>
                )}
                {showBody && (
                  <p
                    style={{
                      fontSize: FS_BODY * 0.85,
                      lineHeight: 1.4,
                      color: fg,
                      margin: 0,
                      whiteSpace: "pre-line",
                      fontWeight: 400,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {renderRichText(body)}
                  </p>
                )}
              </div>
              {showBg && imageUrl && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: `url(${bodyImgSrc}) center/cover`,
                    border: `1px solid ${borderColor}`,
                  }}
                />
              )}
            </div>
          ) : isQuote ? (
            <div
              style={{
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                gap: 24,
                padding: "0 20px",
              }}
            >
              <div
                style={{
                  fontSize: 160,
                  color: verifiedBlue,
                  lineHeight: 0.8,
                  fontFamily: `"Instrument Serif", Georgia, serif`,
                  fontStyle: "italic",
                }}
              >
                &ldquo;
              </div>
              {showTitle && (
                <h2
                  style={{
                    fontSize: FS_HEADING * 1.2,
                    fontWeight: 400,
                    lineHeight: 1.2,
                    margin: 0,
                    letterSpacing: "-0.02em",
                    color: fg,
                    fontStyle: "italic",
                  }}
                >
                  {renderRichText(heading)}
                </h2>
              )}
              {showBody && (
                <p
                  style={{
                    fontSize: FS_BODY * 0.9,
                    lineHeight: 1.4,
                    color: muted,
                    margin: 0,
                    maxWidth: 720,
                    whiteSpace: "pre-line",
                  }}
                >
                  {renderRichText(body)}
                </p>
              )}
            </div>
          ) : isCover ? (
            <div
              style={{
                flex: "1 1 0",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 20,
                overflow: "hidden",
                minHeight: 0,
                borderRadius: 16,
                border: `1px solid ${borderColor}`,
                padding: 40,
                background: imageUrl && showBg
                  ? `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%), url(${bodyImgSrc}) center/cover`
                  : `${verifiedBlue}`,
              }}
            >
              {showTitle && (
                <h2
                  style={{
                    fontSize: FS_HEADING * 1.35,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    margin: 0,
                    letterSpacing: "-0.02em",
                    color: "#FFFFFF",
                  }}
                >
                  {renderRichText(heading)}
                </h2>
              )}
            </div>
          ) : (
            <div
              style={{
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                gap: 28,
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              {showTitle && (
                <h2
                  style={{
                    fontSize: FS_HEADING * (isPhoto ? 0.85 : 1),
                    fontWeight: 400,
                    lineHeight: 1.3,
                    margin: 0,
                    letterSpacing: "-0.01em",
                    color: fg,
                  }}
                >
                  {renderRichText(heading)}
                </h2>
              )}
              {showBody && (
                <p
                  style={{
                    fontSize: FS_BODY * (isPhoto ? 0.78 : 1),
                    lineHeight: 1.4,
                    color: fg,
                    margin: 0,
                    whiteSpace: "pre-line",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {renderRichText(body)}
                </p>
              )}

              {showBg && imageUrl && (
                <div
                  style={{
                    width: "100%",
                    flex: "1 1 auto",
                    borderRadius: 16,
                    overflow: "hidden",
                    marginTop: 8,
                    minHeight: isPhoto ? 520 : 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f4f4f5",
                    border: `1px solid ${borderColor}`,
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
                      borderRadius: 16,
                    }}
                  />
                </div>
              )}

              {isCta && !isLastSlide && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 20,
                    padding: "18px 32px",
                    background: verifiedBlue,
                    color: "#FFFFFF",
                    borderRadius: 9999,
                    fontSize: FS_BODY * 0.85,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Seguir {profile.handle} →
                </div>
              )}
            </div>
          )}

          {/* Action bar opcional no último slide */}
          {isLastSlide && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 32,
                paddingTop: 24,
                borderTop: `1px solid ${borderColor}`,
                color: muted,
                fontSize: 26,
                fontWeight: 500,
              }}
            >
              {["↺ Reply", "⟳ Repost", "♡ Like", "🔖 Save", "↗ Share"].map(
                (label) => (
                  <span
                    key={label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {label}
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

function isTwitterDark(color: string): boolean {
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

export default TemplateTwitter;
