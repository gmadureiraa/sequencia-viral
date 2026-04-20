"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  DollarSign,
  Zap,
  Image as ImageIcon,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";

const ADMIN_EMAILS = ["gf.madureiraa@gmail.com", "gf.madureira@hotmail.com"];

// ─────────────────────────── types ───────────────────────────

interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  instagram_handle: string | null;
  linkedin_url: string | null;
  niche: string[] | null;
  tone: string | null;
  language: string | null;
  carousel_style: string | null;
  plan: string | null;
  usage_count: number | null;
  usage_limit: number | null;
  onboarding_completed: boolean | null;
  brand_analysis: Record<string, unknown> | null;
  brand_colors: string[] | null;
  brand_image_refs: string[] | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CarouselSlim {
  id: string;
  title: string | null;
  status: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  slide_count: number;
  first_slide: { heading: string | null; body: string | null } | null;
}

interface GenerationRow {
  id: string;
  model: string | null;
  provider: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | string | null;
  prompt_type: string | null;
  created_at: string | null;
}

interface PaymentRow {
  id: string;
  amount_usd: number | string | null;
  currency: string | null;
  method: string | null;
  status: string | null;
  plan: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
  tx_hash: string | null;
}

interface UserDetail {
  profile: Profile;
  carousels: CarouselSlim[];
  generations: GenerationRow[];
  payments: PaymentRow[];
  totals: {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalGenerations: number;
    totalCarousels: number;
    ltv: number;
  };
}

// ─────────────────────────── utils ───────────────────────────

function parseCost(c: number | string | null | undefined): number {
  const n = typeof c === "string" ? parseFloat(c) : c ?? 0;
  return Number.isFinite(n) ? n : 0;
}

/** Coerção segura pra string — evita "[object Object]" em render. */
function safeStr(v: unknown, fallback = "—"): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

// ─────────────────────────── page ───────────────────────────

