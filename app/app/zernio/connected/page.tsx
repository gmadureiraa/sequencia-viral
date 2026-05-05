"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { RequireBusiness } from "@/components/app/zernio/require-business";

/**
 * /app/zernio/connected — landing page do redirect_url do Zernio OAuth.
 *
 * O Zernio redireciona o user pra cá depois que ele autoriza no provider.
 * Esta página dispara POST /api/zernio/accounts/sync pra puxar a conta nova
 * e persistir no DB local. Em seguida redireciona pra /app/zernio.
 */

export default function ZernioConnectedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const [status, setStatus] = useState<"syncing" | "done" | "error">("syncing");
  const [error, setError] = useState<string | null>(null);

  const platform = searchParams?.get("platform");

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    (async () => {
      try {
        // v2: sync sem profileId — sincroniza tudo do user. UI principal
        // v2 não tem mais conceito de profile na tela, então redirect
        // direto pra /app/zernio.
        const res = await fetch("/api/zernio/accounts/sync", {
          method: "POST",
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sync falhou.");
        if (cancelled) return;
        setStatus("done");
        setTimeout(() => {
          if (!cancelled) router.replace("/app/zernio");
        }, 1200);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, router]);

  return (
    <RequireBusiness feature="Conectar redes">
    <div style={containerStyle}>
      <div style={cardStyle}>
        {status === "syncing" && (
          <>
            <Loader2 className="animate-spin" size={32} />
            <h2 style={h2Style}>Sincronizando conta {platform ? `(${platform})` : ""}...</h2>
            <p style={pStyle}>
              Estamos puxando a conta que você acabou de autorizar do Zernio.
            </p>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 size={32} color="var(--sv-green, #79c41f)" />
            <h2 style={h2Style}>Conta conectada!</h2>
            <p style={pStyle}>Redirecionando pro profile...</p>
          </>
        )}
        {status === "error" && (
          <>
            <h2 style={{ ...h2Style, color: "#c2410c" }}>Falha no sync</h2>
            <p style={pStyle}>{error}</p>
            <Link href="/app/zernio" style={linkStyle}>
              Voltar e tentar de novo
            </Link>
          </>
        )}
      </div>
    </div>
    </RequireBusiness>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "70vh",
  padding: 24,
  fontFamily: "var(--sv-sans)",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  padding: 32,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "5px 5px 0 0 var(--sv-ink)",
  maxWidth: 420,
  textAlign: "center",
};

const h2Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  margin: 0,
};

const pStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--sv-soft)",
  margin: 0,
};

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--sv-ink)",
  textDecoration: "underline",
};
