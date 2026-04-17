"use client";

import { forwardRef } from "react";

/**
 * Slide do carrossel — especificação fiel à ref Canva do Defiverso:
 *   - Canvas: 1080 × 1350 (Instagram 4:5)
 *   - Font stack: Helvetica Neue, Helvetica, Arial
 *   - Name + @handle: 30px (name bold 800, handle regular 500)
 *   - Title e body: 29px, mesmo tamanho — hierarquia vem de `**bold**` inline
 *   - No primeiro slide: footer com branding (+ toggle opcional)
 *   - Slide CTA (último): conteúdo alinhado à esquerda como os demais, não centralizado
 *
 * Tamanho real é 1080×1350; usamos `scale` prop pra fazer o preview caber
 * em containers menores sem reescrever as medidas internas. Exportar em PNG
 * com scale=1 dá o PNG full-res pronto pra Instagram.
 */

export interface SlideProps {
  heading: string;
  body: string;
  imageUrl?: string;
  slideNumber: number;
  totalSlides: number;
  profile: { name: string; handle: string; photoUrl: string };
  style: "white" | "dark";
  isLastSlide?: boolean;
  /** Exibe o rodapé Sequência Viral (wordmark + seta) só no primeiro slide, e só se true. */
  showFooter?: boolean;
  /** Tamanho da escala visual. 1 = full 1080×1350. 0.5 = 540×675. Default: 0.34 ≈ 367×459. */
  scale?: number;
}

/**
 * Renderiza texto com suporte a **bold** inline (markdown-like).
 */
function renderRichText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 800 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// Dimensões reais do canvas (Instagram 4:5)
const CANVAS_W = 1080;
const CANVAS_H = 1350;

// Font sizes em "design units" (1080 wide canvas).
// Ajustadas pra proporção real do Defiverso — em vez da spec literal "29px"
// que vinha do Canva (que usa unidade diferente de px raw), usamos valores
// que dão a mesma **proporção visual** no export 1080px e ficam legíveis
// no preview em qualquer scale >= 0.35.
const FS_NAME = 41;
const FS_HANDLE = 31;
const FS_BODY = 39;
const FS_HEADING = 39;

const CarouselSlide = forwardRef<HTMLDivElement, SlideProps>(
  function CarouselSlide(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      profile,
      style,
      isLastSlide,
      showFooter = true,
      scale = 0.38,
    },
    ref
  ) {
    const isDark = style === "dark";
    const bg = isDark ? "#0A0A0A" : "#ffffff";
    const fg = isDark ? "#f5f5f5" : "#0A0A0A";
    const muted = isDark ? "#9ca3af" : "#6b7280";
    const accent = "#EC6000";
    const borderColor = isDark ? "#1a1a1a" : "#e5e7eb";
    const verifiedBlue = "#1D9BF0";

    const fontFamily =
      '"Helvetica Neue", Helvetica, Arial, -apple-system, BlinkMacSystemFont, sans-serif';

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
            boxShadow: isDark
              ? "0 4px 24px rgba(0,0,0,0.3)"
              : "0 4px 24px rgba(0,0,0,0.05)",
            boxSizing: "border-box",
          }}
        >
          {/* ─── Header: Avatar + Name + @handle ─── */}
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
                width: 110,
                height: 110,
                borderRadius: "50%",
                background: isDark
                  ? "#ffffff"
                  : `linear-gradient(135deg, ${accent}, #FF8534)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#0A0A0A" : "#ffffff",
                fontSize: 44,
                fontWeight: 900,
                overflow: "hidden",
                flexShrink: 0,
                boxShadow: isDark
                  ? "0 4px 20px rgba(255, 255, 255, 0.1)"
                  : "0 4px 20px rgba(236, 96, 0, 0.25)",
              }}
            >
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
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
          </div>

          {/* ─── Main content ─── */}
          <div
            style={{
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 28,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {isLastSlide ? (
              /* Slide CTA — alinhado à esquerda, NÃO centralizado */
              <>
                <div
                  style={{
                    width: 100,
                    height: 6,
                    borderRadius: 3,
                    background: accent,
                    marginBottom: 8,
                  }}
                />
                <h2
                  style={{
                    fontSize: FS_HEADING,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    margin: 0,
                    letterSpacing: "-0.02em",
                    color: fg,
                  }}
                >
                  {renderRichText(heading)}
                </h2>
                <p
                  style={{
                    fontSize: FS_BODY,
                    lineHeight: 1.5,
                    color: fg,
                    margin: 0,
                    whiteSpace: "pre-line",
                    fontWeight: 400,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {renderRichText(body)}
                </p>
                <div
                  style={{
                    marginTop: 20,
                    padding: "22px 48px",
                    background: `linear-gradient(180deg, #FF8534 0%, ${accent} 100%)`,
                    color: "#fff",
                    borderRadius: 18,
                    fontSize: FS_BODY,
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                    boxShadow: "0 8px 24px rgba(236, 96, 0, 0.3)",
                    alignSelf: "flex-start",
                  }}
                >
                  Seguir {profile.handle}
                </div>
              </>
            ) : (
              /* Slide normal — Defiverso/Canva style */
              <>
                <h2
                  style={{
                    fontSize: FS_HEADING,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    margin: 0,
                    letterSpacing: "-0.02em",
                    color: fg,
                  }}
                >
                  {renderRichText(heading)}
                </h2>
                <p
                  style={{
                    fontSize: FS_BODY,
                    lineHeight: 1.5,
                    color: fg,
                    margin: 0,
                    whiteSpace: "pre-line",
                    fontWeight: 400,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {renderRichText(body)}
                </p>

                {imageUrl && (
                  <div
                    style={{
                      width: "100%",
                      flex: "0 1 auto",
                      borderRadius: 24,
                      overflow: "hidden",
                      marginTop: 8,
                      minHeight: 0,
                      padding: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={heading}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 520,
                        objectFit: "contain",
                        display: "block",
                        borderRadius: 12,
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Slide counter chip */}
          <div
            style={{
              position: "absolute",
              top: 36,
              right: 40,
              fontSize: 22,
              color: muted,
              background: isDark ? "#1a1a1a" : "#f4f4f5",
              padding: "8px 18px",
              borderRadius: 18,
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
            {slideNumber}/{totalSlides}
          </div>

          {/* Arrow circle — only on slide 1 */}
          {slideNumber === 1 && !isLastSlide && (
            <div
              style={{
                position: "absolute",
                bottom: 56,
                right: 70,
                width: 68,
                height: 68,
                borderRadius: "50%",
                background: isDark ? "#ffffff" : "#0A0A0A",
                color: isDark ? "#0A0A0A" : "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              →
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default CarouselSlide;
