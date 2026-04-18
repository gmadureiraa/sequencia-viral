"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    posthog.captureException(error, { digest: error.digest });
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#FFFDF9",
          color: "#0A0A0A",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#FF5842",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              margin: "0 auto 1.25rem",
              border: "2px solid #0A0A0A",
              boxShadow: "4px 4px 0 0 #0A0A0A",
            }}
          >
            !
          </div>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "2rem",
              margin: "0 0 0.5rem",
              lineHeight: 1.1,
            }}
          >
            Deu erro no app inteiro.
          </h1>
          <p style={{ color: "#666", margin: "0 0 1.25rem" }}>
            A gente já foi avisado. Clique abaixo pra tentar carregar de novo.
          </p>
          <button
            onClick={reset}
            style={{
              border: "2px solid #0A0A0A",
              background: "#FF5842",
              color: "#fff",
              padding: "0.75rem 1.25rem",
              borderRadius: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "4px 4px 0 0 #0A0A0A",
            }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
