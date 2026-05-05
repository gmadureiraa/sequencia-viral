"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio/[id] — detalhe do profile.
 *
 * Mostra contas conectadas + grid de plataformas pra conectar novas via
 * Zernio OAuth. Também permite ressincronizar (puxa do Zernio + reconcilia
 * com DB local). Toggle "Piloto Auto" controla o flag que o cron lê.
 */

type Platform =
  | "twitter"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "bluesky"
  | "threads"
  | "pinterest"
  | "reddit"
  | "snapchat"
  | "telegram"
  | "googlebusiness";

/** Plataformas exibidas no botão "Conectar". Ordem prioritária:
 *  IG e LinkedIn primeiro porque são os 2 alvos do Piloto Auto / carrosséis.
 *  Outras ficam disponíveis mas marcadas como "extras" — agendamento manual
 *  funciona, mas autopilot ignora.
 */
const PLATFORMS: { id: Platform; label: string; primary: boolean }[] = [
  { id: "instagram", label: "Instagram", primary: true },
  { id: "linkedin", label: "LinkedIn", primary: true },
  { id: "twitter", label: "X / Twitter", primary: false },
  { id: "facebook", label: "Facebook", primary: false },
  { id: "tiktok", label: "TikTok", primary: false },
  { id: "youtube", label: "YouTube", primary: false },
  { id: "threads", label: "Threads", primary: false },
  { id: "bluesky", label: "Bluesky", primary: false },
  { id: "pinterest", label: "Pinterest", primary: false },
  { id: "reddit", label: "Reddit", primary: false },
  { id: "snapchat", label: "Snapchat", primary: false },
  { id: "telegram", label: "Telegram", primary: false },
  { id: "googlebusiness", label: "Google Business", primary: false },
];

interface ZernioProfile {
  id: string;
  zernio_profile_id: string;
  name: string;
  description: string | null;
  autopilot_enabled: boolean;
}

interface ZernioAccount {
  id: string;
  zernio_account_id: string;
  platform: Platform;
  handle: string | null;
  display_name: string | null;
  status: string;
  connected_at: string;
}

