import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Sequência Viral — gerador de carrosséis com IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#FFFDF9",
          padding: 56,
          border: "10px solid #0A0A0A",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "linear-gradient(180deg, #FF8534 0%, #EC6000 100%)",
              border: "4px solid #0A0A0A",
              boxShadow: "8px 8px 0 #0A0A0A",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: "#0A0A0A",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              Sequência Viral
            </span>
            <span style={{ fontSize: 22, color: "#EC6000", fontWeight: 700, marginTop: 8 }}>
              Gerador de carrosséis com IA
            </span>
          </div>
        </div>
        <p
          style={{
            fontSize: 38,
            fontWeight: 600,
            color: "#0A0A0A",
            lineHeight: 1.25,
            maxWidth: 900,
            margin: 0,
          }}
        >
          Três variações por ideia · Branding automático · Instagram, LinkedIn e X
        </p>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 16,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#0A0A0A",
              border: "3px solid #0A0A0A",
              padding: "12px 20px",
              borderRadius: 12,
              background: "#FAFAF8",
              boxShadow: "4px 4px 0 #0A0A0A",
            }}
          >
            sequencia-viral.app
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
