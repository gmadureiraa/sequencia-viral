"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Image as ImageIcon,
  Instagram,
  Linkedin,
  Loader2,
  Plug,
  RefreshCw,
  Rocket,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio (v2) — UX simplificada.
 *
 * Modelo: 1 IG + 1 LinkedIn por user. Profile Zernio interno é
 * auto-criado na primeira conexão. UI esconde esse detalhe e mostra
 * apenas 2 cards de plataforma com status conectado/desconectado.
 *
 * Topo: stats overview (KPIs) + health.
 * Meio: 2 cards de conexão.
 * Rodapé: links pra Calendário, Piloto Auto (Triggers), Preview slide.
 */

type AccountStatus = "active" | "disconnected" | "needs_reauth";

interface Account {
  id: string;
  zernio_account_id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  status: AccountStatus;
  connected_at: string;
}

interface Stats {
  posts: { total: number; byStatus: Record<string, number>; publishedLast7d: number };
  nextScheduled: Array<{
    id: string;
    content: string;
    scheduled_for: string;
    platforms: { platform: string }[];
    source: string;
  }>;
  autopilot: {
    runsToday: number;
    recentFailures: Array<{ id: string; error: string; started_at: string }>;
  };
}

const FOCUS_PLATFORMS = ["instagram", "linkedin"] as const;

