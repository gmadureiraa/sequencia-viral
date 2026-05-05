"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio/preview-slide
 *
 * Página de teste pro renderer server-side de slides usado pelo Piloto Auto.
 * Admin edita campos em tempo real e vê o PNG renderizado via /api/zernio/render-slide.
 *
 * Útil pra debug do template antes de criar recipes — autopilot V1 usa um
 * template simplificado (não os do preview do carrossel), e essa página
 * mostra exatamente o que vai pro IG/LinkedIn.
 */

type Variant = "cover" | "headline" | "full-photo-bottom" | "text-only" | "cta";

export default function ZernioPreviewSlidePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [heading, setHeading] = useState("Por que carrossel ainda performa em 2026");
  const [body, setBody] = useState(
    "Algoritmo prioriza conteúdo que segura atenção. Carrossel força swipe e tempo de retenção mais alto que post estático."
  );
  const [variant, setVariant] = useState<Variant>("cover");
  const [slideNumber, setSlideNumber] = useState(1);
  const [totalSlides, setTotalSlides] = useState(8);
  const [imageUrl, setImageUrl] = useState("");
  const [profileName, setProfileName] = useState("Madureira");
  const [accentColor, setAccentColor] = useState("#7CF067");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) router.replace("/app");
  }, [user, authLoading, router]);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("heading", heading);
    params.set("body", body);
    params.set("slideNumber", String(slideNumber));
    params.set("totalSlides", String(totalSlides));
    params.set("variant", variant);
    if (imageUrl) params.set("imageUrl", imageUrl);
    if (profileName) params.set("profileName", profileName);
    if (accentColor) params.set("accentColor", accentColor);
    params.set("_t", String(refreshKey));
    return `/api/zernio/render-slide?${params.toString()}`;
  }, [heading, body, slideNumber, totalSlides, variant, imageUrl, profileName, accentColor, refreshKey]);

  if (authLoading || !user) {
    return (
      <div style={containerStyle}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Link href="/app/admin/zernio" style={backLinkStyle}>
        <ArrowLeft size={14} /> Profiles
      </Link>

      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Preview do slide</h1>
          <p style={subtitleStyle}>
            Edita os campos e vê o PNG que o Piloto Auto vai gerar pra IG/LinkedIn.
          </p>
        </div>
        <button onClick={() => setRefreshKey((k) => k + 1)} style={btnGhost}>
          <RefreshCw size={14} /> Re-render
        </button>
      </header>

      <div style={layoutStyle}>
        <section style={controlsStyle}>
          <div>
            <label style={labelStyle}>Heading</label>
            <textarea
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              rows={2}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Variant</label>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as Variant)}
              style={inputStyle}
            >
              <option value="cover">Cover (capa)</option>
              <option value="headline">Headline</option>
              <option value="full-photo-bottom">Full photo bottom</option>
              <option value="text-only">Text only</option>
              <option value="cta">CTA (último)</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Slide #</label>
              <input
                type="number"
                min={1}
                value={slideNumber}
                onChange={(e) => setSlideNumber(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Total slides</label>
              <input
                type="number"
                min={1}
                value={totalSlides}
                onChange={(e) => setTotalSlides(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Imagem URL (opcional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Profile name (footer)</label>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Accent color</label>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{ ...inputStyle, padding: 2, height: 38 }}
              />
            </div>
          </div>
        </section>

        <aside style={previewWrapStyle}>
          <div style={previewBoxStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <p style={{ fontSize: 11, color: "var(--sv-soft)", marginTop: 6 }}>
            1080×1350 (4:5) — formato IG carrossel + LinkedIn
          </p>
        </aside>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: 24,
  fontFamily: "var(--sv-sans)",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--sv-soft)",
  textDecoration: "none",
  marginBottom: 12,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 20,
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  margin: 0,
  letterSpacing: "-0.02em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--sv-soft)",
  margin: "4px 0 0",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 360px",
  gap: 16,
  alignItems: "start",
};

const controlsStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  padding: 16,
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
};

const previewWrapStyle: React.CSSProperties = {
  position: "sticky",
  top: 16,
};

const previewBoxStyle: React.CSSProperties = {
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  background: "#000",
  overflow: "hidden",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
  color: "var(--sv-ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  border: "1.5px solid var(--sv-ink)",
  fontSize: 13,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  fontFamily: "var(--sv-sans)",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};
