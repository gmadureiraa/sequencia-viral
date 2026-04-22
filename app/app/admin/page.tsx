"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  RefreshCw,
  Users,
  Zap,
  DollarSign,
  Image as ImageIcon,
  Activity,
  CreditCard,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import AnalyticsTab from "./AnalyticsTab";
import { BarChart3 } from "lucide-react";

/**
 * Painel admin. Acessível apenas pra emails em ADMIN_EMAILS (server-side
 * guard em lib/server/auth.ts). Estrutura em 5 abas:
 *
 *  - Overview: KPIs + série diária + breakdown por tipo de prompt
 *  - Usuários: tabela com busca e link pra detalhe
 *  - Gerações: tabela com filtros
 *  - APIs: status env var + último uso por provider
 *  - Assinaturas: MRR, payments, falhas
 */

const ADMIN_EMAILS = ["gf.madureiraa@gmail.com", "gf.madureira@hotmail.com"];

type TabId =
  | "overview"
  | "analytics"
  | "users"
  | "generations"
  | "apis"
  | "subscriptions"
  | "feedback";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Activity size={13} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={13} /> },
  { id: "users", label: "Usuários", icon: <Users size={13} /> },
  { id: "generations", label: "Gerações", icon: <Zap size={13} /> },
  { id: "feedback", label: "Feedback", icon: <ThumbsUp size={13} /> },
  { id: "apis", label: "APIs", icon: <DollarSign size={13} /> },
  {
    id: "subscriptions",
    label: "Assinaturas",
    icon: <CreditCard size={13} />,
  },
];

// ───────────────────────────────── types ─────────────────────────────────

interface UserStats {
  carousels: number;
  generations: number;
  cost: number;
  tokens: number;
  payments: number;
  ltv: number;
}

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  usage_count: number | null;
  usage_limit: number | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stats: UserStats;
}

interface GenerationRow {
  id: string;
  user_id: string | null;
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
  user_id: string | null;
  amount_usd: number | string | null;
  currency: string | null;
  method: string | null;
  status: string | null;
  plan: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
}

interface AdminStats {
  summary: {
    totalUsers: number;
    completedOnboarding: number;
    planCounts: Record<string, number>;
    totalGenerations: number;
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCarousels: number;
    carouselStatus: Record<string, number>;
  };
  providerBreakdown: Record<
    string,
    { count: number; cost: number; tokens: number; lastUsedAt?: string }
  >;
  typeBreakdown: Record<
    string,
    { count: number; cost: number; tokens: number }
  >;
  dailySeries: Array<{ date: string; count: number; cost: number }>;
  users: UserRow[];
  recentGenerations: GenerationRow[];
  subscriptions: {
    activePaidCount: number;
    mrrUsd: number;
    mrrBrl: number; // retrocompat — mesmo valor que mrrUsd hoje
    totalRevenueUsd: number;
    failedIn30d: number;
    recentPayments: PaymentRow[];
  };
  apiHealth: Record<string, "SET" | "MISSING">;
  apiLastUsed: Record<string, string | null>;
  feedback?: {
    totalWithFeedback: number;
    up: number;
    down: number;
    satisfactionPct: number | null;
    recent: Array<{
      carouselId: string;
      userId: string | null;
      title: string | null;
      sentiment: "up" | "down" | null;
      comment: string;
      updatedAt: string | null;
    }>;
  };
  /** Erros por query Supabase (nullish quando tudo OK). */
  queryErrors?: Record<string, string>;
  generatedAt: string;
}

// ───────────────────────────────── utils ─────────────────────────────────

/**
 * Coerção segura pra string — evita "[object Object]" em renders quando
 * o campo veio como objeto por schema drift, OAuth metadata estranho,
 * ou user extension. Null/undefined viram fallback. Objetos viram "—".
 */