export default function ZernioAdminV2Page() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [health, setHealth] = useState<
    { ok: true; profilesCount?: number } | { ok: false; error: string } | null
  >(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) router.replace("/app");
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [aRes, sRes, hRes] = await Promise.all([
        fetch("/api/zernio/accounts", { headers: jsonWithAuth(session) }),
        fetch("/api/zernio/stats", { headers: jsonWithAuth(session) }),
        fetch("/api/zernio/health", { headers: jsonWithAuth(session) }),
      ]);
      if (aRes.ok) setAccounts((await aRes.json()).accounts || []);
      if (sRes.ok) setStats(await sRes.json());
      if (hRes.ok) setHealth(await hRes.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchAll();
  }, [session, fetchAll]);

  const onConnect = useCallback(
    async (platform: string) => {
      if (!session) return;
      setConnecting(platform);
      try {
        const res = await fetch(`/api/zernio/connect/${platform}`, {
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        window.open(data.authUrl, "_blank", "noopener,noreferrer");
        toast.info("Autorize na nova aba e clique em Sincronizar.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setConnecting(null);
      }
    },
    [session]
  );

  const onSync = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/zernio/accounts/sync", {
        method: "POST",
        headers: jsonWithAuth(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      toast.success(
        `${data.synced} conta(s) sincronizada(s)${data.disconnected > 0 ? `, ${data.disconnected} desconectada(s)` : ""}.`
      );
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSyncing(false);
    }
  }, [session, fetchAll]);

  if (authLoading || !user) {
    return (
      <div style={containerStyle}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  // Account active de cada plataforma focal (se existir)
  const accountByPlatform = (platform: string): Account | undefined =>
    accounts.find((a) => a.platform === platform && a.status === "active");

  return (
    <div style={containerStyle}>
      {/* HERO */}
      <header style={heroStyle}>
        <div style={heroLeft}>
          <span style={kickerStyle}>Nº 00 · Zernio · Admin</span>
          <h1 style={titleStyle}>
            Suas <em>redes</em>.
          </h1>
          <p style={subtitleStyle}>
            Conecte Instagram e LinkedIn pra postar carrosséis automaticamente.
          </p>
        </div>
        <div style={heroRight}>
          {health && (
            <span style={health.ok ? badgeOk : badgeErr}>
              {health.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              {health.ok ? "API OK" : "Config faltando"}
            </span>
          )}
          <button onClick={fetchAll} style={btnGhost} disabled={loading || syncing}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button onClick={onSync} style={btnPrimary} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Sincronizar contas"}
          </button>
        </div>
      </header>

      {/* HEALTH WARN */}
      {health && !health.ok && (
        <div style={configWarnStyle}>
          <AlertCircle size={14} />
          <span>
            <strong>Setup pendente:</strong> {health.error}. Confere{" "}
            <code>ZERNIO_API_KEY</code> no Vercel.
          </span>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <section style={kpiGridStyle}>
          <Tile label="Agendados" value={stats.posts.byStatus.scheduled ?? 0} accent="#3b82f6" />
          <Tile
            label="Publicados (7d)"
            value={stats.posts.publishedLast7d}
            accent="#10b981"
          />
          <Tile
            label="Falharam"
            value={stats.posts.byStatus.failed ?? 0}
            accent={(stats.posts.byStatus.failed ?? 0) > 0 ? "#ef4444" : "#9ca3af"}
          />
          <Tile
            label="Auto hoje"
            value={stats.autopilot.runsToday}
            accent="#a855f7"
          />
        </section>
      )}

      {/* CARDS DE PLATAFORMA */}
      <section style={platformsGridStyle}>
        {FOCUS_PLATFORMS.map((platform) => {
          const account = accountByPlatform(platform);
          const isConnected = !!account;
          const Icon = platform === "instagram" ? Instagram : Linkedin;
          const accent = platform === "instagram" ? "#E4405F" : "#0A66C2";
          return (
            <article
              key={platform}
              style={{
                ...platformCardStyle,
                borderColor: isConnected ? accent : "var(--sv-ink)",
              }}
            >
              <div style={platformHeaderStyle}>
                <div
                  style={{
                    ...platformIconWrap,
                    background: isConnected ? accent : "var(--sv-paper, #faf7f2)",
                    color: isConnected ? "#fff" : "var(--sv-ink)",
                  }}
                >
                  <Icon size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={platformNameStyle}>
                    {platform === "instagram" ? "Instagram" : "LinkedIn"}
                  </h3>
                  {isConnected ? (
                    <div style={statusGoodStyle}>
                      <CheckCircle2 size={12} /> Conectado · @
                      {account?.handle ?? account?.display_name ?? "—"}
                    </div>
                  ) : (
                    <div style={statusOffStyle}>
                      <Plug size={12} /> Não conectado
                    </div>
                  )}
                </div>
              </div>

              {isConnected ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={metaLineStyle}>
                    Conectado em{" "}
                    {new Date(account!.connected_at).toLocaleDateString("pt-BR")}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => onConnect(platform)}
                      style={btnGhostFullSmall}
                      disabled={connecting === platform}
                    >
                      {connecting === platform ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Reconectar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onConnect(platform)}
                  style={{
                    ...btnConnectPrimary,
                    background: accent,
                  }}
                  disabled={connecting === platform}
                >
                  {connecting === platform ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plug size={14} />
                  )}
                  Conectar {platform === "instagram" ? "Instagram" : "LinkedIn"}
                </button>
              )}

              {/* Histórico de desconectadas dessa plataforma */}
              {accounts.filter((a) => a.platform === platform && a.status !== "active").length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary style={historyToggle}>
                    Histórico (
                    {accounts.filter((a) => a.platform === platform && a.status !== "active").length}
                    )
                  </summary>
                  <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                    {accounts
                      .filter((a) => a.platform === platform && a.status !== "active")
                      .map((a) => (
                        <li key={a.id} style={historyItemStyle}>
                          <Unplug size={11} />
                          <span>@{a.handle ?? "—"}</span>
                          <span style={{ color: "var(--sv-soft)", fontSize: 10 }}>
                            ({a.status})
                          </span>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </section>

      {/* AÇÕES SECUNDÁRIAS */}
      <section style={actionGridStyle}>
        <Link href="/app/admin/zernio/calendar" style={actionCardStyle}>
          <CalendarClock size={20} />
          <div>
            <div style={actionTitleStyle}>Planejamento</div>
            <div style={actionDescStyle}>Calendário visual de tudo que vai pro ar</div>
          </div>
        </Link>
        <Link href="/app/admin/zernio/autopilot" style={actionCardStyle}>
          <Rocket size={20} />
          <div>
            <div style={actionTitleStyle}>Piloto Auto</div>
            <div style={actionDescStyle}>
              Gatilhos: tempo, RSS feed, webhook → cria + posta sozinho
            </div>
          </div>
        </Link>
        <Link href="/app/admin/zernio/preview-slide" style={actionCardStyle}>
          <ImageIcon size={20} />
          <div>
            <div style={actionTitleStyle}>Preview de slide</div>
            <div style={actionDescStyle}>Ajustar template antes de criar gatilhos</div>
          </div>
        </Link>
      </section>

      {/* PRÓXIMOS POSTS */}
      {stats && stats.nextScheduled.length > 0 && (
        <section style={cardStyle}>
          <h2 style={h2Style}>Próximos agendados</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {stats.nextScheduled.map((p) => {
              const when = new Date(p.scheduled_for).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li key={p.id} style={postRowStyle}>
                  <span style={whenStyle}>{when}</span>
                  <span style={platformsListStyle}>
                    {p.platforms.map((pl) => pl.platform).join(", ")}
                  </span>
                  {p.source === "autopilot" && <span style={autoBadge}>auto</span>}
                  <span style={contentSnippetStyle}>{p.content.slice(0, 70)}...</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* FALHAS RECENTES */}
      {stats && stats.autopilot.recentFailures.length > 0 && (
        <section style={{ ...cardStyle, borderColor: "#ef4444" }}>
          <h2 style={{ ...h2Style, color: "#7f1d1d" }}>
            Falhas recentes do Piloto Auto
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {stats.autopilot.recentFailures.slice(0, 3).map((f) => (
              <li key={f.id} style={errorRowStyle}>
                <span style={whenStyle}>
                  {new Date(f.started_at).toLocaleDateString("pt-BR")}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: "#7f1d1d" }}>
                  {f.error?.slice(0, 120) ?? "(sem detalhe)"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div style={tileStyle}>
      <div style={tileLabelStyle}>{label}</div>
      <div style={{ ...tileValueStyle, color: accent }}>{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: 24,
  fontFamily: "var(--sv-sans)",
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 24,
  marginBottom: 28,
  flexWrap: "wrap",
};

const heroLeft: React.CSSProperties = { flex: 1, minWidth: 280 };
const heroRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const kickerStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--sv-soft, #6b6b6b)",
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  fontSize: "clamp(36px, 6vw, 56px)",
  fontWeight: 800,
  margin: "10px 0 4px",
  letterSpacing: "-0.025em",
  lineHeight: 1.02,
  fontFamily: "var(--sv-display, Georgia, serif)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--sv-muted, #555)",
  margin: 0,
  maxWidth: 480,
};

const badgeOk: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#fff",
  background: "#10b981",
  borderRadius: 2,
};

const badgeErr: React.CSSProperties = { ...badgeOk, background: "#ef4444" };

const configWarnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 12,
  marginBottom: 20,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1.5px solid #ef4444",
  fontSize: 13,
  color: "#7f1d1d",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginBottom: 24,
};

const tileStyle: React.CSSProperties = {
  padding: 16,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
};

const tileLabelStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--sv-soft, #6b6b6b)",
  fontWeight: 700,
};

const tileValueStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  marginTop: 6,
  lineHeight: 1,
};

const platformsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const platformCardStyle: React.CSSProperties = {
  padding: 22,
  background: "var(--sv-white)",
  border: "1.5px solid",
  boxShadow: "5px 5px 0 0 var(--sv-ink)",
  display: "flex",
  flexDirection: "column",
};

const platformHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginBottom: 18,
};

const platformIconWrap: React.CSSProperties = {
  width: 52,
  height: 52,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1.5px solid var(--sv-ink)",
};

const platformNameStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  margin: 0,
  letterSpacing: "-0.01em",
};

const statusGoodStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "#10b981",
  marginTop: 4,
};

const statusOffStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--sv-soft, #6b6b6b)",
  marginTop: 4,
};

const metaLineStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--sv-soft, #888)",
};

const btnConnectPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  padding: "12px 16px",
  background: "var(--sv-ink)",
  color: "#fff",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.04em",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: "var(--sv-ink)",
  color: "#fff",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const btnGhostFullSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "8px 12px",
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 11,
  cursor: "pointer",
  flex: 1,
};

const historyToggle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--sv-soft, #6b6b6b)",
};

const historyItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 0",
  fontSize: 11,
  color: "var(--sv-soft, #6b6b6b)",
};

const actionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginBottom: 24,
};

const actionCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 16,
  background: "var(--sv-paper, #faf7f2)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  textDecoration: "none",
  color: "var(--sv-ink)",
  transition: "transform 0.12s, box-shadow 0.12s",
};

const actionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: "-0.01em",
  marginBottom: 2,
};

const actionDescStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: "var(--sv-soft, #6b6b6b)",
};

const cardStyle: React.CSSProperties = {
  padding: 18,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  marginBottom: 16,
};

const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
};

const postRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 0",
  fontSize: 12,
  borderBottom: "1px dashed var(--sv-soft, #ddd)",
};

const errorRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "8px 0",
  fontSize: 12,
  borderBottom: "1px dashed rgba(239,68,68,0.2)",
};

const whenStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 10.5,
  letterSpacing: "0.04em",
  color: "var(--sv-soft, #6b6b6b)",
  minWidth: 82,
  flexShrink: 0,
};

const platformsListStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "capitalize",
};

const autoBadge: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "1px 5px",
  background: "#a855f7",
  color: "#fff",
};

const contentSnippetStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--sv-ink)",
};
