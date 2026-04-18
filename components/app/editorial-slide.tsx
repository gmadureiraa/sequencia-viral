"use client";

import { forwardRef } from "react";
import type { SlideProps } from "./carousel-slide";
import { EDITORIAL_THREAD_FIXED_FONT_STACK } from "@/lib/editorial-fonts";

/**
 * Slide 1080×1350 — formato thread (Twitter/X): avatar, nome, texto, imagem.
 * Tipografia fixa (Helvetica stack), acento laranja.
 */

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const ACCENT = "#FF5500";

function renderRichText(text: string, accent: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 800, color: accent }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const EditorialSlide = forwardRef<HTMLDivElement, SlideProps>(
  function EditorialSlide(
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
    const bg = isDark ? "#121212" : "#fafafa";
    const fg = isDark ? "#f5f5f5" : "#0a0a0a";
    const muted = isDark ? "#9ca3af" : "#6b7280";
    const cardBg = isDark ? "#1a1a1a" : "#ffffff";
    const borderCard = isDark ? "#2a2a2a" : "#e5e7eb";

    const titleStack = EDITORIAL_THREAD_FIXED_FONT_STACK;
    const bodyStack = EDITORIAL_THREAD_FIXED_FONT_STACK;
    const accent = ACCENT;
    const progress = totalSlides > 0 ? slideNumber / totalSlides : 1;

    const shellStyle: React.CSSProperties = {
      position: "absolute",
      top: 0,
      left: 0,
      width: CANVAS_W,
      height: CANVAS_H,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      background: bg,
      color: fg,
      borderRadius: 36,
      display: "flex",
      flexDirection: "column",
      fontFamily: bodyStack,
      overflow: "hidden",
      boxSizing: "border-box",
      border: `1px solid ${isDark ? "#2a2a2a" : "#e7e5e4"}`,
      boxShadow: isDark
        ? "0 24px 80px rgba(0,0,0,0.45)"
        : "0 20px 60px rgba(0,0,0,0.08)",
    };

    return (
      <div
        className="flex-shrink-0"
        style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          position: "relative",
          overflow: "hidden",
          borderRadius: 36 * scale,
        }}
      >
        <div
          ref={ref}
          style={{
            ...shellStyle,
            padding: "48px 52px 40px",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: isDark ? "#2a2a2a" : "#e5e7eb",
              borderRadius: "36px 36px 0 0",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${accent}, #ff7a3d)`,
                borderRadius: 4,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 28,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${accent}, #cc4400)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 36,
                fontWeight: 800,
                overflow: "hidden",
                flexShrink: 0,
                border: `3px solid ${isDark ? "#2a2a2a" : "#fff"}`,
                boxShadow: "0 8px 24px rgba(255,85,0,0.25)",
              }}
            >
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: bodyStack,
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: fg,
                  lineHeight: 1.15,
                }}
              >
                {profile.name}
              </div>
              <div
                style={{
                  fontFamily: bodyStack,
                  fontSize: 26,
                  color: muted,
                  marginTop: 4,
                  fontWeight: 500,
                }}
              >
                {profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`}
              </div>
            </div>
            <div
              style={{
                fontFamily: bodyStack,
                fontSize: 22,
                color: muted,
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              {String(slideNumber).padStart(2, "0")}/{String(totalSlides).padStart(2, "0")}
            </div>
          </div>

          <div
            style={{
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <h2
              style={{
                fontFamily: titleStack,
                fontSize: 40,
                fontWeight: 600,
                lineHeight: 1.2,
                margin: 0,
                letterSpacing: "-0.02em",
                color: fg,
              }}
            >
              {renderRichText(heading, accent)}
            </h2>
            <p
              style={{
                fontFamily: bodyStack,
                fontSize: 30,
                lineHeight: 1.45,
                color: isDark ? "#d1d5db" : "#374151",
                margin: 0,
                whiteSpace: "pre-line",
                fontWeight: 450,
              }}
            >
              {renderRichText(body, accent)}
            </p>

            {imageUrl ? (
              <div
                style={{
                  flex: "1 1 auto",
                  minHeight: 0,
                  marginTop: 8,
                  borderRadius: 16,
                  overflow: "hidden",
                  background: cardBg,
                  border: `1px solid ${borderCard}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    maxHeight: 520,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            ) : null}
          </div>

          <div
            style={{
              marginTop: "auto",
              paddingTop: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              gap: 16,
            }}
          >
            {showFooter && slideNumber === 1 ? (
              <span
                style={{
                  fontFamily: bodyStack,
                  fontSize: 20,
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                }}
              >
                Sequência Viral
              </span>
            ) : (
              <span style={{ fontSize: 20, color: muted }} />
            )}
            {!isLastSlide ? (
              <span
                style={{
                  fontFamily: bodyStack,
                  fontSize: 22,
                  color: muted,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Arraste para o lado
                <span style={{ fontSize: 26 }}>→</span>
              </span>
            ) : (
              <span style={{ fontSize: 20, color: muted }} />
            )}
          </div>

          {isLastSlide ? (
            <div
              style={{
                fontFamily: bodyStack,
                marginTop: 16,
                padding: "20px 28px",
                borderRadius: 14,
                background: `linear-gradient(135deg, ${accent}, #e64a00)`,
                color: "#fff",
                fontSize: 28,
                fontWeight: 800,
                textAlign: "center",
                letterSpacing: "-0.02em",
              }}
            >
              Salve este carrossel para aplicar no próximo post.
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);

export default EditorialSlide;
