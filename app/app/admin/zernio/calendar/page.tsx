"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio/calendar (v2) — calendário visual.
 *
 * Mudanças vs v1:
 *  - Cores por PLATAFORMA (IG coral / LinkedIn azul) em vez de por profile.
 *    Reflete o modelo v2 onde cada user tem 1 profile interno e o que
 *    importa visualmente é a rede de destino.
 *  - Hero header estilo SV, KPI strip, day cells com hover suave + dots.
 *  - Empty states e loading skeletons.
 *  - Sidebar de posts com mídia preview ampliada e ações mais claras.
 */

type Status = "draft" | "scheduled" | "publishing" | "published" | "failed" | "partial" | "cancelled";

interface Post {
  id: string;
  zernio_post_id: string | null;
  status: Status;
  content: string;
  scheduled_for: string | null;
  published_at: string | null;
  timezone: string;
  source: string;
  platforms: { platform: string; accountId: string }[];
  raw?: Record<string, unknown> | null;
  failure_reason?: string | null;
}

const STATUS_META: Record<Status, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Rascunho", color: "#9ca3af", icon: Clock },
  scheduled: { label: "Agendado", color: "#3b82f6", icon: CalendarClock },
  publishing: { label: "Publicando", color: "#f59e0b", icon: Loader2 },
  published: { label: "Publicado", color: "#10b981", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "#ef4444", icon: XCircle },
  partial: { label: "Parcial", color: "#f97316", icon: XCircle },
  cancelled: { label: "Cancelado", color: "#6b7280", icon: XCircle },
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  linkedin: "#0A66C2",
};