export default function ZernioProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const profileId = params.id;
  const { user, session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ZernioProfile | null>(null);
  const [accounts, setAccounts] = useState<ZernioAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<Platform | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) router.replace("/app");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!session || !profileId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/zernio/profiles/${profileId}`, {
        headers: jsonWithAuth(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profile não encontrado.");
      setProfile(data.profile);
      setAccounts(data.accounts || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [session, profileId]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  const onSync = useCallback(async () => {
    if (!session || !profileId) return;
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/zernio/accounts/sync?profileId=${encodeURIComponent(profileId)}`,
        { method: "POST", headers: jsonWithAuth(session) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync falhou.");
      toast.success(
        `Sincronizado: ${data.synced} conta(s), ${data.disconnected} desconectada(s).`
      );
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no sync.");
    } finally {
      setSyncing(false);
    }
  }, [session, profileId, fetchData]);

  const onConnect = useCallback(
    async (platform: Platform) => {
      if (!session || !profileId) return;
      setConnecting(platform);
      try {
        const res = await fetch(
          `/api/zernio/connect/${platform}?profileId=${encodeURIComponent(profileId)}`,
          { headers: jsonWithAuth(session) }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao iniciar OAuth.");
        // Abre Zernio OAuth em nova aba — quando user volta, página /connected
        // recebe o redirect e chama sync.
        window.open(data.authUrl, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao conectar.");
      } finally {
        setConnecting(null);
      }
    },
    [session, profileId]
  );

  if (authLoading || !user) {
    return (
      <div style={containerStyle}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={containerStyle}>
        <p>Profile não encontrado.</p>
        <Link href="/app/admin/zernio">← voltar</Link>
      </div>
    );
  }

  const activeAccounts = accounts.filter((a) => a.status === "active");
  const connectedPlatforms = new Set(activeAccounts.map((a) => a.platform));

  return (
    <div style={containerStyle}>
      <Link href="/app/admin/zernio" style={backLinkStyle}>
        <ArrowLeft size={14} /> Profiles
      </Link>

      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>{profile.name}</h1>
          {profile.description && <p style={subtitleStyle}>{profile.description}</p>}
        </div>
        <button onClick={onSync} style={btnGhost} disabled={syncing}>
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          Sincronizar
        </button>
      </header>

      <section style={cardStyle}>
        <h2 style={h2Style}>Contas conectadas ({activeAccounts.length})</h2>
        {activeAccounts.length === 0 ? (
          <p style={{ color: "var(--sv-soft)", marginTop: 8 }}>
            Nenhuma conta. Conecta uma plataforma abaixo.
          </p>
        ) : (
          <ul style={listStyle}>
            {activeAccounts.map((a) => (
              <li key={a.id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ textTransform: "capitalize" }}>{a.platform}</strong>
                  {" · "}
                  <span>{a.handle ? `@${a.handle}` : a.display_name || "—"}</span>
                  <div style={{ fontSize: 11, color: "var(--sv-soft)", marginTop: 2 }}>
                    Conectado em {new Date(a.connected_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span style={statusBadge(a.status)}>{a.status}</span>
              </li>
            ))}
          </ul>
        )}

        {accounts.some((a) => a.status !== "active") && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--sv-soft)" }}>
              Histórico ({accounts.filter((a) => a.status !== "active").length} desconectadas)
            </summary>
            <ul style={listStyle}>
              {accounts
                .filter((a) => a.status !== "active")
                .map((a) => (
                  <li key={a.id} style={{ ...rowStyle, opacity: 0.55 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Unplug size={12} style={{ display: "inline", marginRight: 6 }} />
                      <strong style={{ textTransform: "capitalize" }}>{a.platform}</strong>
                      {" · "}
                      <span>{a.handle ? `@${a.handle}` : a.display_name || "—"}</span>
                    </div>
                    <span style={statusBadge(a.status)}>{a.status}</span>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>Conectar plataforma</h2>
        <p style={{ fontSize: 12, color: "var(--sv-soft)", margin: "4px 0 12px" }}>
          Cada botão abre o OAuth do Zernio em nova aba. Volta aqui e clica
          &quot;Sincronizar&quot; quando autorizar. <strong>Instagram</strong> e{" "}
          <strong>LinkedIn</strong> são as únicas plataformas que o Piloto Auto
          usa hoje (carrossel com mídia).
        </p>
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sv-soft)" }}>
          Foco do Piloto Auto
        </div>
        <div style={gridStyle}>
          {PLATFORMS.filter((p) => p.primary).map((p) => {
            const already = connectedPlatforms.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onConnect(p.id)}
                disabled={connecting === p.id}
                style={{
                  ...platformBtn,
                  background: "var(--sv-ink)",
                  color: "var(--sv-paper)",
                  opacity: already ? 0.55 : 1,
                }}
                title={already ? "Já tem 1+ conta dessa plataforma. Pode conectar outra." : undefined}
              >
                {connecting === p.id ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Plug size={14} />
                )}
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sv-soft)" }}>
            Outras plataformas (agendamento manual)
          </summary>
          <div style={{ ...gridStyle, marginTop: 8 }}>
            {PLATFORMS.filter((p) => !p.primary).map((p) => {
              const already = connectedPlatforms.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => onConnect(p.id)}
                  disabled={connecting === p.id}
                  style={{
                    ...platformBtn,
                    opacity: already ? 0.5 : 1,
                  }}
                  title={already ? "Já tem 1+ conta dessa plataforma. Pode conectar outra." : undefined}
                >
                  {connecting === p.id ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Plug size={14} />
                  )}
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </details>
      </section>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 800,
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

const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
};

const cardStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  padding: 16,
  marginBottom: 16,
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

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  border: "1px solid var(--sv-soft)",
  background: "var(--sv-paper, #faf7f2)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 8,
};

const platformBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 12px",
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

function statusBadge(status: string): React.CSSProperties {
  const isActive = status === "active";
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "2px 6px",
    background: isActive ? "var(--sv-green, #b7d96b)" : "var(--sv-soft)",
    color: "var(--sv-ink)",
    textTransform: "uppercase",
  };
}