function safeStr(v: unknown, fallback = "—"): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Array ou objeto: não renderiza cru.
  return fallback;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMrr(usd: number): string {
  // MRR em USD (Stripe charge currency) + conversão BRL pra contexto.
  const brl = usd * 5; // taxa aproximada 1 USD ≈ R$ 5
  return `$${usd.toFixed(2)} · ~R$ ${brl.toFixed(0)}`;
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

function parseCost(c: number | string | null | undefined): number {
  const n = typeof c === "string" ? parseFloat(c) : c ?? 0;
  return Number.isFinite(n) ? n : 0;
}

// ───────────────────────────────── page ──────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, profile, session, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabFromUrl = search?.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabFromUrl && TABS.some((t) => t.id === tabFromUrl)
      ? tabFromUrl
      : "overview"
  );

  function setTab(t: TabId) {
    setActiveTab(t);
    router.replace(`/app/admin?tab=${t}`, { scroll: false });
  }

  // Gate: usar user.email direto (Supabase auth) em vez de profile.email.
  // profile pode demorar ou falhar (RLS, schema drift, coluna nulada), e o
  // server-side gate (requireAdmin) também compara contra auth.user.email —
  // manter em sync evita falso-negativo que trava o admin em "Sem acesso".
  const isAdmin = useMemo(() => {
    const emailFromUser = user?.email?.toLowerCase().trim();
    const emailFromProfile = profile?.email?.toLowerCase().trim();
    const email = emailFromUser || emailFromProfile;
    return email ? ADMIN_EMAILS.includes(email) : false;
  }, [user, profile]);

  useEffect(() => {
    if (loading) return;
    // Redirect só quando temos CERTEZA que não é admin: user carregado +
    // email não bate na lista. Sem user ainda → aguarda (auth-context
    // pode estar populando em paralelo ao profile).
    if (!user) return;
    if (!isAdmin) router.replace("/app");
  }, [loading, user, isAdmin, router]);

  const load = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "GET",
        headers: jsonWithAuth(session),
      });
      // Parse defensivo: se resposta não for JSON (ex: HTML de erro 500
      // nativo do Next), não explode — converte em erro legível.
      const text = await res.text();
      let data: { error?: string } & Partial<AdminStats> = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Resposta inválida do servidor (HTTP ${res.status}). ${text.slice(0, 120)}`
        );
      }
      if (!res.ok) throw new Error(data.error || `Falha ao carregar (HTTP ${res.status})`);
      setStats(data as AdminStats);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar";
      console.error("[admin] load falhou:", msg);
      setError(msg);
    } finally {
      setFetching(false);
    }
  }, [session]);

  // Dispara load assim que isAdmin + session estão prontos. Evita o efeito
  // re-disparar toda vez que `load` (useCallback sobre session) muda — o
  // `load` já depende de session internamente, então basta reagir a session.
  useEffect(() => {
    if (isAdmin && session) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token]);

  // Estado "aguardando sessão" — evita flash de tela branca quando o
  // AuthProvider ainda está inicializando.
  if (loading || (!user && !profile)) {
    return (
      <div className="mx-auto max-w-[600px] py-12 text-center">
        <Loader2
          size={18}
          className="animate-spin inline-block"
          style={{ color: "var(--sv-ink)" }}
        />
        <p
          className="mt-3"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          Carregando sessão
        </p>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1200 }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="sv-eyebrow">
            <span className="sv-dot" /> Nº 00 · Admin · Controle
          </span>
          <h1
            className="sv-display mt-3"
            style={{
              fontSize: "clamp(26px, 4vw, 42px)",
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            Painel <em>admin</em>.
          </h1>
          <p className="mt-2" style={{ color: "var(--sv-muted)", fontSize: 13.5 }}>
            {stats?.generatedAt && (
              <>
                Última leitura:{" "}
                <span style={{ color: "var(--sv-ink)" }}>
                  {fmtDate(stats.generatedAt)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/admin/source-test"
            className="sv-btn sv-btn-outline"
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Source Debug
          </Link>
          <Link
            href="/app/admin/batch-test"
            className="sv-btn sv-btn-outline"
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Batch Test
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={fetching}
            className="sv-btn sv-btn-outline"
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              opacity: fetching ? 0.5 : 1,
            }}
          >
            {fetching ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mt-6 flex flex-wrap gap-1.5"
        style={{
          borderBottom: "1.5px solid var(--sv-ink)",
          paddingBottom: 0,
        }}
      >
        {TABS.map((t) => {
          const on = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="uppercase"
              style={{
                padding: "9px 14px",
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.16em",
                fontWeight: 700,
                border: "1.5px solid var(--sv-ink)",
                borderBottom: on ? "1.5px solid var(--sv-white)" : "1.5px solid var(--sv-ink)",
                background: on ? "var(--sv-white)" : "var(--sv-paper)",
                color: "var(--sv-ink)",
                marginBottom: -1.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="mt-4 p-3"
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

      {stats?.queryErrors && (
        <div
          className="mt-4 p-3"
          style={{
            border: "1.5px solid #c94f3b",
            background: "#fff8e5",
            color: "#7a2a1a",
            fontFamily: "var(--sv-sans)",
            fontSize: 12,
          }}
        >
          <strong>Alguns dados vieram parciais:</strong>{" "}
          {Object.entries(stats.queryErrors)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}
        </div>
      )}

      {!stats && fetching && (
        <div className="mt-10 text-center">
          <Loader2
            size={24}
            className="animate-spin"
            style={{ color: "var(--sv-ink)" }}
          />
        </div>
      )}

      {stats && (
        <div className="mt-6">
          {activeTab === "overview" && <OverviewTab stats={stats} />}
          {activeTab === "analytics" && <AnalyticsTab session={session} />}
          {activeTab === "users" && <UsersTab stats={stats} />}
          {activeTab === "generations" && <GenerationsTab stats={stats} />}
          {activeTab === "feedback" && <FeedbackTab stats={stats} />}
          {activeTab === "apis" && <ApisTab stats={stats} />}
          {activeTab === "subscriptions" && <SubscriptionsTab stats={stats} />}
        </div>
      )}
    </motion.div>
  );
}

// ───────────────────────────────── Overview ─────────────────────────────

function OverviewTab({ stats }: { stats: AdminStats }) {
  // Fallbacks defensivos: se o endpoint devolveu stats parciais (ex: uma
  // query Supabase falhou e veio `queryErrors`), os campos aninhados
  // podem estar vazios. Nunca acessar direto sem default.
  const dailySeries = stats.dailySeries ?? [];
  const typeBreakdown = stats.typeBreakdown ?? {};
  const carouselStatus = stats.summary?.carouselStatus ?? {};
  const planCounts = stats.summary?.planCounts ?? {};
  const maxDaily = Math.max(...dailySeries.map((d) => d.count), 1);

  return (
    <>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        <StatCard
          icon={<Users size={14} />}
          label="Usuários"
          value={fmtNum(stats.summary.totalUsers)}
          sub={`${stats.summary.completedOnboarding} completaram onboarding`}
        />
        <StatCard
          icon={<TrendingUp size={14} />}
          label="MRR"
          value={fmtMrr(stats.subscriptions.mrrUsd ?? stats.subscriptions.mrrBrl)}
          sub={`${stats.subscriptions.activePaidCount} pagantes ativos`}
        />
        <StatCard
          icon={<Zap size={14} />}
          label="Gerações"
          value={fmtNum(stats.summary.totalGenerations)}
          sub={`${fmtNum(stats.summary.totalInputTokens + stats.summary.totalOutputTokens)} tokens`}
        />
        <StatCard
          icon={<DollarSign size={14} />}
          label="Custo API · histórico"
          value={fmtUsd(stats.summary.totalCostUsd)}
          sub="Gemini + Imagen + Claude (inclui seus testes próprios)"
        />
        <StatCard
          icon={<ImageIcon size={14} strokeWidth={1.8} aria-hidden />}
          label="Carrosséis"
          value={fmtNum(stats.summary.totalCarousels)}
          sub={
            Object.entries(carouselStatus)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ") || "—"
          }
        />
        <StatCard
          icon={<CreditCard size={14} />}
          label="Churn 30d"
          value={String(stats.subscriptions.failedIn30d)}
          sub="Pagamentos falhados"
        />
      </div>

      {/* Daily series */}
      <section className="mt-8">
        <SectionLabel>Gerações por dia · últimos 14 dias</SectionLabel>
        <div
          style={{
            padding: 18,
            background: "var(--sv-white)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
          }}
        >
          <div
            className="flex items-end gap-1"
            style={{ height: 120 }}
          >
            {dailySeries.map((d) => {
              const pct = (d.count / maxDaily) * 100;
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count} gerações · ${fmtUsd(d.cost)}`}
                  style={{
                    flex: "1 1 0",
                    height: `${Math.max(pct, 2)}%`,
                    background: "var(--sv-green)",
                    border: "1.5px solid var(--sv-ink)",
                    minWidth: 10,
                  }}
                />
              );
            })}
          </div>
          <div
            className="mt-2 flex justify-between"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              color: "var(--sv-muted)",
              letterSpacing: "0.12em",
            }}
          >
            <span>{dailySeries[0]?.date?.slice(5)}</span>
            <span>{dailySeries[dailySeries.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      </section>

      {/* Breakdown por tipo */}
      <section className="mt-8">
        <SectionLabel>Custo por tipo de prompt</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
          {Object.entries(typeBreakdown)
            .sort(([, a], [, b]) => b.cost - a.cost)
            .map(([t, data]) => (
              <div
                key={t}
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
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    color: "var(--sv-muted)",
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {t}
                </div>
                <div
                  className="italic"
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 22,
                    lineHeight: 1,
                    color: "var(--sv-ink)",
                  }}
                >
                  {data.count}
                </div>
                <div
                  className="mt-1"
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 12,
                    color: "var(--sv-ink)",
                  }}
                >
                  {fmtUsd(data.cost)} · {fmtNum(data.tokens)} tok
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Planos */}
      <section className="mt-8">
        <SectionLabel>Distribuição de planos</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {Object.entries(planCounts).map(([plan, count]) => (
            <span
              key={plan}
              className="uppercase"
              style={{
                padding: "8px 14px",
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.16em",
                fontWeight: 700,
                border: "1.5px solid var(--sv-ink)",
                background:
                  plan === "free"
                    ? "var(--sv-paper)"
                    : plan === "pro"
                      ? "var(--sv-green)"
                      : "var(--sv-pink)",
                color: "var(--sv-ink)",
              }}
            >
              {plan} · {count}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}

// ───────────────────────────────── Users ───────────────────────────────

function UsersTab({ stats }: { stats: AdminStats }) {
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"ltv" | "cost" | "recent">("recent");

  const filtered = useMemo(() => {
    let rows = stats.users;
    if (planFilter !== "all") {
      rows = rows.filter((u) => (u.plan || "free") === planFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((u) =>
        [u.email, u.name, u.instagram_handle, u.twitter_handle]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      );
    }
    const sorted = [...rows];
    if (sortBy === "ltv") sorted.sort((a, b) => b.stats.ltv - a.stats.ltv);
    if (sortBy === "cost") sorted.sort((a, b) => b.stats.cost - a.stats.cost);
    if (sortBy === "recent") {
      sorted.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    }
    return sorted;
  }, [stats.users, query, planFilter, sortBy]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por email, nome, handle..."
          className="sv-input"
          style={{ padding: "7px 10px", fontSize: 12, minWidth: 260 }}
        />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="sv-input"
          style={{ padding: "7px 10px", fontSize: 12 }}
        >
          <option value="all">Todos os planos</option>
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="business">business</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "ltv" | "cost" | "recent")}
          className="sv-input"
          style={{ padding: "7px 10px", fontSize: 12 }}
        >
          <option value="recent">Mais recentes</option>
          <option value="ltv">Maior LTV</option>
          <option value="cost">Maior custo API</option>
        </select>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
            fontWeight: 700,
          }}
        >
          {filtered.length} resultado(s)
        </span>
      </div>
      <div
        style={{
          background: "var(--sv-white)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
          overflow: "auto",
          maxHeight: 600,
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
              <Th>Usuário</Th>
              <Th>Email</Th>
              <Th>Plano</Th>
              <Th align="right">Uso</Th>
              <Th align="right">Carrosséis</Th>
              <Th align="right">Gerações</Th>
              <Th align="right">Custo API</Th>
              <Th align="right">LTV</Th>
              <Th>Criado</Th>
              <Th>Ação</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                style={{ borderTop: "1px solid rgba(10,10,10,0.08)" }}
              >
                <Td>
                  <div style={{ fontWeight: 700 }}>{safeStr(u.name)}</div>
                  <div
                    className="uppercase"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      color: "var(--sv-muted)",
                    }}
                  >
                    {typeof u.instagram_handle === "string" && u.instagram_handle
                      ? `@${u.instagram_handle}`
                      : typeof u.twitter_handle === "string" && u.twitter_handle
                        ? `@${u.twitter_handle}`
                        : "sem handle"}
                  </div>
                </Td>
                <Td>{safeStr(u.email)}</Td>
                <Td>
                  <PlanBadge plan={u.plan} />
                </Td>
                <Td align="right">
                  {u.usage_count ?? 0}/{u.usage_limit ?? "?"}
                </Td>
                <Td align="right">{u.stats.carousels}</Td>
                <Td align="right">{u.stats.generations}</Td>
                <Td align="right">{fmtUsd(u.stats.cost)}</Td>
                <Td align="right">
                  {u.stats.ltv > 0 ? `$${u.stats.ltv.toFixed(2)}` : "—"}
                </Td>
                <Td>{fmtDate(u.created_at)}</Td>
                <Td>
                  <Link
                    href={`/app/admin/users/${u.id}`}
                    className="uppercase"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      fontWeight: 700,
                      color: "var(--sv-ink)",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    Detalhe →
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────────────────────────────── Generations ────────────────────────────

function GenerationsTab({ stats }: { stats: AdminStats }) {
  const [providerFilter, setProviderFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    return stats.recentGenerations.filter((g) => {
      if (providerFilter !== "all" && g.provider !== providerFilter) return false;
      if (typeFilter !== "all" && g.prompt_type !== typeFilter) return false;
      return true;
    });
  }, [stats.recentGenerations, providerFilter, typeFilter]);

  const totalCost = filtered.reduce((a, g) => a + parseCost(g.cost_usd), 0);
  const totalTokens = filtered.reduce(
    (a, g) => a + (g.input_tokens ?? 0) + (g.output_tokens ?? 0),
    0
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="sv-input"
          style={{ padding: "7px 10px", fontSize: 12 }}
        >
          <option value="all">Todos providers</option>
          <option value="google">google</option>
          <option value="anthropic">anthropic</option>
          <option value="openai">openai</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="sv-input"
          style={{ padding: "7px 10px", fontSize: 12 }}
        >
          <option value="all">Todos tipos</option>
          {Object.keys(stats.typeBreakdown).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
            fontWeight: 700,
          }}
        >
          {filtered.length} linhas · {fmtUsd(totalCost)} · {fmtNum(totalTokens)} tok
        </span>
      </div>
      <div
        style={{
          background: "var(--sv-white)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
          overflow: "auto",
          maxHeight: 600,
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
              <Th>Usuário</Th>
              <Th>Provider</Th>
              <Th>Modelo</Th>
              <Th>Tipo</Th>
              <Th align="right">In</Th>
              <Th align="right">Out</Th>
              <Th align="right">Custo</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr
                key={g.id}
                style={{ borderTop: "1px solid rgba(10,10,10,0.08)" }}
              >
                <Td>{fmtDate(g.created_at)}</Td>
                <Td>
                  {g.user_id ? (
                    <Link
                      href={`/app/admin/users/${g.user_id}`}
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 10,
                        color: "var(--sv-ink)",
                        textDecoration: "underline",
                      }}
                    >
                      {g.user_id.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>{safeStr(g.provider)}</Td>
                <Td>{safeStr(g.model)}</Td>
                <Td>{safeStr(g.prompt_type)}</Td>
                <Td align="right">{g.input_tokens ?? 0}</Td>
                <Td align="right">{g.output_tokens ?? 0}</Td>
                <Td align="right">{fmtUsd(parseCost(g.cost_usd))}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────────────────────────────── APIs ──────────────────────────────────

function ApisTab({ stats }: { stats: AdminStats }) {
  const apis: {
    name: string;
    envKeys: string[];
    provider?: string;
    desc: string;
  }[] = [
    {
      name: "Gemini (Google)",
      envKeys: ["GEMINI_API_KEY"],
      provider: "google",
      desc: "Geração de texto (carrossel, caption, concepts) + Vision + Imagen 4",
    },
    {
      name: "Claude (Anthropic)",
      envKeys: ["ANTHROPIC_API_KEY"],
      provider: "anthropic",
      desc: "Análise de marca (brand-analysis) baseada em posts",
    },
    {
      name: "Supabase",
      envKeys: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      desc: "Banco + auth + storage de imagens geradas",
    },
    {
      name: "Stripe",
      envKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      provider: "stripe",
      desc: "Checkout, subscriptions, webhook",
    },
    {
      name: "Resend",
      envKeys: ["RESEND_API_KEY"],
      desc: "Emails transacionais (boas-vindas, pagamento, drip)",
    },
    {
      name: "Apify",
      envKeys: ["APIFY_API_KEY"],
      desc: "Scraping Instagram (perfil + carrossel)",
    },
    {
      name: "Serper",
      envKeys: ["SERPER_API_KEY"],
      desc: "Busca de imagens (fallback pra Imagen)",
    },
    {
      name: "Supadata",
      envKeys: ["SUPADATA_API_KEY"],
      desc: "Transcrição de áudio IG Reels (fallback)",
    },
    {
      name: "Cron secret",
      envKeys: ["CRON_SECRET"],
      desc: "Token pra crons Vercel (usage-reset, drip, etc)",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {apis.map((api) => {
        const allSet = api.envKeys.every(
          (k) =>
            stats.apiHealth[k] === "SET" ||
            stats.apiHealth[k.replace("NEXT_PUBLIC_", "")] === "SET"
        );
        const lastUsed = api.provider
          ? stats.apiLastUsed[api.provider]
          : null;

        return (
          <div
            key={api.name}
            style={{
              padding: 16,
              background: allSet ? "var(--sv-white)" : "#fdf0ed",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 20,
                    lineHeight: 1.1,
                    color: "var(--sv-ink)",
                  }}
                >
                  {api.name}
                </div>
                <div
                  className="mt-0.5"
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 12,
                    color: "var(--sv-muted)",
                  }}
                >
                  {api.desc}
                </div>
              </div>
              <span
                className="uppercase"
                style={{
                  padding: "3px 8px",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  fontWeight: 700,
                  border: "1.5px solid var(--sv-ink)",
                  background: allSet ? "var(--sv-green)" : "#c94f3b",
                  color: allSet ? "var(--sv-ink)" : "var(--sv-paper)",
                }}
              >
                {allSet ? "Ativa" : "Faltando"}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-1">
              {api.envKeys.map((k) => (
                <div
                  key={k}
                  className="flex items-center justify-between"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.12em",
                    color: "var(--sv-ink)",
                  }}
                >
                  <span>{k}</span>
                  <span
                    className="uppercase"
                    style={{
                      fontWeight: 700,
                      color:
                        stats.apiHealth[k] === "SET"
                          ? "#2c7a1f"
                          : "#7a2a1a",
                    }}
                  >
                    {stats.apiHealth[k] ?? "—"}
                  </span>
                </div>
              ))}
            </div>

            {lastUsed && (
              <div
                className="mt-3 uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  color: "var(--sv-muted)",
                  fontWeight: 700,
                }}
              >
                Último uso: {fmtDate(lastUsed)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────────── Subscriptions ────────────────────────

function SubscriptionsTab({ stats }: { stats: AdminStats }) {
  return (
    <>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        <StatCard
          icon={<TrendingUp size={14} />}
          label="MRR"
          value={fmtMrr(stats.subscriptions.mrrUsd ?? stats.subscriptions.mrrBrl)}
          sub={`${stats.subscriptions.activePaidCount} assinantes`}
        />
        <StatCard
          icon={<DollarSign size={14} />}
          label="Revenue total"
          value={`$${stats.subscriptions.totalRevenueUsd.toFixed(2)}`}
          sub="Pagamentos confirmados"
        />
        <StatCard
          icon={<CreditCard size={14} />}
          label="Falhas 30d"
          value={String(stats.subscriptions.failedIn30d)}
          sub="Pagamentos rejeitados"
        />
      </div>

      <section className="mt-8">
        <SectionLabel>Últimos pagamentos</SectionLabel>
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
                <Th>Usuário</Th>
                <Th>Plano</Th>
                <Th>Método</Th>
                <Th align="right">Valor</Th>
                <Th>Status</Th>
                <Th>Período</Th>
              </tr>
            </thead>
            <tbody>
              {stats.subscriptions.recentPayments.map((p) => (
                <tr
                  key={p.id}
                  style={{ borderTop: "1px solid rgba(10,10,10,0.08)" }}
                >
                  <Td>{fmtDate(p.created_at)}</Td>
                  <Td>
                    {p.user_id ? (
                      <Link
                        href={`/app/admin/users/${p.user_id}`}
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 10,
                          color: "var(--sv-ink)",
                          textDecoration: "underline",
                        }}
                      >
                        {p.user_id.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <PlanBadge plan={p.plan} />
                  </Td>
                  <Td>{safeStr(p.method)}</Td>
                  <Td align="right">
                    {p.amount_usd
                      ? `${safeStr(p.currency, "USD")} ${parseCost(p.amount_usd).toFixed(2)}`
                      : "—"}
                  </Td>
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                  <Td>
                    {p.period_start
                      ? `${fmtDate(p.period_start).slice(0, 8)} →`
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ───────────────────────────────── bits ─────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase mb-3"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 10.5,
        letterSpacing: "0.18em",
        color: "var(--sv-muted)",
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "3px 3px 0 0 var(--sv-ink)",
      }}
    >
      <div
        className="flex items-center gap-1.5 uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        className="italic"
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 28,
          lineHeight: 1,
          color: "var(--sv-ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.12em",
          color: "var(--sv-muted)",
          textTransform: "uppercase",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = typeof plan === "string" && plan ? plan : "free";
  return (
    <span
      className="uppercase"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9,
        letterSpacing: "0.14em",
        fontWeight: 700,
        padding: "2px 6px",
        background:
          p === "pro"
            ? "var(--sv-green)"
            : p === "business"
              ? "var(--sv-pink)"
              : "var(--sv-soft)",
        color: "var(--sv-ink)",
      }}
    >
      {p}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = typeof status === "string" && status ? status : "—";
  const color =
    s === "confirmed"
      ? "#2c7a1f"
      : s === "failed"
        ? "#7a2a1a"
        : "var(--sv-muted)";
  return (
    <span
      className="uppercase"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9,
        letterSpacing: "0.14em",
        fontWeight: 700,
        color,
      }}
    >
      {s}
    </span>
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

// ─────────────────────────────── FeedbackTab ────────────────────────────────

function FeedbackTab({ stats }: { stats: AdminStats }) {
  const fb = stats.feedback;
  if (!fb) {
    return (
      <div
        className="rounded-xl border border-dashed p-10 text-center"
        style={{
          borderColor: "var(--sv-muted)",
          color: "var(--sv-muted)",
        }}
      >
        Sem dados de feedback ainda. Quando usuários avaliarem carrosséis no
        app, aparece aqui.
      </div>
    );
  }

  const userEmailById = new Map<string, string | null>();
  for (const u of stats.users) userEmailById.set(u.id, u.email);

  const satisfaction = fb.satisfactionPct;
  const satisfactionColor =
    satisfaction === null
      ? "var(--sv-muted)"
      : satisfaction >= 70
        ? "var(--sv-green)"
        : satisfaction >= 40
          ? "#E8A94F"
          : "#E06B6B";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          icon={<Activity size={13} />}
          label="Total avaliados"
          value={String(fb.totalWithFeedback)}
          sub={`${fb.recent.length} com comentário`}
        />
        <StatCard
          icon={<ThumbsUp size={13} />}
          label="Positivos"
          value={String(fb.up)}
          sub={fb.totalWithFeedback > 0 ? `${Math.round((fb.up / fb.totalWithFeedback) * 100)}% do total` : "—"}
        />
        <StatCard
          icon={<ThumbsDown size={13} />}
          label="Negativos"
          value={String(fb.down)}
          sub={fb.totalWithFeedback > 0 ? `${Math.round((fb.down / fb.totalWithFeedback) * 100)}% do total` : "—"}
        />
        <div
          className="flex flex-col gap-1 rounded-xl border p-4"
          style={{
            borderColor: "var(--sv-ink)",
            background: "var(--sv-white)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            Satisfação
          </span>
          <span
            className="sv-display"
            style={{
              fontSize: 32,
              fontStyle: "italic",
              color: satisfactionColor,
              lineHeight: 1,
            }}
          >
            {satisfaction === null ? "—" : `${satisfaction}%`}
          </span>
          <span style={{ fontSize: 11, color: "var(--sv-muted)" }}>
            👍 ÷ (👍 + 👎)
          </span>
        </div>
      </div>

      <div
        className="rounded-xl border"
        style={{
          borderColor: "var(--sv-ink)",
          background: "var(--sv-white)",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1.5px solid var(--sv-ink)" }}
        >
          <strong
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Últimos {fb.recent.length} com feedback
          </strong>
          <span style={{ fontSize: 11, color: "var(--sv-muted)" }}>
            Clique no título pra abrir o carrossel
          </span>
        </div>
        {fb.recent.length === 0 ? (
          <div className="p-6 text-center" style={{ color: "var(--sv-muted)" }}>
            Nenhum feedback ainda.
          </div>
        ) : (
          <ul className="flex flex-col">
            {fb.recent.map((entry, i) => {
              const email = entry.userId
                ? userEmailById.get(entry.userId)
                : null;
              return (
                <li
                  key={`${entry.carouselId}-${i}`}
                  className="flex flex-col gap-2 px-4 py-3"
                  style={{
                    borderBottom:
                      i < fb.recent.length - 1
                        ? "1px solid var(--sv-soft)"
                        : undefined,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    {entry.sentiment === "up" ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: "var(--sv-green)", fontSize: 14 }}
                      >
                        <ThumbsUp size={14} />
                        Bom
                      </span>
                    ) : entry.sentiment === "down" ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: "#E06B6B", fontSize: 14 }}
                      >
                        <ThumbsDown size={14} />
                        Ruim
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--sv-muted)" }}>
                        Sem voto
                      </span>
                    )}
                    {entry.carouselId ? (
                      <Link
                        href={`/app/create/${entry.carouselId}/edit`}
                        className="truncate text-sm hover:underline"
                        style={{ color: "var(--sv-ink)", fontWeight: 600 }}
                      >
                        {entry.title || "Sem título"}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 13 }}>
                        {entry.title || "Sem título"}
                      </span>
                    )}
                    <span
                      className="ml-auto"
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 10,
                        color: "var(--sv-muted)",
                      }}
                    >
                      {fmtDate(entry.updatedAt)}
                    </span>
                  </div>
                  {entry.comment && (
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--sv-ink)",
                        margin: 0,
                        paddingLeft: 4,
                        borderLeft: "2px solid var(--sv-soft)",
                        paddingInlineStart: 10,
                      }}
                    >
                      {entry.comment}
                    </p>
                  )}
                  {email && (
                    <span
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 10,
                        color: "var(--sv-muted)",
                      }}
                    >
                      {email}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
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
