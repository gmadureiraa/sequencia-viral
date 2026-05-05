"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
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
import { RequireBusiness } from "@/components/app/zernio/require-business";
import { PlatformConnectCards } from "@/components/app/zernio/platform-connect-cards";

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
  posts: {
    total: number;
    byStatus: Record<string, number>;
    publishedLast7d: number;
  };
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
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "var(--sv-pink, #D262B2)",
  linkedin: "var(--sv-yellow, #F5C518)",
};

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
      toast.error(err instanceof Error ? err.message : "Erro");
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
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "60vh" }}
      >
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const accountByPlatform = (platform: string): Account | undefined =>
    accounts.find((a) => a.platform === platform && a.status === "active");

  return (
    <RequireBusiness
      feature="Conectar redes"
      description="Conecte Instagram + LinkedIn pra publicar carrosséis automaticamente. Disponível só pro plano Business."
    >
    <div
      className="mx-auto px-6 py-8 lg:px-10 lg:py-12"
      style={{ maxWidth: 1100 }}
    >
      {/* HERO */}
      <header className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div style={{ flex: 1, minWidth: 280 }}>
          <span className="sv-eyebrow">
            <span className="sv-dot" /> Nº 02 · Zernio · Suas redes
          </span>
          <h1
            className="sv-display mt-3"
            style={{
              fontSize: "clamp(36px, 5.5vw, 56px)",
              lineHeight: 1.02,
            }}
          >
            Suas <em>redes</em>.
          </h1>
          <p
            className="mt-2"
            style={{
              color: "var(--sv-muted, #555)",
              fontSize: 13.5,
              maxWidth: 540,
            }}
          >
            Conecte Instagram e LinkedIn pra postar carrosséis automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {health && (
            <span
              style={{
                ...healthBadgeStyle,
                background: health.ok ? "var(--sv-green)" : "#C94F3B",
                color: "var(--sv-ink)",
              }}
            >
              {health.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              {health.ok ? "API OK" : "Config faltando"}
            </span>
          )}
          <button
            onClick={fetchAll}
            className="sv-btn sv-btn-outline"
            disabled={loading || syncing}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            onClick={onSync}
            className="sv-btn sv-btn-primary"
            disabled={syncing}
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </header>

      {/* HEALTH WARN */}
      {health && !health.ok && (
        <div
          className="flex items-center gap-2 mb-5 p-3"
          style={{
            background: "rgba(201, 79, 59, 0.08)",
            border: "1.5px solid #C94F3B",
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
            color: "#7a2a1a",
          }}
        >
          <AlertCircle size={14} />
          <span>
            <strong>Setup pendente:</strong> {health.error}. Confere{" "}
            <code>ZERNIO_API_KEY</code> no Vercel.
          </span>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <section
          className="grid gap-3 mb-8"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
        >
          <KpiCard
            label="Agendados"
            value={stats.posts.byStatus.scheduled ?? 0}
            accent="var(--sv-ink)"
          />
          <KpiCard
            label="Publicados 7d"
            value={stats.posts.publishedLast7d}
            accent="var(--sv-green)"
          />
          <KpiCard
            label="Falharam"
            value={stats.posts.byStatus.failed ?? 0}
            accent={(stats.posts.byStatus.failed ?? 0) > 0 ? "#C94F3B" : "var(--sv-muted)"}
          />
          <KpiCard
            label="Auto hoje"
            value={stats.autopilot.runsToday}
            accent="var(--sv-pink)"
          />
        </section>
      )}

      {/* CARDS DE PLATAFORMA — reusa componente também usado em /app/settings */}
      <section className="mb-8">
        {session && <PlatformConnectCards session={session} size="lg" onChange={fetchAll} />}
      </section>

      {/* AÇÕES SECUNDÁRIAS */}
      <section
        className="grid gap-3 mb-8"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
      >
        <ActionCard
          href="/app/zernio/calendar"
          icon={CalendarClock}
          title="Planejamento"
          desc="Calendário visual de tudo que vai pro ar"
          accent="var(--sv-green)"
        />
        <ActionCard
          href="/app/zernio/autopilot"
          icon={Rocket}
          title="Piloto Auto"
          desc="Gatilhos: tempo, RSS, webhook → cria + posta sozinho"
          accent="var(--sv-yellow)"
        />
      </section>

      {/* PRÓXIMOS POSTS */}
      {stats && stats.nextScheduled.length > 0 && (
        <section className="sv-card mb-5" style={{ padding: 22 }}>
          <h2
            className="sv-display flex items-baseline justify-between"
            style={{ fontSize: 20, margin: 0, marginBottom: 14 }}
          >
            Próximos <em>agendados</em>
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
                fontWeight: 700,
              }}
            >
              {stats.nextScheduled.length} {stats.nextScheduled.length === 1 ? "post" : "posts"}
            </span>
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stats.nextScheduled.map((p, i) => {
              const when = new Date(p.scheduled_for).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={p.id}
                  style={{
                    ...postRowStyle,
                    borderBottom:
                      i < stats.nextScheduled.length - 1
                        ? "1px dashed var(--sv-muted, #ccc)"
                        : "none",
                  }}
                >
                  <span style={whenStyle}>{when}</span>
                  <div className="flex gap-1">
                    {p.platforms.map((pl, idx) => (
                      <span
                        key={idx}
                        style={{
                          ...platformChipStyle,
                          background: PLATFORM_COLORS[pl.platform] || "var(--sv-ink)",
                        }}
                      >
                        {pl.platform === "instagram" ? "IG" : "LI"}
                      </span>
                    ))}
                  </div>
                  {p.source === "autopilot" && <span style={autoBadge}>auto</span>}
                  <span style={contentSnippetStyle}>{p.content.slice(0, 80)}...</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* FALHAS RECENTES */}
      {stats && stats.autopilot.recentFailures.length > 0 && (
        <section
          className="sv-card mb-5"
          style={{
            padding: 20,
            background: "rgba(201, 79, 59, 0.04)",
            borderColor: "#C94F3B",
          }}
        >
          <h2
            className="sv-display"
            style={{ fontSize: 18, margin: "0 0 12px", color: "#7a2a1a" }}
          >
            Falhas <em>recentes</em>
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stats.autopilot.recentFailures.slice(0, 3).map((f) => (
              <li key={f.id} style={errorRowStyle}>
                <span style={whenStyle}>
                  {new Date(f.started_at).toLocaleDateString("pt-BR")}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: "#7a2a1a" }}>
                  {f.error?.slice(0, 120) ?? "(sem detalhe)"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </RequireBusiness>
  );
}

// ────────────────────────── COMPONENTES ──────────────────────────

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="sv-card" style={{ padding: 14 }}>
      <div
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--sv-muted, #666)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className="sv-display"
        style={{
          fontSize: 36,
          color: accent,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  desc,
  accent,
}: {
  href: string;
  icon: typeof CalendarClock;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="sv-card flex items-start gap-3"
      style={{
        padding: 16,
        textDecoration: "none",
        color: "var(--sv-ink)",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1.5px solid var(--sv-ink)",
          background: accent,
          boxShadow: "2px 2px 0 0 var(--sv-ink)",
          color: "var(--sv-ink)",
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="sv-display"
          style={{ fontSize: 18, margin: 0, lineHeight: 1.1 }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--sv-muted, #6b6b6b)",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {desc}
        </div>
      </div>
    </Link>
  );
}

// ────────────────────────── STYLES ──────────────────────────

const healthBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "2px 2px 0 0 var(--sv-ink)",
};

const platformIconWrap: React.CSSProperties = {
  width: 56,
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "2px 2px 0 0 var(--sv-ink)",
};

const statusGoodStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "var(--sv-ink)",
  marginTop: 4,
};

const statusOffStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--sv-muted, #555)",
  marginTop: 4,
};

const metaLineStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 10.5,
  letterSpacing: "0.04em",
  color: "var(--sv-muted, #666)",
};

const historyItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 0",
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  color: "var(--sv-muted, #555)",
};

const postRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 0",
};

const errorRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "8px 0",
};

const whenStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 10.5,
  letterSpacing: "0.06em",
  color: "var(--sv-muted, #555)",
  minWidth: 90,
  flexShrink: 0,
};

const platformChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 6px",
  fontFamily: "var(--sv-mono)",
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  border: "1px solid var(--sv-ink)",
  color: "var(--sv-ink)",
};

const autoBadge: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 8.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  padding: "2px 6px",
  background: "var(--sv-pink, #D262B2)",
  color: "var(--sv-ink)",
  border: "1px solid var(--sv-ink)",
};

const contentSnippetStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: "var(--sv-sans)",
  fontSize: 12,
  color: "var(--sv-ink)",
};