export default function AdminUserDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const router = useRouter();
  const { user, profile: me, session, loading } = useAuth();
  const [data, setData] = useState<UserDetail | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gate: usar user.email (Supabase auth) como fonte principal — profile
  // pode falhar de carregar. Mesma estratégia do /app/admin root.
  const isAdmin = useMemo(() => {
    const email =
      user?.email?.toLowerCase().trim() ||
      me?.email?.toLowerCase().trim();
    return email ? ADMIN_EMAILS.includes(email) : false;
  }, [user, me]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!isAdmin) router.replace("/app");
  }, [loading, user, isAdmin, router]);

  const load = useCallback(async () => {
    if (!session || !id) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "GET",
        headers: jsonWithAuth(session),
      });
      // Parse defensivo: servidor pode retornar HTML em erro fatal.
      const text = await res.text();
      let payload: { error?: string } & Partial<UserDetail> = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Resposta inválida do servidor (HTTP ${res.status}). ${text.slice(0, 120)}`
        );
      }
      if (!res.ok) throw new Error(payload.error || `Falha ao carregar (HTTP ${res.status})`);
      setData(payload as UserDetail);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar";
      console.error("[admin/user-detail] load falhou:", msg);
      setError(msg);
    } finally {
      setFetching(false);
    }
  }, [session, id]);

  useEffect(() => {
    if (isAdmin && session) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token, id]);

  // Loading / aguardando auth — evita flash de null (tela 100% branca).
  if (loading || (!user && !me)) {
    return (
      <div className="py-20 text-center">
        <Loader2
          size={20}
          className="animate-spin inline-block"
          style={{ color: "var(--sv-ink)" }}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[600px] py-12">
        <p style={{ fontFamily: "var(--sv-mono)", color: "var(--sv-muted)" }}>
          Sem acesso.
        </p>
      </div>
    );
  }

  if (fetching && !data) {
    return (
      <div className="py-20 text-center">
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: "var(--sv-ink)" }}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1200 }}
    >
      {/* Header */}
      <div className="mb-5">
        <Link
          href="/app/admin?tab=users"
          className="inline-flex items-center gap-2"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          <ArrowLeft size={13} />
          Voltar pra admin
        </Link>
      </div>

      {error && (
        <div
          className="mb-4 p-3"
          style={{
            border: "1.5px solid #c94f3b",
            background: "#fdf0ed",
            color: "#7a2a1a",
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          <ProfileHeader profile={data.profile} totals={data.totals} onReload={load} fetching={fetching} />
          <BrandSection profile={data.profile} />
          <VoiceSection profile={data.profile} />
          <CarouselsSection carousels={data.carousels} />
          <GenerationsSection generations={data.generations} />
          <PaymentsSection payments={data.payments} />
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────── ProfileHeader ───────────────────────────

function ProfileHeader({
  profile,
  totals,
  onReload,
  fetching,
}: {
  profile: Profile;
  totals: UserDetail["totals"];
  onReload: () => void;
  fetching: boolean;
}) {
  const handle =
    typeof profile.instagram_handle === "string" && profile.instagram_handle
      ? `@${profile.instagram_handle} · IG`
      : typeof profile.twitter_handle === "string" && profile.twitter_handle
        ? `@${profile.twitter_handle} · X`
        : "sem handle";
  const displayName = safeStr(profile.name, "Sem nome");
  const displayEmail = safeStr(profile.email, "sem email");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name || "avatar"}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "1.5px solid var(--sv-ink)",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "1.5px solid var(--sv-ink)",
                background: "var(--sv-pink)",
                fontFamily: "var(--sv-display)",
                fontStyle: "italic",
                fontSize: 28,
                color: "var(--sv-ink)",
              }}
            >
              {profile.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <h1
              className="sv-display"
              style={{
                fontSize: 34,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
              }}
            >
              {displayName}
            </h1>
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 14,
                color: "var(--sv-muted)",
              }}
            >
              {displayEmail} · {handle}
            </div>
            <div
              className="mt-1 uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.16em",
                color: "var(--sv-muted)",
                fontWeight: 700,
              }}
            >
              Criado {fmtDate(profile.created_at)} ·{" "}
              {profile.onboarding_completed
                ? "Onboarding OK"
                : "Onboarding pendente"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={fetching}
          className="sv-btn sv-btn-outline"
          style={{
            padding: "8px 12px",
            fontSize: 10,
            opacity: fetching ? 0.5 : 1,
          }}
        >
          {fetching ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <RefreshCw size={11} />
          )}
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div
        className="mt-6 grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        }}
      >
        <Stat label="Plano" value={safeStr(profile.plan, "free")} />
        <Stat
          label="Uso do mês"
          value={`${typeof profile.usage_count === "number" ? profile.usage_count : 0}/${typeof profile.usage_limit === "number" ? profile.usage_limit : "?"}`}
        />
        <Stat label="Carrosséis" value={String(totals.totalCarousels)} />
        <Stat label="Gerações" value={String(totals.totalGenerations)} />
        <Stat label="Custo API" value={fmtUsd(totals.totalCostUsd)} />
        <Stat
          label="LTV"
          value={totals.ltv > 0 ? `$${totals.ltv.toFixed(2)}` : "—"}
        />
      </div>
    </>
  );
}

// ─────────────────────────── BrandSection ───────────────────────────

function BrandSection({ profile }: { profile: Profile }) {
  const ba = (profile.brand_analysis ?? {}) as Record<string, unknown>;
  const aesthetic = (ba.__image_aesthetic as
    | { description?: string; palette?: string[]; keywords?: string[] }
    | undefined) ?? undefined;
  const refs = Array.isArray(profile.brand_image_refs)
    ? profile.brand_image_refs
    : [];
  const colors = Array.isArray(profile.brand_colors) ? profile.brand_colors : [];

  const hasAny =
    aesthetic?.description ||
    refs.length > 0 ||
    colors.length > 0;

  if (!hasAny) return null;

  return (
    <section className="mt-10">
      <SectionLabel icon={<Sparkles size={12} />}>Branding</SectionLabel>

      {colors.length > 0 && (
        <div className="mb-4">
          <SubLabel>Paleta</SubLabel>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <div
                key={c}
                style={{
                  width: 36,
                  height: 36,
                  background: c,
                  border: "1.5px solid var(--sv-ink)",
                }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {refs.length > 0 && (
        <div className="mb-4">
          <SubLabel>Referências visuais</SubLabel>
          <div className="flex flex-wrap gap-2">
            {refs.map((url, i) => (
              <div
                key={i}
                style={{
                  width: 120,
                  height: 120,
                  background: `url(${url}) center/cover`,
                  border: "1.5px solid var(--sv-ink)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {aesthetic?.description && (
        <div
          style={{
            padding: 14,
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-paper)",
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--sv-ink)",
          }}
        >
          <SubLabel>Estética destilada (prefix do Imagen)</SubLabel>
          {aesthetic.description}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── VoiceSection ───────────────────────────

function VoiceSection({ profile }: { profile: Profile }) {
  const ba = (profile.brand_analysis ?? {}) as Record<string, unknown>;
  const pillars = Array.isArray(ba.content_pillars)
    ? (ba.content_pillars as string[])
    : [];
  const audience = (ba.audience_description as string) || "";
  const samples = Array.isArray(ba.voice_samples)
    ? (ba.voice_samples as string[])
    : [];
  const tabus = Array.isArray(ba.tabus) ? (ba.tabus as string[]) : [];
  const rules = Array.isArray(ba.content_rules)
    ? (ba.content_rules as string[])
    : [];

  const hasAny =
    pillars.length > 0 ||
    audience ||
    samples.length > 0 ||
    tabus.length > 0 ||
    rules.length > 0;

  if (!hasAny) return null;

  return (
    <section className="mt-10">
      <SectionLabel>Voz IA</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2">
        {pillars.length > 0 && (
          <KV label="Pilares">
            <div className="flex flex-wrap gap-1.5">
              {pillars.map((p) => (
                <span key={p} className="sv-chip sv-chip-on">
                  {p}
                </span>
              ))}
            </div>
          </KV>
        )}
        {audience && (
          <KV label="Audiência">
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>{audience}</p>
          </KV>
        )}
        {tabus.length > 0 && (
          <KV label={`Tabus (${tabus.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {tabus.map((t) => (
                <span
                  key={t}
                  style={{
                    padding: "3px 8px",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    border: "1.5px solid var(--sv-ink)",
                    background: "var(--sv-pink)",
                    color: "var(--sv-ink)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </KV>
        )}
        {rules.length > 0 && (
          <KV label={`Regras (${rules.length})`}>
            <ul style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              {rules.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </KV>
        )}
      </div>
      {samples.length > 0 && (
        <div className="mt-4">
          <SubLabel>Exemplos de voz ({samples.length})</SubLabel>
          <div className="flex flex-col gap-3">
            {samples.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  border: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-white)",
                  fontFamily: "var(--sv-sans)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── CarouselsSection ──────────────────────

interface CarouselFull {
  id: string;
  title: string | null;
  status: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  style: Record<string, unknown> | null;
  slides: Array<{
    heading?: string;
    body?: string;
    imageUrl?: string;
    variant?: string;
  }> | null;
  source_url: string | null;
  source_text: string | null;
}

function CarouselsSection({ carousels }: { carousels: CarouselSlim[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (carousels.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionLabel icon={<ImageIcon size={12} strokeWidth={1.8} />}>
        Carrosséis ({carousels.length})
      </SectionLabel>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {carousels.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpenId(c.id)}
            className="text-left"
            style={{
              padding: 12,
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
              cursor: "pointer",
              transition: "transform .1s, box-shadow .1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(-1px,-1px)";
              e.currentTarget.style.boxShadow = "3px 3px 0 0 var(--sv-green)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "2px 2px 0 0 var(--sv-ink)";
            }}
          >
            <div
              className="uppercase mb-1"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.16em",
                color: "var(--sv-muted)",
                fontWeight: 700,
              }}
            >
              {c.status} · {c.slide_count} slides
            </div>
            <div
              style={{
                fontFamily: "var(--sv-display)",
                fontSize: 16,
                lineHeight: 1.2,
                color: "var(--sv-ink)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {c.title || c.first_slide?.heading || "Sem título"}
            </div>
            <div
              className="mt-2 uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 8.5,
                letterSpacing: "0.14em",
                color: "var(--sv-muted)",
              }}
            >
              {fmtDate(c.updated_at)} · Clique pra ver conteúdo
            </div>
          </button>
        ))}
      </div>
      {openId && <CarouselModal id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function CarouselModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { session } = useAuth();
  const [data, setData] = useState<CarouselFull | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) return;
      try {
        const res = await fetch(`/api/admin/carousels/${id}`, {
          headers: jsonWithAuth(session),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(json?.error || `HTTP ${res.status}`);
        if (!cancelled) setData(json.carousel as CarouselFull);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, session]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const style = (data?.style ?? {}) as Record<string, unknown>;
  const caption = typeof style.caption === "string" ? style.caption : null;
  const hashtags = Array.isArray(style.caption_hashtags)
    ? (style.caption_hashtags as string[])
    : [];
  const visualTemplate =
    typeof style.visual_template === "string" ? style.visual_template : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,10,0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 820,
          background: "var(--sv-white)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "6px 6px 0 0 var(--sv-ink)",
          padding: 24,
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div
              className="uppercase mb-1"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.16em",
                color: "var(--sv-muted)",
                fontWeight: 700,
              }}
            >
              Carrossel · {data?.status || "—"}
              {visualTemplate ? ` · ${visualTemplate}` : ""}
            </div>
            <h2
              className="sv-display"
              style={{
                fontSize: 26,
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
              }}
            >
              {data?.title || "Sem título"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sv-btn sv-btn-outline"
            style={{ padding: "6px 10px", fontSize: 10 }}
          >
            ✕ Fechar
          </button>
        </div>

        {fetching && (
          <div className="py-10 text-center">
            <Loader2
              size={18}
              className="animate-spin inline-block"
              style={{ color: "var(--sv-ink)" }}
            />
          </div>
        )}

        {err && (
          <div
            style={{
              padding: 12,
              border: "1.5px solid #c94f3b",
              background: "#fdf0ed",
              color: "#7a2a1a",
              fontSize: 13,
            }}
          >
            {err}
          </div>
        )}

        {data && !fetching && (
          <>
            {data.source_url && (
              <div
                className="mb-3"
                style={{
                  padding: 10,
                  background: "var(--sv-paper)",
                  border: "1.5px solid var(--sv-ink)",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 11,
                }}
              >
                Fonte:{" "}
                <a href={data.source_url} target="_blank" rel="noreferrer">
                  {data.source_url}
                </a>
              </div>
            )}

            {Array.isArray(data.slides) && data.slides.length > 0 && (
              <div className="flex flex-col gap-3 mb-5">
                {data.slides.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 14,
                      border: "1.5px solid var(--sv-ink)",
                      background: "var(--sv-paper)",
                    }}
                  >
                    <div
                      className="uppercase mb-2 flex items-center justify-between"
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        color: "var(--sv-muted)",
                        fontWeight: 700,
                      }}
                    >
                      <span>
                        Slide {i + 1}/{data.slides!.length}
                        {s.variant ? ` · ${s.variant}` : ""}
                      </span>
                      {s.imageUrl && (
                        <a
                          href={s.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--sv-muted)" }}
                        >
                          Imagem ↗
                        </a>
                      )}
                    </div>
                    {s.imageUrl && (
                      <img
                        src={s.imageUrl}
                        alt=""
                        style={{
                          width: "100%",
                          maxHeight: 200,
                          objectFit: "cover",
                          border: "1.5px solid var(--sv-ink)",
                          marginBottom: 10,
                        }}
                      />
                    )}
                    {s.heading && (
                      <div
                        style={{
                          fontFamily: "var(--sv-display)",
                          fontSize: 18,
                          lineHeight: 1.2,
                          marginBottom: 6,
                          color: "var(--sv-ink)",
                        }}
                      >
                        {s.heading}
                      </div>
                    )}
                    {s.body && (
                      <div
                        style={{
                          fontFamily: "var(--sv-sans)",
                          fontSize: 13,
                          lineHeight: 1.55,
                          color: "var(--sv-ink)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {s.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(caption || hashtags.length > 0) && (
              <div
                style={{
                  padding: 14,
                  border: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-green)",
                }}
              >
                <div
                  className="uppercase mb-2"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    fontWeight: 700,
                  }}
                >
                  Legenda + hashtags
                </div>
                {caption && (
                  <div
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 13,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      marginBottom: hashtags.length > 0 ? 8 : 0,
                    }}
                  >
                    {caption}
                  </div>
                )}
                {hashtags.length > 0 && (
                  <div
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 11,
                    }}
                  >
                    {hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                  </div>
                )}
              </div>
            )}

            {data.source_text && (
              <details className="mt-4">
                <summary
                  className="uppercase"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    color: "var(--sv-muted)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Texto original (source)
                </summary>
                <div
                  className="mt-2"
                  style={{
                    padding: 12,
                    background: "var(--sv-paper)",
                    border: "1.5px solid var(--sv-ink)",
                    fontFamily: "var(--sv-sans)",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {data.source_text}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Generations ──────────────────────

function GenerationsSection({ generations }: { generations: GenerationRow[] }) {
  if (generations.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionLabel icon={<Zap size={12} />}>
        Gerações ({generations.length})
      </SectionLabel>
      <div
        style={{
          background: "var(--sv-white)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
          overflow: "auto",
          maxHeight: 500,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--sv-sans)",
            fontSize: 12,
          }}
        >
          <thead
            style={{
              background: "var(--sv-paper)",
              position: "sticky",
              top: 0,
            }}
          >
            <tr>
              <Th>Quando</Th>
              <Th>Provider</Th>
              <Th>Modelo</Th>
              <Th>Tipo</Th>
              <Th align="right">Tokens</Th>
              <Th align="right">Custo</Th>
            </tr>
          </thead>
          <tbody>
            {generations.map((g) => (
              <tr
                key={g.id}
                style={{ borderTop: "1px solid rgba(10,10,10,0.08)" }}
              >
                <Td>{fmtDate(g.created_at)}</Td>
                <Td>{g.provider ?? "—"}</Td>
                <Td>{g.model ?? "—"}</Td>
                <Td>{g.prompt_type ?? "—"}</Td>
                <Td align="right">
                  {(g.input_tokens ?? 0) + (g.output_tokens ?? 0)}
                </Td>
                <Td align="right">{fmtUsd(parseCost(g.cost_usd))}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─────────────────────────── Payments ──────────────────────

function PaymentsSection({ payments }: { payments: PaymentRow[] }) {
  return (
    <section className="mt-10 mb-16">
      <SectionLabel icon={<CreditCard size={12} />}>
        Pagamentos ({payments.length})
      </SectionLabel>
      {payments.length === 0 ? (
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10.5,
            letterSpacing: "0.16em",
            color: "var(--sv-muted)",
          }}
        >
          Ainda não pagou nada.
        </p>
      ) : (
        <div
          style={{
            background: "var(--sv-white)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            overflow: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--sv-sans)",
              fontSize: 12,
            }}
          >
            <thead style={{ background: "var(--sv-paper)" }}>
              <tr>
                <Th>Quando</Th>
                <Th>Plano</Th>
                <Th>Método</Th>
                <Th align="right">Valor</Th>
                <Th>Status</Th>
                <Th>Período</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  style={{ borderTop: "1px solid rgba(10,10,10,0.08)" }}
                >
                  <Td>{fmtDate(p.created_at)}</Td>
                  <Td>{p.plan ?? "—"}</Td>
                  <Td>{p.method ?? "—"}</Td>
                  <Td align="right">
                    {p.amount_usd
                      ? `${p.currency ?? "USD"} ${parseCost(p.amount_usd).toFixed(2)}`
                      : "—"}
                  </Td>
                  <Td>{p.status ?? "—"}</Td>
                  <Td>{fmtDate(p.period_start).slice(0, 8)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── bits ───────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 14,
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--sv-muted)",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        className="italic mt-1"
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 24,
          lineHeight: 1,
          color: "var(--sv-ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-1.5 uppercase mb-3"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 10.5,
        letterSpacing: "0.18em",
        color: "var(--sv-muted)",
        fontWeight: 700,
      }}
    >
      {icon}
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase mb-2"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9,
        letterSpacing: "0.18em",
        color: "var(--sv-muted)",
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function KV({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 14,
        border: "1.5px solid var(--sv-ink)",
        background: "var(--sv-white)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <SubLabel>{label}</SubLabel>
      {children}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right" | "left";
}) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: align ?? "left",
        fontFamily: "var(--sv-mono)",
        fontSize: 9.5,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--sv-muted)",
        fontWeight: 700,
        borderBottom: "1.5px solid var(--sv-ink)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right" | "left";
}) {
  return (
    <td
      style={{
        padding: "10px 12px",
        textAlign: align ?? "left",
        color: "var(--sv-ink)",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
