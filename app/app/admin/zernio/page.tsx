"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio — lista profiles Zernio do admin + criar novo.
 *
 * Cada profile = container/marca (ex: "Madureira", "Defiverso"). Dentro
 * de cada profile o admin conecta as contas sociais (Twitter, IG, etc.)
 * que pertencem àquela marca.
 */

interface ZernioProfile {
  id: string;
  zernio_profile_id: string;
  name: string;
  description: string | null;
  autopilot_enabled: boolean;
  created_at: string;
}

export default function ZernioAdminPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<ZernioProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [health, setHealth] = useState<
    { ok: true; profilesCount?: number } | { ok: false; error: string } | null
  >(null);
  const [stats, setStats] = useState<{
    profiles: number;
    accounts: { active: number; disconnected: number };
    posts: {
      total: number;
      byStatus: Record<string, number>;
      publishedLast7d: number;
    };
    nextScheduled: Array<{
      id: string;
      profile_id: string;
      content: string;
      scheduled_for: string;
      platforms: { platform: string }[];
      source: string;
    }>;
    autopilot: {
      runsToday: number;
      recentFailures: Array<{
        id: string;
        recipe_id: string;
        error: string;
        started_at: string;
      }>;
    };
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) {
      router.replace("/app");
    }
  }, [user, authLoading, router]);

  const fetchProfiles = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/zernio/profiles", {
        headers: jsonWithAuth(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao listar.");
      setProfiles(data.profiles || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao listar profiles.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchProfiles();
  }, [session, fetchProfiles]);

  // Health check — paralelo ao fetch dos profiles. Falha não bloqueia UX.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/zernio/health", { headers: jsonWithAuth(session) });
        const data = await res.json();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth({ ok: false, error: "Falha ao verificar health" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Stats agregados pro card de overview. Recarrega quando profiles mudam
  // (cria/deleta profile invalida contagem).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/zernio/stats", { headers: jsonWithAuth(session) });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setStats(data);
        }
      } catch {
        // Falha silenciosa — stats é nice-to-have, não crítico
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, profiles.length]);

  const onCreate = useCallback(async () => {
    if (!session) return;
    if (name.trim().length < 2) {
      toast.error("Nome precisa ter pelo menos 2 chars.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/zernio/profiles", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar.");
      toast.success(`Profile "${data.profile.name}" criado.`);
      setName("");
      setDescription("");
      await fetchProfiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar profile.");
    } finally {
      setCreating(false);
    }
  }, [session, name, description, fetchProfiles]);

  const onDelete = useCallback(
    async (id: string) => {
      if (!session) return;
      if (!confirm("Arquivar esse profile? Contas conectadas vão pra desconectado.")) return;
      try {
        const res = await fetch(`/api/zernio/profiles/${id}`, {
          method: "DELETE",
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao arquivar.");
        toast.success("Profile arquivado.");
        await fetchProfiles();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao arquivar.");
      }
    },
    [session, fetchProfiles]
  );

  if (authLoading || !user) {
    return (
      <div style={containerStyle}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={titleStyle}>Zernio</h1>
            {health && (
              <span
                style={{
                  ...healthBadge,
                  background: health.ok ? "#10b981" : "#ef4444",
                }}
                title={health.ok ? `${health.profilesCount ?? "?"} profiles no Zernio` : health.error}
              >
                {health.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                {health.ok ? "API OK" : "Config faltando"}
              </span>
            )}
          </div>
          <p style={subtitleStyle}>
            Profiles agrupam contas sociais por marca. 1 profile por cliente.
          </p>
          {health && !health.ok && (
            <div style={configWarn}>
              <AlertCircle size={13} />
              <span>
                <strong>Setup pendente:</strong> {health.error}. Confere{" "}
                <code>ZERNIO_API_KEY</code> nas env vars do Vercel.
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/app/admin/zernio/autopilot" style={btnGhost}>
            Piloto Auto
          </Link>
          <Link href="/app/admin/zernio/calendar" style={btnGhost}>
            Calendário
          </Link>
          <Link href="/app/admin/zernio/preview-slide" style={btnGhost}>
            Preview slide
          </Link>
          <button onClick={fetchProfiles} style={btnGhost} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </header>

      {stats && (
        <section style={statsCardStyle}>
          <h2 style={h2Style}>Visão geral</h2>
          <div style={statsGridStyle}>
            <StatTile
              label="Profiles"
              value={stats.profiles}
              hint={`${stats.accounts.active} contas ativas`}
              accent="#3b82f6"
            />
            <StatTile
              label="Agendados"
              value={stats.posts.byStatus.scheduled ?? 0}
              hint={`${stats.posts.total} total`}
              accent="#7CF067"
            />
            <StatTile
              label="Publicados (7d)"
              value={stats.posts.publishedLast7d}
              hint={`${stats.posts.byStatus.published ?? 0} histórico`}
              accent="#10b981"
            />
            <StatTile
              label="Falharam"
              value={stats.posts.byStatus.failed ?? 0}
              hint={`${stats.posts.byStatus.cancelled ?? 0} cancelados`}
              accent="#ef4444"
            />
            <StatTile
              label="Autopilot hoje"
              value={stats.autopilot.runsToday}
              hint={`${stats.autopilot.recentFailures.length} falhas recentes`}
              accent="#a855f7"
            />
            <StatTile
              label="Contas off"
              value={stats.accounts.disconnected}
              hint={
                stats.accounts.disconnected > 0
                  ? "Reconectar urgente"
                  : "Tudo OK"
              }
              accent={stats.accounts.disconnected > 0 ? "#ef4444" : "#9ca3af"}
            />
          </div>

          {/* Próximos agendados */}
          {stats.nextScheduled.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={statsSubLabel}>Próximos agendados</div>
              <ul style={statsListStyle}>
                {stats.nextScheduled.map((p) => {
                  const profile = profiles.find((pr) => pr.id === p.profile_id);
                  const when = new Date(p.scheduled_for).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li key={p.id} style={statsListItem}>
                      <span style={{ fontSize: 11, color: "var(--sv-soft)", minWidth: 90 }}>
                        {when}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        {profile?.name ?? "—"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--sv-soft)" }}>
                        {p.platforms.map((pl) => pl.platform).join(", ")}
                      </span>
                      {p.source === "autopilot" && (
                        <span style={autoBadgeStyle}>auto</span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--sv-ink)",
                        }}
                      >
                        {p.content.slice(0, 80)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Falhas recentes do autopilot — alerta visual */}
          {stats.autopilot.recentFailures.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={statsSubLabel}>Falhas recentes do autopilot</div>
              <ul style={statsListStyle}>
                {stats.autopilot.recentFailures.slice(0, 3).map((f) => (
                  <li key={f.id} style={{ ...statsListItem, background: "rgba(239,68,68,0.08)" }}>
                    <span style={{ fontSize: 11, color: "var(--sv-soft)" }}>
                      {new Date(f.started_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span style={{ fontSize: 11, flex: 1, color: "#7f1d1d" }}>
                      {f.error?.slice(0, 100) ?? "(sem detalhe)"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={h2Style}>Novo profile</h2>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex: Madureira)"
            style={inputStyle}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            style={inputStyle}
          />
          <button onClick={onCreate} style={btnPrimary} disabled={creating}>
            {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            Criar profile
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>Profiles ({profiles.length})</h2>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : profiles.length === 0 ? (
          <p style={{ color: "var(--sv-soft)", marginTop: 8 }}>
            Nenhum profile ainda. Cria o primeiro acima.
          </p>
        ) : (
          <ul style={listStyle}>
            {profiles.map((p) => (
              <li key={p.id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/app/admin/zernio/${p.id}`} style={linkStyle}>
                    <strong>{p.name}</strong>
                  </Link>
                  {p.description && (
                    <div style={{ fontSize: 12, color: "var(--sv-soft)" }}>
                      {p.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--sv-soft)", marginTop: 4 }}>
                    Zernio ID: <code>{p.zernio_profile_id}</code>
                    {p.autopilot_enabled && (
                      <span style={pilotBadge}>Piloto Auto ON</span>
                    )}
                  </div>
                </div>
                <button onClick={() => onDelete(p.id)} style={btnDanger} aria-label="Arquivar">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent: string;
}) {
  return (
    <div style={statTileStyle}>
      <div
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--sv-soft, #6b6b6b)",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: accent,
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 10.5, color: "var(--sv-soft, #888)", marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: 24,
  fontFamily: "var(--sv-sans)",
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

const inputStyle: React.CSSProperties = {
  padding: 10,
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-sans)",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "10px 14px",
  background: "var(--sv-ink)",
  color: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
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

const btnDanger: React.CSSProperties = {
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  padding: 6,
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

const linkStyle: React.CSSProperties = {
  color: "var(--sv-ink)",
  textDecoration: "none",
  fontSize: 15,
};

const pilotBadge: React.CSSProperties = {
  display: "inline-block",
  marginLeft: 8,
  padding: "2px 6px",
  background: "var(--sv-green, #b7d96b)",
  color: "var(--sv-ink)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
};

const healthBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#fff",
  borderRadius: 2,
};

const configWarn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 10,
  marginTop: 10,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1.5px solid #ef4444",
  fontSize: 12,
  color: "#7f1d1d",
};

const statsCardStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  padding: 18,
  marginBottom: 16,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const statTileStyle: React.CSSProperties = {
  padding: 12,
  background: "var(--sv-paper, #faf7f2)",
  border: "1px solid var(--sv-soft, #d4d4d4)",
  borderRadius: 2,
};

const statsSubLabel: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--sv-soft, #6b6b6b)",
  fontWeight: 700,
  marginBottom: 6,
};

const statsListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const statsListItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  background: "var(--sv-paper, #faf7f2)",
  border: "1px solid var(--sv-soft, #e0e0e0)",
};

const autoBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "1px 5px",
  background: "#a855f7",
  color: "#fff",
};
