"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio/connected — landing page do redirect_url do Zernio OAuth.
 *
 * O Zernio redireciona o user pra cá depois que ele autoriza no provider
 * (Twitter, LinkedIn, etc.). Esta página dispara um POST /api/zernio/accounts/sync
 * pra puxar a conta nova do Zernio e persistir no DB local. Em seguida
 * redireciona pro detalhe do profile.
 */

export default function ZernioConnectedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"syncing" | "done" | "error">("syncing");
  const [error, setError] = useState<string | null>(null);

  const profileId = searchParams?.get("profileId");
  const platform = searchParams?.get("platform");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) router.replace("/app");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!session || !profileId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/zernio/accounts/sync?profileId=${encodeURIComponent(profileId)}`,
          { method: "POST", headers: jsonWithAuth(session) }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sync falhou.");
        if (cancelled) return;
        setStatus("done");
        // Pequeno delay pro user ver "conectado" antes do redirect.
        setTimeout(() => {
          if (!cancelled) router.replace(`/app/admin/zernio/${profileId}`);
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
  }, [session, profileId, router]);

  return (
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
            <Link
              href={profileId ? `/app/admin/zernio/${profileId}` : "/app/admin/zernio"}
              style={linkStyle}
            >
              Voltar ao profile e tentar de novo
            </Link>
          </>
        )}
      </div>
    </div>
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
