/**
 * Renderer server-side de slides Zernio — usado pelo cron Piloto Auto pra
 * capturar PNGs SEM precisar de browser. Reaproveitado pelo endpoint
 * /api/zernio/render-slide pra preview no admin.
 *
 * Por que existe: o flow normal de export do SV (lib/create/use-export.ts)
 * captura slides via `html-to-image` rodando NO BROWSER do user. Cron não
 * tem browser. Soluções consideradas:
 *  - Puppeteer/Playwright server-side: pesado, custos altos no Vercel.
 *  - Browserless.io: dependência externa.
 *  - @vercel/og (next/og): nativo do Next, leve, gera PNG via JSX. ESCOLHIDO.
 *
 * Limitação: `next/og` suporta CSS limitado (sem CSS modules, sem variables
 * customizadas, sem fontes Google fora do allowlist). Por isso o template
 * abaixo é DIFERENTE dos templates do preview (twitter/manifesto/etc) —
 * é um template "Zernio-friendly" minimalista pra autopilot. Pra carrosséis
 * com fidelidade visual ao template do preview, usar agendamento manual.
 *
 * Output: 1080×1350 (formato IG carrossel 4:5, aceito também por LinkedIn).
 */

import { ImageResponse } from "next/og";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

export interface RenderSlideOptions {
  heading: string;
  body: string;
  /** URL pública de imagem opcional. Se omitido, fundo é cor sólida. */
  imageUrl?: string | null;
  slideNumber: number;
  totalSlides: number;
  /** Variant determina layout: cover | text-only | full-photo-bottom | cta. */
  variant?: "cover" | "text-only" | "full-photo-bottom" | "cta" | "headline";
  /** Cor de destaque (hex). Default verde Kaleidos. */
  accentColor?: string;
  /** Nome da marca/profile pra mostrar no rodapé. */
  profileName?: string;
}

const INK = "#0A0A0A";
const PAPER = "#F7F5EF";
const WHITE = "#FFFFFF";
const DEFAULT_ACCENT = "#7CF067"; // verde Kaleidos

/**
 * Renderiza 1 slide → ImageResponse (Response com Content-Type image/png).
 * Caller pode usar `.arrayBuffer()` pra obter o PNG buffer.
 */
export function renderSlideToPng(opts: RenderSlideOptions): ImageResponse {
  const accent = opts.accentColor || DEFAULT_ACCENT;
  const variant = opts.variant ?? "headline";

  const isCover = variant === "cover" || opts.slideNumber === 1;
  const isCta = variant === "cta" || opts.slideNumber === opts.totalSlides;

  // Layout muda com variant. Pra simplificar, 3 layouts principais:
  //  A: full-photo-bottom — imagem cobre 60% inferior, texto no topo
  //  B: text-only         — sem imagem, fundo cor sólida + texto centralizado
  //  C: headline/cover/cta — imagem opcional como fundo blur + texto sobre overlay
  const useFullPhoto = variant === "full-photo-bottom" && opts.imageUrl;

  let content: React.ReactElement;

  if (useFullPhoto && opts.imageUrl) {
    content = (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
        }}
      >
        {/* Topo: texto sobre paper */}
        <div
          style={{
            flex: "0 0 540px",
            padding: "64px 56px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: INK,
              opacity: 0.5,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
            }}
          >
            {opts.slideNumber.toString().padStart(2, "0")} / {opts.totalSlides.toString().padStart(2, "0")}
          </span>
          <h1
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: INK,
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontFamily: "Georgia, serif",
            }}
          >
            {opts.heading}
          </h1>
          <p
            style={{
              fontSize: 28,
              color: INK,
              opacity: 0.85,
              margin: 0,
              lineHeight: 1.35,
            }}
          >
            {opts.body}
          </p>
        </div>
        {/* Imagem cobrindo o resto */}
        <div
          style={{
            flex: 1,
            display: "flex",
            position: "relative",
            background: INK,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={opts.imageUrl}
            alt=""
            width={SLIDE_WIDTH}
            height={810}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      </div>
    );
  } else {
    // Headline/cover/cta/text-only — texto domina
    const showImage = !!opts.imageUrl && !isCta;
    content = (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: isCta ? INK : PAPER,
          color: isCta ? PAPER : INK,
          position: "relative",
        }}
      >
        {/* Background image overlay (cover) */}
        {showImage && opts.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={opts.imageUrl}
              alt=""
              width={SLIDE_WIDTH}
              height={SLIDE_HEIGHT}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.85,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(10, 10, 10, 0.45)",
                display: "flex",
              }}
            />
          </>
        )}

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 56px",
            width: "100%",
            height: "100%",
            color: showImage || isCta ? PAPER : INK,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                opacity: 0.7,
              }}
            >
              {opts.slideNumber.toString().padStart(2, "0")} / {opts.totalSlides.toString().padStart(2, "0")}
            </span>
            {isCover && (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  background: accent,
                  color: INK,
                  padding: "4px 10px",
                  border: `2px solid ${INK}`,
                }}
              >
                Capa
              </span>
            )}
          </div>

          {/* Body */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <h1
              style={{
                fontSize: isCover ? 96 : 72,
                fontWeight: 800,
                margin: 0,
                lineHeight: 1,
                letterSpacing: "-0.025em",
                fontFamily: "Georgia, serif",
                fontStyle: isCover ? "italic" : "normal",
              }}
            >
              {opts.heading}
            </h1>
            <p
              style={{
                fontSize: 32,
                margin: 0,
                lineHeight: 1.35,
                opacity: 0.92,
                maxWidth: 880,
              }}
            >
              {opts.body}
            </p>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {opts.profileName && (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  padding: "10px 18px",
                  border: `2px solid ${showImage || isCta ? PAPER : INK}`,
                  background: showImage || isCta ? "rgba(0,0,0,0.3)" : WHITE,
                  letterSpacing: "0.04em",
                }}
              >
                {opts.profileName}
              </span>
            )}
            {isCta && (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  padding: "10px 18px",
                  background: accent,
                  color: INK,
                  border: `2px solid ${INK}`,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                }}
              >
                Salva o post
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return new ImageResponse(content, {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
  });
}