export default function ZernioCalendarPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(
    new Set(["instagram", "linkedin"])
  );
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
      const res = await fetch("/api/zernio/posts?limit=200", {
        headers: jsonWithAuth(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      setPosts(data.posts || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchAll();
  }, [session, fetchAll]);

  // Filtra posts por plataforma (qualquer post que tenha pelo menos 1
  // plataforma ativa entra). Drafts sem scheduled_for ainda aparecem na
  // sidebar do dia atual mas não no grid.
  const filteredPosts = useMemo(
    () =>
      posts.filter((p) =>
        p.platforms.some((pl) => activePlatforms.has(pl.platform))
      ),
    [posts, activePlatforms]
  );

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of filteredPosts) {
      // Mostra no calendário pelo scheduled_for (quando agendado/draft com data)
      // OU pelo published_at (quando já publicado).
      const isoDate = p.scheduled_for || p.published_at;
      if (!isoDate) continue;
      const day = isoDayLocal(isoDate);
      const arr = map.get(day) ?? [];
      arr.push(p);
      map.set(day, arr);
    }
    return map;
  }, [filteredPosts]);

  // Stats KPIs
  const stats = useMemo(() => {
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const upcoming = filteredPosts.filter((p) => {
      if (!p.scheduled_for) return false;
      const t = new Date(p.scheduled_for).getTime();
      return t >= now && t <= sevenDaysFromNow && p.status === "scheduled";
    });
    const failed = filteredPosts.filter((p) => p.status === "failed").length;
    const published7d = filteredPosts.filter((p) => {
      if (!p.published_at) return false;
      return new Date(p.published_at).getTime() >= now - 7 * 24 * 60 * 60 * 1000;
    }).length;
    const next = upcoming.sort(
      (a, b) =>
        new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime()
    )[0];
    return {
      upcoming: upcoming.length,
      published7d,
      failed,
      nextLabel: next
        ? new Date(next.scheduled_for!).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
    };
  }, [filteredPosts]);

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

  const togglePlatform = (p: string) => {
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
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
        if (!res.ok) throw new Error((await res.json()).error || "Falha");
        toast.success("Cancelado.");
        await fetchAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [session, fetchAll]
  );

  const onReschedule = useCallback(
    async (postId: string) => {
      if (!session || !newScheduledLocal) {
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
        if (!res.ok) throw new Error((await res.json()).error || "Falha");
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
        <ArrowLeft size={14} /> Voltar
      </Link>

      {/* HERO */}
      <header style={heroStyle}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <span style={kickerStyle}>
            <CalendarClock size={11} /> Planejamento
          </span>
          <h1 style={titleStyle}>
            Seu <em>calendário</em>.
          </h1>
          <p style={subtitleStyle}>
            Tudo que tá programado pro Instagram + LinkedIn em um lugar só.
          </p>
        </div>
        <button onClick={fetchAll} style={btnGhost} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      {/* KPI STRIP */}
      <section style={kpiStripStyle}>
        <Tile label="Próximos 7d" value={stats.upcoming} accent="#3b82f6" />
        <Tile label="Publicados 7d" value={stats.published7d} accent="#10b981" />
        <Tile
          label="Falharam"
          value={stats.failed}
          accent={stats.failed > 0 ? "#ef4444" : "#9ca3af"}
        />
        <Tile label="Próximo" value={stats.nextLabel} accent="#a855f7" small />
      </section>

      {/* MONTH NAV + PLATFORM FILTERS */}
      <div style={controlBarStyle}>
        <div style={navGroupStyle}>
          <button onClick={onPrevMonth} style={btnIconLg} aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <h2 style={monthLabelStyle}>
            {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={onNextMonth} style={btnIconLg} aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
          <button onClick={onToday} style={btnGhostSm}>
            Hoje
          </button>
        </div>

        <div style={filterPillsStyle}>
          {(["instagram", "linkedin"] as const).map((p) => {
            const on = activePlatforms.has(p);
            const accent = PLATFORM_COLORS[p];
            const Icon = p === "instagram" ? Instagram : Linkedin;
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                style={{
                  ...platformPillStyle,
                  background: on ? accent : "transparent",
                  color: on ? "#fff" : accent,
                  borderColor: accent,
                }}
              >
                <Icon size={11} />
                {p === "instagram" ? "Instagram" : "LinkedIn"}
              </button>
            );
          })}
        </div>
      </div>

      {/* GRID + SIDEBAR */}
      <div style={gridContainerStyle}>
        <div style={gridStyle}>
          {/* Header dos dias da semana */}
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} style={dayHeaderStyle}>
              {d}
            </div>
          ))}
          {/* Skeleton durante loading */}
          {loading && posts.length === 0
            ? Array.from({ length: 35 }).map((_, i) => (
                <div key={`sk-${i}`} style={skeletonCellStyle} />
              ))
            : weeks.map((week, wi) =>
                week.map((day, di) => {
                  const iso = isoDayLocal(day.toISOString());
                  const isOtherMonth = day.getMonth() !== cursor.getMonth();
                  const dayPosts = postsByDay.get(iso) ?? [];
                  const isToday = iso === todayIso;
                  const isSelected = iso === selectedDay;
                  // Cor do indicador: se múltiplas plataformas, mistura (ink)
                  const platformsInDay = new Set(
                    dayPosts.flatMap((p) => p.platforms.map((pl) => pl.platform))
                  );
                  return (
                    <button
                      key={`${wi}-${di}`}
                      onClick={() => setSelectedDay(iso)}
                      style={{
                        ...dayCellStyle,
                        background: isSelected
                          ? "var(--sv-ink)"
                          : isToday
                            ? "rgba(124, 240, 103, 0.12)"
                            : "var(--sv-white)",
                        opacity: isOtherMonth ? 0.35 : 1,
                        borderColor: isSelected
                          ? "var(--sv-ink)"
                          : isToday
                            ? "#10b981"
                            : "var(--sv-soft, #e5e5e5)",
                        color: isSelected ? "var(--sv-paper)" : "var(--sv-ink)",
                      }}
                    >
                      <div
                        style={{
                          ...dayNumberStyle,
                          color: isSelected
                            ? "var(--sv-paper)"
                            : isToday
                              ? "#10b981"
                              : "var(--sv-ink)",
                          fontWeight: isToday ? 800 : 600,
                        }}
                      >
                        {day.getDate()}
                        {isToday && (
                          <span style={todayDotStyle} aria-hidden>
                            ●
                          </span>
                        )}
                      </div>
                      {dayPosts.length > 0 && (
                        <div style={dotsRowStyle}>
                          {Array.from(platformsInDay).slice(0, 2).map((pf) => (
                            <span
                              key={pf}
                              style={{
                                ...platformDotStyle,
                                background: PLATFORM_COLORS[pf] || "#999",
                              }}
                              title={pf}
                            />
                          ))}
                          <span style={countLabel}>
                            {dayPosts.length} {dayPosts.length === 1 ? "post" : "posts"}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
        </div>

        {/* SIDEBAR */}
        <aside style={sidebarStyle}>
          {selectedDay ? (
            <>
              <div style={sidebarHeaderStyle}>
                <h3 style={sidebarTitleStyle}>
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                <span style={sidebarCountStyle}>
                  {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""}
                </span>
              </div>
              {selectedPosts.length === 0 ? (
                <div style={emptyStateStyle}>
                  <CalendarClock size={20} style={{ opacity: 0.4 }} />
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--sv-soft, #888)" }}>
                    Nenhum post nesse dia.
                  </p>
                </div>
              ) : (
                <ul style={listStyle}>
                  {selectedPosts.map((p) =>
                    renderPostCard(p, {
                      isOpen: expandedPostId === p.id,
                      onToggle: () =>
                        setExpandedPostId(expandedPostId === p.id ? null : p.id),
                      onDelete: onDeletePost,
                      onStartReschedule: startReschedule,
                      onReschedule,
                      reschedulingPostId,
                      newScheduledLocal,
                      setNewScheduledLocal,
                      cancelReschedule: () => {
                        setReschedulingPostId(null);
                        setNewScheduledLocal("");
                      },
                    })
                  )}
                </ul>
              )}
            </>
          ) : (
            <div style={emptyStateStyle}>
              <CalendarClock size={20} style={{ opacity: 0.4 }} />
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--sv-soft, #888)" }}>
                Selecione um dia pra ver os posts.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ────────────────────────────── COMPONENTES ──────────────────────────────

function Tile({
  label,
  value,
  accent,
  small = false,
}: {
  label: string;
  value: number | string;
  accent: string;
  small?: boolean;
}) {
  return (
    <div style={tileStyle}>
      <div style={tileLabelStyle}>{label}</div>
      <div
        style={{
          ...tileValueStyle,
          color: accent,
          fontSize: small ? 18 : 28,
        }}
      >
        {value}
      </div>
    </div>
  );
}

interface PostCardHandlers {
  isOpen: boolean;
  onToggle: () => void;
  onDelete: (id: string) => Promise<void>;
  onStartReschedule: (p: Post) => void;
  onReschedule: (id: string) => Promise<void>;
  reschedulingPostId: string | null;
  newScheduledLocal: string;
  setNewScheduledLocal: (v: string) => void;
  cancelReschedule: () => void;
}

function renderPostCard(p: Post, h: PostCardHandlers): React.ReactNode {
  const time = p.scheduled_for
    ? new Date(p.scheduled_for).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : p.published_at
      ? new Date(p.published_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const statusMeta = STATUS_META[p.status];
  const StatusIcon = statusMeta.icon;
  const mediaUrls = extractMediaUrls(p.raw);
  const platformResults = extractPlatformResults(p.raw);

  return (
    <li key={p.id} style={postCardStyle}>
      <button type="button" onClick={h.onToggle} style={postHeaderBtn}>
        <span style={timeStyle}>{time}</span>
        <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 0 }}>
          {p.platforms.map((pl, idx) => {
            const Icon = pl.platform === "instagram" ? Instagram : Linkedin;
            return (
              <span
                key={idx}
                style={{
                  ...platformChipStyle,
                  background: PLATFORM_COLORS[pl.platform] || "#999",
                }}
                title={pl.platform}
              >
                <Icon size={11} />
              </span>
            );
          })}
        </div>
        {p.source === "autopilot" && <span style={autoBadgeStyle}>auto</span>}
        <span
          style={{
            ...statusBadgeStyle,
            background: statusMeta.color,
          }}
        >
          <StatusIcon size={10} />
          {statusMeta.label}
        </span>
      </button>

      <p style={contentStyle}>
        {h.isOpen
          ? p.content
          : p.content.length > 120
            ? p.content.slice(0, 120) + "..."
            : p.content}
      </p>

      {h.isOpen && (
        <>
          {/* Mídia */}
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
                <div style={mediaMoreStyle}>+{mediaUrls.length - 6}</div>
              )}
            </div>
          )}

          {/* Per-platform results */}
          {platformResults.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11 }}>
              <strong style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Por plataforma
              </strong>
              <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
                {platformResults.map((r, i) => (
                  <li key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "2px 0" }}>
                    <span style={{ textTransform: "capitalize", minWidth: 70 }}>{r.platform}</span>
                    <span
                      style={{
                        color: r.status === "success" ? "#10b981" : "#ef4444",
                        fontWeight: 700,
                      }}
                    >
                      {r.status}
                    </span>
                    {r.error && (
                      <span style={{ color: "var(--sv-soft, #888)", fontSize: 10 }}>
                        · {r.error.slice(0, 60)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Failure reason */}
          {p.failure_reason && <div style={errBoxStyle}>{p.failure_reason}</div>}

          {/* Reschedule form */}
          {h.reschedulingPostId === p.id && (
            <div style={rescheduleBoxStyle}>
              <input
                type="datetime-local"
                value={h.newScheduledLocal}
                onChange={(e) => h.setNewScheduledLocal(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button
                  onClick={() => h.onReschedule(p.id)}
                  style={btnPrimarySmall}
                >
                  Salvar
                </button>
                <button onClick={h.cancelReschedule} style={btnGhostSmall}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={actionsRowStyle}>
            {p.status !== "published" &&
              p.status !== "cancelled" &&
              p.status !== "failed" &&
              h.reschedulingPostId !== p.id && (
                <>
                  <button
                    onClick={() => h.onStartReschedule(p)}
                    style={btnGhostSmall}
                  >
                    <CalendarClock size={11} /> Reagendar
                  </button>
                  <button onClick={() => h.onDelete(p.id)} style={btnDangerSmall}>
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
}

// ────────────────────────────── HELPERS ──────────────────────────────

function isoDayLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildMonthGrid(monthStart: Date): Date[][] {
  const first = new Date(monthStart);
  const startOfWeek = new Date(first);
  startOfWeek.setDate(first.getDate() - first.getDay());
  const weeks: Date[][] = [];
  const cursor = new Date(startOfWeek);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    const last = week[6];
    if (last.getMonth() !== monthStart.getMonth() && last.getDate() > 7) break;
  }
  return weeks;
}

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

// ────────────────────────────── STYLES ──────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  padding: 24,
  fontFamily: "var(--sv-sans)",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--sv-soft, #6b6b6b)",
  textDecoration: "none",
  marginBottom: 12,
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  marginBottom: 24,
  flexWrap: "wrap",
};

const kickerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#3b82f6",
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  fontSize: "clamp(34px, 5.5vw, 50px)",
  fontWeight: 800,
  margin: "8px 0 4px",
  letterSpacing: "-0.025em",
  lineHeight: 1.02,
  fontFamily: "var(--sv-display, Georgia, serif)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--sv-muted, #555)",
  margin: 0,
  maxWidth: 520,
};

const kpiStripStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginBottom: 20,
};

const tileStyle: React.CSSProperties = {
  padding: 14,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
};

const tileLabelStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sv-soft, #6b6b6b)",
  fontWeight: 700,
};

const tileValueStyle: React.CSSProperties = {
  fontWeight: 800,
  letterSpacing: "-0.02em",
  marginTop: 4,
  lineHeight: 1.1,
};

const controlBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
  flexWrap: "wrap",
};

const navGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const monthLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  minWidth: 200,
  textAlign: "center",
  textTransform: "capitalize",
  letterSpacing: "-0.01em",
};

const filterPillsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const platformPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  border: "1.5px solid",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const gridContainerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 360px",
  gap: 16,
  alignItems: "start",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  padding: 8,
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
};

const dayHeaderStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--sv-soft, #888)",
  padding: 6,
};

const dayCellStyle: React.CSSProperties = {
  minHeight: 84,
  border: "1px solid",
  padding: 8,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "var(--sv-sans)",
  transition: "transform 0.1s, box-shadow 0.1s",
  background: "var(--sv-white)",
};

const dayNumberStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 13,
};

const todayDotStyle: React.CSSProperties = {
  fontSize: 6,
  color: "#10b981",
  marginLeft: -2,
};

const skeletonCellStyle: React.CSSProperties = {
  minHeight: 84,
  background: "linear-gradient(90deg, var(--sv-paper, #f5f5f5) 25%, #ebebeb 50%, var(--sv-paper, #f5f5f5) 75%)",
  backgroundSize: "200% 100%",
  animation: "skel 1.5s linear infinite",
  border: "1px solid var(--sv-soft, #e5e5e5)",
};

const dotsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: "auto",
  flexWrap: "wrap",
};

const platformDotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
};

const countLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--sv-soft, #888)",
};

const sidebarStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  padding: 14,
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  position: "sticky",
  top: 16,
  maxHeight: "85vh",
  overflowY: "auto",
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
  paddingBottom: 10,
  borderBottom: "1.5px solid var(--sv-ink)",
  marginBottom: 10,
};

const sidebarTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  textTransform: "capitalize",
};

const sidebarCountStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--sv-soft, #888)",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const postCardStyle: React.CSSProperties = {
  border: "1.5px solid var(--sv-soft, #e0e0e0)",
  padding: 10,
  background: "var(--sv-paper, #faf7f2)",
  transition: "border-color 0.12s",
};

const postHeaderBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  marginBottom: 6,
};

const timeStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--sv-ink)",
};

const platformChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  borderRadius: 2,
  color: "#fff",
};

const autoBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "1px 5px",
  background: "#a855f7",
  color: "#fff",
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "2px 6px",
  color: "#fff",
};

const contentStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
  margin: "0 0 6px",
  color: "var(--sv-ink)",
};

const mediaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 4,
  marginTop: 8,
};

const mediaThumbStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 5",
  objectFit: "cover",
  border: "1px solid var(--sv-soft, #ddd)",
};

const mediaMoreStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--sv-white)",
  border: "1px solid var(--sv-soft, #ddd)",
  fontSize: 13,
  fontWeight: 700,
  aspectRatio: "4 / 5",
};

const errBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 6,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid #ef4444",
  fontSize: 11,
  color: "#7f1d1d",
};

const rescheduleBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 6,
  border: "1.5px solid var(--sv-ink)",
  fontSize: 12,
};

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  marginTop: 8,
  flexWrap: "wrap",
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

const btnGhostSm: React.CSSProperties = {
  ...btnGhost,
  padding: "6px 10px",
  fontSize: 11,
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

const btnPrimarySmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  border: "1px solid var(--sv-ink)",
  background: "var(--sv-ink)",
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhostSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "4px 8px",
  border: "1px solid var(--sv-soft, #d0d0d0)",
  background: "var(--sv-white)",
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  color: "var(--sv-ink)",
};

const btnDangerSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "4px 8px",
  border: "1px solid #ef4444",
  background: "transparent",
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
  color: "#ef4444",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "40px 16px",
  color: "var(--sv-soft, #888)",
};
