"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
// useRouter removido — gating moved pro layout
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
// Layout (app/zernio/layout.tsx) já gateia admin OR business plan.

type Status =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "partial"
  | "cancelled";

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

const STATUS_META: Record<
  Status,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  draft: { label: "Rascunho", color: "var(--sv-muted, #888)", icon: Clock },
  scheduled: { label: "Agendado", color: "var(--sv-ink)", icon: CalendarClock },
  publishing: { label: "Publicando", color: "var(--sv-yellow)", icon: Loader2 },
  published: { label: "Publicado", color: "var(--sv-green)", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "#C94F3B", icon: XCircle },
  partial: { label: "Parcial", color: "#FF8A4C", icon: XCircle },
  cancelled: { label: "Cancelado", color: "var(--sv-muted, #888)", icon: XCircle },
};

// IG mantém paleta SV (pink) — é a 2ª accent oficial. LinkedIn usa yellow Kaleidos.
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "var(--sv-pink, #D262B2)",
  linkedin: "var(--sv-yellow, #F5C518)",
};

export default function ZernioCalendarPage() {
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
      const isoDate = p.scheduled_for || p.published_at;
      if (!isoDate) continue;
      const day = isoDayLocal(isoDate);
      const arr = map.get(day) ?? [];
      arr.push(p);
      map.set(day, arr);
    }
    return map;
  }, [filteredPosts]);

  const stats = useMemo(() => {
    const now = Date.now();
    const sevenAhead = now + 7 * 24 * 60 * 60 * 1000;
    const sevenAgo = now - 7 * 24 * 60 * 60 * 1000;
    const upcoming = filteredPosts.filter(
      (p) =>
        p.scheduled_for &&
        new Date(p.scheduled_for).getTime() >= now &&
        new Date(p.scheduled_for).getTime() <= sevenAhead &&
        p.status === "scheduled"
    );
    const failed = filteredPosts.filter((p) => p.status === "failed").length;
    const published7d = filteredPosts.filter(
      (p) => p.published_at && new Date(p.published_at).getTime() >= sevenAgo
    ).length;
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

  const todayIso = isoDayLocal(new Date().toISOString());
  const selectedPosts = selectedDay ? postsByDay.get(selectedDay) ?? [] : [];

  const onPrev = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const onNext = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const onToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(isoDayLocal(d.toISOString()));
  };

  const togglePlatform = (p: string) =>
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

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
        toast.success("Reagendado.");
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

  return (
    <div
      className="mx-auto px-6 py-8 lg:px-10 lg:py-12"
      style={{ maxWidth: 1240 }}
    >
      <Link
        href="/app/zernio"
        className="inline-flex items-center gap-1 mb-4"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 10.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--sv-muted, #6b6b6b)",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={12} /> Voltar
      </Link>

      {/* HERO */}
      <header className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div style={{ flex: 1, minWidth: 280 }}>
          <span className="sv-eyebrow">
            <span className="sv-dot" /> Nº 03 · Planejamento
          </span>
          <h1
            className="sv-display mt-3"
            style={{
              fontSize: "clamp(36px, 5.5vw, 56px)",
              lineHeight: 1.02,
            }}
          >
            Seu <em>calendário</em>.
          </h1>
          <p
            className="mt-2"
            style={{ color: "var(--sv-muted, #555)", fontSize: 13.5, maxWidth: 540 }}
          >
            Tudo que tá programado pro Instagram + LinkedIn em um lugar só.
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="sv-btn sv-btn-outline"
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      {/* QUICK-START — primeira vez (sem posts ainda) */}
      {!loading && posts.length === 0 && (
        <section
          className="sv-card mb-6 p-6"
          style={{ background: "var(--sv-paper)" }}
        >
          <div className="flex items-start gap-4 flex-wrap">
            <div
              style={{
                width: 56,
                height: 56,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--sv-green)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
              }}
            >
              <CalendarClock size={26} color="var(--sv-ink)" />
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2
                className="sv-display"
                style={{ fontSize: 26, lineHeight: 1.04, margin: 0 }}
              >
                Calendário <em>vazio</em>.
              </h2>
              <p
                className="mt-2"
                style={{
                  color: "var(--sv-muted, #555)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  maxWidth: 540,
                }}
              >
                Quando você agendar um carrossel ou ativar o Piloto Auto, ele
                aparece aqui. Comece criando um carrossel e clicando em
                &quot;Agendar nas redes&quot; no preview.
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <Link
                  href="/app/create/new"
                  className="sv-btn sv-btn-primary"
                  style={{ textDecoration: "none" }}
                >
                  Criar primeiro carrossel →
                </Link>
                <Link
                  href="/app/zernio/autopilot"
                  className="sv-btn sv-btn-outline"
                  style={{ textDecoration: "none" }}
                >
                  Configurar Piloto Auto
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* KPI STRIP */}
      <section
        className="grid gap-3 mb-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
      >
        <KpiCard label="Próximos 7d" value={stats.upcoming} accent="var(--sv-ink)" />
        <KpiCard label="Publicados 7d" value={stats.published7d} accent="var(--sv-green)" />
        <KpiCard
          label="Falharam"
          value={stats.failed}
          accent={stats.failed > 0 ? "#C94F3B" : "var(--sv-muted, #888)"}
        />
        <KpiCard label="Próximo" value={stats.nextLabel} accent="var(--sv-ink)" small />
      </section>

      {/* CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            aria-label="Mês anterior"
            style={navBtnStyle}
          >
            <ChevronLeft size={14} />
          </button>
          <h2 style={monthLabelStyle}>
            {cursor.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button onClick={onNext} aria-label="Próximo mês" style={navBtnStyle}>
            <ChevronRight size={14} />
          </button>
          <button onClick={onToday} className="sv-btn sv-btn-outline" style={smBtnStyle}>
            Hoje
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["instagram", "linkedin"] as const).map((p) => {
            const on = activePlatforms.has(p);
            const Icon = p === "instagram" ? Instagram : Linkedin;
            const accent = PLATFORM_COLORS[p];
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                style={{
                  ...platformPillStyle,
                  background: on ? accent : "var(--sv-white)",
                  borderColor: "var(--sv-ink)",
                  boxShadow: on ? "2px 2px 0 0 var(--sv-ink)" : "none",
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
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "minmax(0, 1fr) 380px" }}
      >
        {/* Grid mensal */}
        <div className="sv-card" style={{ padding: 12 }}>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} style={dowHeaderStyle}>
                {d}
              </div>
            ))}
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
                              ? "var(--sv-green)"
                              : "var(--sv-white)",
                          opacity: isOtherMonth ? 0.32 : 1,
                          color: isSelected
                            ? "var(--sv-paper)"
                            : "var(--sv-ink)",
                          boxShadow: isSelected
                            ? "3px 3px 0 0 var(--sv-green)"
                            : "none",
                        }}
                      >
                        <div style={dayNumberStyle}>{day.getDate()}</div>
                        {dayPosts.length > 0 && (
                          <div style={dotsRowStyle}>
                            {Array.from(platformsInDay)
                              .slice(0, 2)
                              .map((pf) => (
                                <span
                                  key={pf}
                                  style={{
                                    ...platformDotStyle,
                                    background: PLATFORM_COLORS[pf] || "var(--sv-ink)",
                                  }}
                                  title={pf}
                                />
                              ))}
                            <span
                              style={{
                                ...countLabel,
                                color: isSelected
                                  ? "var(--sv-paper)"
                                  : "var(--sv-ink)",
                              }}
                            >
                              {dayPosts.length}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className="sv-card"
          style={{
            position: "sticky",
            top: 16,
            maxHeight: "85vh",
            overflowY: "auto",
            padding: 18,
          }}
        >
          {selectedDay ? (
            <>
              <div
                className="flex items-baseline justify-between gap-2 pb-3 mb-3"
                style={{ borderBottom: "1.5px solid var(--sv-ink)" }}
              >
                <h3
                  className="sv-display"
                  style={{
                    fontSize: 22,
                    margin: 0,
                    textTransform: "capitalize",
                    lineHeight: 1.02,
                  }}
                >
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                <span style={sidebarCountStyle}>
                  {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""}
                </span>
              </div>
              {selectedPosts.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  text="Nenhum post nesse dia."
                />
              ) : (
                <ul
                  className="flex flex-col gap-3"
                  style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
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
            <EmptyState
              icon={CalendarClock}
              text="Selecione um dia no calendário."
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ────────────────────────── COMPONENTES ──────────────────────────

function KpiCard({
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
          fontSize: small ? 22 : 36,
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

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof CalendarClock;
  text: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-10 px-4"
      style={{ color: "var(--sv-muted, #888)" }}
    >
      <Icon size={22} style={{ opacity: 0.5 }} />
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 12,
          fontFamily: "var(--sv-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {text}
      </p>
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
      <button
        type="button"
        onClick={h.onToggle}
        style={postHeaderBtn}
      >
        <span style={timeStyle}>{time}</span>
        <div className="flex gap-1 flex-1 min-w-0">
          {p.platforms.map((pl, idx) => {
            const Icon = pl.platform === "instagram" ? Instagram : Linkedin;
            return (
              <span
                key={idx}
                style={{
                  ...platformChipStyle,
                  background: PLATFORM_COLORS[pl.platform] || "var(--sv-ink)",
                }}
                title={pl.platform}
              >
                <Icon size={10} color="var(--sv-ink)" />
              </span>
            );
          })}
        </div>
        {p.source === "autopilot" && <span style={autoBadgeStyle}>auto</span>}
        <span style={{ ...statusBadgeStyle, color: statusMeta.color }}>
          <StatusIcon size={10} />
          {statusMeta.label}
        </span>
      </button>

      <p style={contentStyle}>
        {h.isOpen
          ? p.content
          : p.content.length > 110
            ? p.content.slice(0, 110) + "…"
            : p.content}
      </p>

      {h.isOpen && (
        <>
          {mediaUrls.length > 0 && (
            <div
              className="grid gap-1 mt-2"
              style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
            >
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

          {platformResults.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                Por plataforma
              </strong>
              <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
                {platformResults.map((r, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      padding: "2px 0",
                      fontSize: 11,
                    }}
                  >
                    <span style={{ textTransform: "capitalize", minWidth: 70 }}>
                      {r.platform}
                    </span>
                    <span
                      style={{
                        color:
                          r.status === "success" ? "var(--sv-green)" : "#C94F3B",
                        fontWeight: 700,
                      }}
                    >
                      {r.status}
                    </span>
                    {r.error && (
                      <span
                        style={{ color: "var(--sv-muted, #888)", fontSize: 10 }}
                      >
                        · {r.error.slice(0, 60)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.failure_reason && <div style={errBoxStyle}>{p.failure_reason}</div>}

          {h.reschedulingPostId === p.id && (
            <div style={rescheduleBoxStyle}>
              <input
                type="datetime-local"
                value={h.newScheduledLocal}
                onChange={(e) => h.setNewScheduledLocal(e.target.value)}
                style={inputStyle}
              />
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => h.onReschedule(p.id)}
                  className="sv-btn sv-btn-primary"
                  style={miniBtnStyle}
                >
                  Salvar
                </button>
                <button
                  onClick={h.cancelReschedule}
                  className="sv-btn sv-btn-outline"
                  style={miniBtnStyle}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-1 mt-3 flex-wrap">
            {p.status !== "published" &&
              p.status !== "cancelled" &&
              p.status !== "failed" &&
              h.reschedulingPostId !== p.id && (
                <>
                  <button
                    onClick={() => h.onStartReschedule(p)}
                    className="sv-btn sv-btn-outline"
                    style={miniBtnStyle}
                  >
                    <CalendarClock size={10} /> Reagendar
                  </button>
                  <button
                    onClick={() => h.onDelete(p.id)}
                    className="sv-btn sv-btn-outline"
                    style={{ ...miniBtnStyle, borderColor: "#C94F3B", color: "#C94F3B" }}
                  >
                    <Trash2 size={10} /> Cancelar
                  </button>
                </>
              )}
            {p.zernio_post_id && (
              <a
                href={`https://zernio.com/dashboard/posts/${p.zernio_post_id}`}
                target="_blank"
                rel="noreferrer"
                className="sv-btn sv-btn-ghost"
                style={miniBtnStyle}
              >
                <ExternalLink size={10} /> Zernio
              </a>
            )}
          </div>
        </>
      )}
    </li>
  );
}

// ────────────────────────── HELPERS ──────────────────────────

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

function extractMediaUrls(
  raw: Record<string, unknown> | null | undefined
): string[] {
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

// ────────────────────────── STYLES ──────────────────────────

const navBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1.5px solid var(--sv-ink)",
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "2px 2px 0 0 var(--sv-ink)",
};

const monthLabelStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--sv-display)",
  fontSize: 22,
  fontWeight: 400,
  minWidth: 200,
  textAlign: "center",
  textTransform: "capitalize",
  letterSpacing: "-0.02em",
  color: "var(--sv-ink)",
};

const smBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 9.5,
};

const platformPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  border: "1.5px solid",
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  cursor: "pointer",
  color: "var(--sv-ink)",
  transition: "transform 0.12s, box-shadow 0.12s",
};

const dowHeaderStyle: React.CSSProperties = {
  textAlign: "center",
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "var(--sv-muted, #888)",
  padding: 6,
  background: "var(--sv-paper)",
};

const dayCellStyle: React.CSSProperties = {
  minHeight: 84,
  border: "1.5px solid var(--sv-ink)",
  padding: 8,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontFamily: "var(--sv-sans)",
  transition: "transform 0.12s, box-shadow 0.12s",
};

const dayNumberStyle: React.CSSProperties = {
  fontFamily: "var(--sv-display)",
  fontSize: 16,
  fontWeight: 400,
  letterSpacing: "-0.01em",
};

const dotsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: "auto",
};

const platformDotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
  border: "1px solid var(--sv-ink)",
};

const countLabel: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.06em",
};

const skeletonCellStyle: React.CSSProperties = {
  minHeight: 84,
  background:
    "linear-gradient(90deg, var(--sv-paper) 25%, #ebebeb 50%, var(--sv-paper) 75%)",
  backgroundSize: "200% 100%",
  animation: "skel 1.5s linear infinite",
  border: "1.5px solid var(--sv-ink)",
};

const sidebarCountStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--sv-muted, #888)",
  fontWeight: 700,
};

const postCardStyle: React.CSSProperties = {
  border: "1.5px solid var(--sv-ink)",
  padding: 10,
  background: "var(--sv-white)",
  boxShadow: "2px 2px 0 0 var(--sv-ink)",
  transition: "transform 0.12s",
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
  letterSpacing: "0.04em",
  color: "var(--sv-ink)",
};

const platformChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  border: "1px solid var(--sv-ink)",
};

const autoBadgeStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 8,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  padding: "2px 5px",
  background: "var(--sv-pink, #D262B2)",
  color: "var(--sv-ink)",
  border: "1px solid var(--sv-ink)",
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontFamily: "var(--sv-mono)",
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "2px 6px",
  background: "var(--sv-white)",
  border: "1px solid currentColor",
};

const contentStyle: React.CSSProperties = {
  fontFamily: "var(--sv-sans)",
  fontSize: 12,
  lineHeight: 1.45,
  margin: "0 0 6px",
  color: "var(--sv-ink)",
};

const mediaThumbStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 5",
  objectFit: "cover",
  border: "1.5px solid var(--sv-ink)",
};

const mediaMoreStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--sv-paper)",
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-display)",
  fontSize: 14,
  aspectRatio: "4 / 5",
};

const errBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: "rgba(201, 79, 59, 0.08)",
  border: "1.5px solid #C94F3B",
  fontSize: 11,
  fontFamily: "var(--sv-sans)",
  color: "#7a2a1a",
};

const rescheduleBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  background: "var(--sv-paper)",
  border: "1.5px solid var(--sv-ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  border: "1.5px solid var(--sv-ink)",
  fontSize: 12,
  fontFamily: "var(--sv-sans)",
  background: "var(--sv-white)",
};

const miniBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 9,
  letterSpacing: "0.12em",
  flex: "0 0 auto",
};
