"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio/calendar — calendário visual mensal de posts agendados.
 *
 * Carrega todos os posts agendados/draft do admin (todos profiles juntos),
 * pinta cada profile com uma cor deterministic, e mostra grid 7×N do mês.
 * Click num dia abre painel lateral com posts daquele dia + ações de
 * cancelar.
 *
 * V1 sem drag-and-drop — pra reagendar, user cancela e cria de novo no
 * preview do carrossel. Drag fica pra v2.
 */

interface Profile {
  id: string;
  name: string;
}

interface Post {
  id: string;
  profile_id: string;
  zernio_post_id: string | null;
  status: string;
  content: string;
  scheduled_for: string | null;
  timezone: string;
  source: string;
  platforms: { platform: string; accountId: string }[];
  // Snapshot da resposta Zernio — pode ter mediaUrls, results por plataforma, etc.
  raw?: Record<string, unknown> | null;
  failure_reason?: string | null;
  published_at?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#9ca3af",
  scheduled: "#3b82f6",
  publishing: "#f59e0b",
  published: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

const PROFILE_COLORS = [
  "#FF3D2E", // RV coral
  "#3b82f6", // blue
  "#10b981", // green
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f43f5e", // rose
];

function colorForProfile(profileId: string, idx: number): string {
  return PROFILE_COLORS[idx % PROFILE_COLORS.length];
}

export default function ZernioCalendarPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfileIds, setActiveProfileIds] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // ISO date
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [reschedulingPostId, setReschedulingPostId] = useState<string | null>(null);
  const [newScheduledLocal, setNewScheduledLocal] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) router.replace("/app");
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [pRes, postsRes] = await Promise.all([
        fetch("/api/zernio/profiles", { headers: jsonWithAuth(session) }),
        fetch("/api/zernio/posts?limit=200", { headers: jsonWithAuth(session) }),
      ]);
      const pData = await pRes.json();
      const postsData = await postsRes.json();
      if (!pRes.ok) throw new Error(pData.error || "Falha (profiles)");
      if (!postsRes.ok) throw new Error(postsData.error || "Falha (posts)");
      setProfiles(pData.profiles || []);
      setPosts(postsData.posts || []);
      // Default: todos profiles ativos no filtro.
      setActiveProfileIds(new Set((pData.profiles || []).map((p: Profile) => p.id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchAll();
  }, [session, fetchAll]);

  // Mapa profileId → cor
  const colorByProfile = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p, i) => m.set(p.id, colorForProfile(p.id, i)));
    return m;
  }, [profiles]);

  const profileNameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [profiles]);

  // Posts filtrados pelo profile filter + agrupados por dia ISO local.
  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      if (!activeProfileIds.has(p.profile_id)) continue;
      if (!p.scheduled_for) continue; // drafts sem data não entram no calendário
      const localDay = isoDayLocal(p.scheduled_for);
      const arr = map.get(localDay) ?? [];
      arr.push(p);
      map.set(localDay, arr);
    }
    return map;
  }, [posts, activeProfileIds]);

  // Grid: array de semanas. Inicia no domingo da 1ª semana e termina no
  // sábado da última pra completar quadrados de 7×N.
  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const onPrevMonth = () =>
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const onNextMonth = () =>
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const onToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(isoDayLocal(d.toISOString()));
  };

  const toggleProfileFilter = (id: string) => {
    setActiveProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDeletePost = useCallback(
    async (postId: string) => {
      if (!session) return;
      if (!confirm("Cancelar esse agendamento? Não dá pra desfazer.")) return;
      try {
        const res = await fetch(`/api/zernio/posts/${postId}`, {
          method: "DELETE",
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        toast.success("Agendamento cancelado.");
        await fetchAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [session, fetchAll]
  );

  const onReschedule = useCallback(
    async (postId: string) => {
      if (!session) return;
      if (!newScheduledLocal) {
        toast.error("Defina nova data/hora.");
        return;
      }
      try {
        const res = await fetch(`/api/zernio/posts/${postId}`, {
          method: "PATCH",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            scheduledFor: `${newScheduledLocal}:00`,
            timezone: "America/Sao_Paulo",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        toast.success(
          `Reagendado pra ${new Date(newScheduledLocal).toLocaleString("pt-BR")}`
        );
        setReschedulingPostId(null);
        setNewScheduledLocal("");
        await fetchAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [session, newScheduledLocal, fetchAll]
  );

  function startReschedule(post: Post) {
    setReschedulingPostId(post.id);
    if (post.scheduled_for) {
      const d = new Date(post.scheduled_for);
      const pad = (n: number) => String(n).padStart(2, "0");
      setNewScheduledLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
  }

  const todayIso = isoDayLocal(new Date().toISOString());
  const selectedPosts = selectedDay ? postsByDay.get(selectedDay) ?? [] : [];

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
          <h1 style={titleStyle}>Calendário</h1>
          <p style={subtitleStyle}>
            Posts agendados de todos os profiles. Click no dia pra ver detalhes.
          </p>
        </div>
        <button onClick={fetchAll} style={btnGhost} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      <div style={navStyle}>
        <button onClick={onPrevMonth} style={btnIconLg} aria-label="Mês anterior">
          <ChevronLeft size={16} />
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, minWidth: 200, textAlign: "center" }}>
          {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={onNextMonth} style={btnIconLg} aria-label="Próximo mês">
          <ChevronRight size={16} />
        </button>
        <button onClick={onToday} style={btnGhost}>
          Hoje
        </button>
      </div>

      {/* Profile filter pills */}
      {profiles.length > 0 && (
        <div style={pillsStyle}>
          {profiles.map((p) => {
            const on = activeProfileIds.has(p.id);
            const color = colorByProfile.get(p.id) || "#6b7280";
            return (
              <button
                key={p.id}
                onClick={() => toggleProfileFilter(p.id)}
                style={{
                  ...pillStyle,
                  background: on ? color : "transparent",
                  color: on ? "#fff" : color,
                  borderColor: color,
                }}
              >
                <span style={{ fontWeight: 700 }}>●</span> {p.name}
              </button>
            );
          })}
        </div>
      )}

      <div style={gridContainerStyle}>
        <div style={gridStyle}>
          {/* Header dias */}
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} style={dayHeaderStyle}>
              {d}
            </div>
          ))}
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              const iso = isoDayLocal(day.toISOString());
              const isOtherMonth = day.getMonth() !== cursor.getMonth();
              const dayPosts = postsByDay.get(iso) ?? [];
              const isToday = iso === todayIso;
              const isSelected = iso === selectedDay;
              return (
                <button
                  key={`${wi}-${di}`}
                  onClick={() => setSelectedDay(iso)}
                  style={{
                    ...dayCellStyle,
                    background: isSelected
                      ? "var(--sv-paper, #faf7f2)"
                      : isToday
                        ? "rgba(59, 130, 246, 0.08)"
                        : "var(--sv-white)",
                    opacity: isOtherMonth ? 0.4 : 1,
                    borderColor: isSelected ? "var(--sv-ink)" : "var(--sv-soft)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? "#3b82f6" : "var(--sv-ink)",
                    }}
                  >
                    {day.getDate()}
                  </div>
                  <div style={dotsStyle}>
                    {dayPosts.slice(0, 4).map((p, i) => (
                      <span
                        key={p.id + i}
                        style={{
                          ...dotStyle,
                          background: colorByProfile.get(p.profile_id) || "#6b7280",
                          opacity: STATUS_COLORS[p.status] ? 1 : 0.5,
                        }}
                        title={`${profileNameById.get(p.profile_id) ?? "?"} · ${p.status}`}
                      />
                    ))}
                    {dayPosts.length > 4 && (
                      <span style={{ fontSize: 9, color: "var(--sv-soft)" }}>
                        +{dayPosts.length - 4}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Sidebar de detalhe do dia */}
        <aside style={sidebarStyle}>
          {selectedDay ? (
            <>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                {new Date(selectedDay).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              {selectedPosts.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--sv-soft)", marginTop: 8 }}>
                  Nenhum post nesse dia.
                </p>
              ) : (
                <ul style={listStyle}>
                  {selectedPosts.map((p) => {
                    const color = colorByProfile.get(p.profile_id) || "#6b7280";
                    const time = p.scheduled_for
                      ? new Date(p.scheduled_for).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";
                    const isOpen = expandedPostId === p.id;
                    const mediaUrls = extractMediaUrls(p.raw);
                    const platformResults = extractPlatformResults(p.raw);
                    return (
                      <li key={p.id} style={postCardStyle}>
                        <button
                          type="button"
                          onClick={() => setExpandedPostId(isOpen ? null : p.id)}
                          style={postHeaderBtn}
                        >
                          <span style={{ ...dotStyle, background: color, width: 8, height: 8 }} />
                          <strong style={{ fontSize: 12 }}>
                            {profileNameById.get(p.profile_id) ?? "?"}
                          </strong>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 5px",
                              background: STATUS_COLORS[p.status] ?? "#ccc",
                              color: "#fff",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              marginLeft: "auto",
                            }}
                          >
                            {p.status}
                          </span>
                        </button>
                        <div style={{ fontSize: 11, color: "var(--sv-soft)", marginBottom: 4 }}>
                          {time} · {p.platforms.map((pl) => pl.platform).join(", ")}
                          {p.source === "autopilot" && (
                            <span style={{ marginLeft: 6, fontWeight: 700, color: "#a855f7" }}>
                              (auto)
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, margin: "4px 0", lineHeight: 1.4 }}>
                          {isOpen
                            ? p.content
                            : p.content.length > 140
                              ? p.content.slice(0, 140) + "..."
                              : p.content}
                        </p>

                        {isOpen && (
                          <>
                            {/* Mídia preview */}
                            {mediaUrls.length > 0 && (
                              <div style={mediaGridStyle}>
                                {mediaUrls.slice(0, 6).map((u, i) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={i}
                                    src={u}
                                    alt={`Slide ${i + 1}`}
                                    style={mediaThumbStyle}
                                  />
                                ))}
                                {mediaUrls.length > 6 && (
                                  <div style={moreThumbStyle}>+{mediaUrls.length - 6}</div>
                                )}
                              </div>
                            )}

                            {/* Per-platform status (do raw.results se houver) */}
                            {platformResults.length > 0 && (
                              <div style={{ fontSize: 11, marginTop: 6 }}>
                                <strong>Por plataforma:</strong>
                                <ul style={{ margin: "2px 0 0 16px", padding: 0 }}>
                                  {platformResults.map((r, i) => (
                                    <li key={i}>
                                      <span style={{ textTransform: "capitalize" }}>{r.platform}</span>
                                      :{" "}
                                      <span
                                        style={{
                                          color: r.status === "success" ? "#10b981" : "#ef4444",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {r.status}
                                      </span>
                                      {r.error && (
                                        <span style={{ color: "var(--sv-soft)" }}> · {r.error}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Failure reason */}
                            {p.failure_reason && (
                              <div style={errBoxStyle}>{p.failure_reason}</div>
                            )}

                            {/* Reschedule form */}
                            {reschedulingPostId === p.id && (
                              <div style={rescheduleBoxStyle}>
                                <input
                                  type="datetime-local"
                                  value={newScheduledLocal}
                                  onChange={(e) => setNewScheduledLocal(e.target.value)}
                                  style={inputStyle}
                                />
                                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                  <button
                                    onClick={() => onReschedule(p.id)}
                                    style={btnPrimarySmall}
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReschedulingPostId(null);
                                      setNewScheduledLocal("");
                                    }}
                                    style={btnDangerSmall}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                              {p.status !== "published" &&
                                p.status !== "cancelled" &&
                                p.status !== "failed" && (
                                  <>
                                    <button
                                      onClick={() => startReschedule(p)}
                                      style={btnGhostSmall}
                                    >
                                      <CalendarClock size={11} /> Reagendar
                                    </button>
                                    <button
                                      onClick={() => onDeletePost(p.id)}
                                      style={btnDangerSmall}
                                    >
                                      <Trash2 size={11} /> Cancelar
                                    </button>
                                  </>
                                )}
                              {p.zernio_post_id && (
                                <a
                                  href={`https://zernio.com/dashboard/posts/${p.zernio_post_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={btnGhostSmall}
                                >
                                  <ExternalLink size={11} /> Zernio
                                </a>
                              )}
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, color: "var(--sv-soft)" }}>
              Selecione um dia pra ver os posts.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

/**
 * Extrai URLs de mídia do raw do Zernio. O shape varia (mediaUrls, media,
 * attachments, etc) — testamos os formatos mais comuns. Best-effort: se não
 * achar nada, devolve [] e a UI esconde a seção.
 */
function extractMediaUrls(raw: Record<string, unknown> | null | undefined): string[] {
  if (!raw || typeof raw !== "object") return [];
  const candidates: unknown[] = [
    raw.mediaUrls,
    raw.media_urls,
    raw.media,
    raw.attachments,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      const urls = c
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            return (obj.url as string) || (obj.publicUrl as string) || null;
          }
          return null;
        })
        .filter((u): u is string => typeof u === "string" && /^https?:/i.test(u));
      if (urls.length > 0) return urls;
    }
  }
  return [];
}

/**
 * Extrai resultados por plataforma se Zernio devolver no raw. Útil pra
 * mostrar "twitter: success, linkedin: failed" quando post.partial.
 */
interface PlatformResult {
  platform: string;
  status: string;
  error?: string;
}

function extractPlatformResults(
  raw: Record<string, unknown> | null | undefined
): PlatformResult[] {
  if (!raw || typeof raw !== "object") return [];
  const r = (raw.results ?? raw.platforms ?? null) as unknown;
  if (!Array.isArray(r)) return [];
  const out: PlatformResult[] = [];
  for (const item of r) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const platform = obj.platform as string | undefined;
    const status = obj.status as string | undefined;
    if (!platform || !status) continue;
    const errStr = obj.error as string | undefined;
    out.push(errStr ? { platform, status, error: errStr } : { platform, status });
  }
  return out;
}

function isoDayLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildMonthGrid(monthStart: Date): Date[][] {
  const first = new Date(monthStart);
  const startOfWeek = new Date(first);
  startOfWeek.setDate(first.getDate() - first.getDay()); // domingo

  const weeks: Date[][] = [];
  const cursor = new Date(startOfWeek);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    // Para se já passou do fim do mês E voltou pra semana só com "outro mês".
    const last = week[6];
    if (last.getMonth() !== monthStart.getMonth() && last.getDate() > 7) break;
  }
  return weeks;
}

// ============================================================
// Styles
// ============================================================

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

const navStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  justifyContent: "center",
};

const pillsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 16,
};

const pillStyle: React.CSSProperties = {
  padding: "4px 10px",
  border: "1.5px solid",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const gridContainerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: 16,
  alignItems: "start",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  padding: 6,
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
};

const dayHeaderStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--sv-soft)",
  padding: 4,
};

const dayCellStyle: React.CSSProperties = {
  minHeight: 70,
  border: "1px solid",
  padding: 6,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontFamily: "var(--sv-sans)",
};

const dotsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 3,
  alignItems: "center",
  marginTop: "auto",
};

const dotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  borderRadius: "50%",
};

const sidebarStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  padding: 14,
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  position: "sticky",
  top: 16,
  maxHeight: "80vh",
  overflowY: "auto",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const postCardStyle: React.CSSProperties = {
  border: "1px solid var(--sv-soft)",
  padding: 8,
  background: "var(--sv-paper, #faf7f2)",
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

const btnIconLg: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1.5px solid var(--sv-ink)",
  background: "var(--sv-white)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const btnDangerSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 6px",
  border: "1px solid var(--sv-ink)",
  background: "transparent",
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhostSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 6px",
  border: "1px solid var(--sv-soft)",
  background: "var(--sv-white)",
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  color: "var(--sv-ink)",
};

const btnPrimarySmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 6px",
  border: "1px solid var(--sv-ink)",
  background: "var(--sv-ink)",
  color: "var(--sv-white)",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const postHeaderBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 4,
  width: "100%",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
};

const mediaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 4,
  marginTop: 6,
};

const mediaThumbStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 5",
  objectFit: "cover",
  border: "1px solid var(--sv-soft)",
};

const moreThumbStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--sv-paper, #faf7f2)",
  border: "1px solid var(--sv-soft)",
  fontSize: 14,
  fontWeight: 700,
  aspectRatio: "4 / 5",
};

const errBoxStyle: React.CSSProperties = {
  marginTop: 6,
  padding: 6,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid #ef4444",
  fontSize: 11,
  color: "#7f1d1d",
};

const rescheduleBoxStyle: React.CSSProperties = {
  marginTop: 6,
  padding: 6,
  background: "var(--sv-paper, #faf7f2)",
  border: "1px solid var(--sv-soft)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 6,
  border: "1px solid var(--sv-ink)",
  fontSize: 12,
};
