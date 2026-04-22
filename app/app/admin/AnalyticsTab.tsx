"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Loader2, TrendingUp, Users, DollarSign, Activity } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Seção analytics avançada do /app/admin. Alimentada por
 * /api/admin/analytics com filtro de período.
 *
 * Gráficos:
 *  - Crescimento de usuários (area)
 *  - Carrosséis por dia (stacked bar por status)
 *  - Custos IA acumulados (stacked area por provider)
 *  - Custos por tipo de prompt (bar horizontal)
 *  - Distribuição por plano (pie)
 *  - Receita por dia (line)
 *  - Heatmap horário de criação
 *  - Top 10 users
 *  - Taxa de erro
 *  - Conversão free→pago (card)
 */

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "custom";

interface AnalyticsPayload {
  range: { key: string; from: string; to: string };
  totals: {
    users: number;
    usersInRange: number;
    carousels: number;
    revenueUsd: number;
    costUsd: number;
    generations: number;
  };
  userSignups: { date: string; count: number }[];
  carouselsByDay: {
    date: string;
    total: number;
    draft: number;
    published: number;
    archived: number;
  }[];
  costByDay: {
    date: string;
    google: number;
    anthropic: number;
    openai: number;
    other: number;
    total: number;
  }[];
  costByPromptType: { type: string; cost: number; count: number }[];
  planDistribution: { plan: string; count: number }[];
  revenueByDay: { date: string; usd: number }[];
  conversionRate: {
    freeViewedPaywall: number;
    upgradedInRange: number;
    pct: number;
  };
  topUsers: {
    id: string;
    email: string | null;
    name: string | null;
    plan: string;
    carousels: number;
    costUsd: number;
  }[];
  hourHeatmap: number[][];
  hourHeatmapMax: number;
  errorRate: { total: number; errors: number; pct: number };
  queryErrors?: Record<string, string>;
  generatedAt: string;
}

interface CostBreakdownPayload {
  range: { key: string; from: string; to: string };
  perPromptType: {
    type: string;
    calls: number;
    avgCostUsd: number;
    totalCostUsd: number;
    avgTokens: { in: number; out: number };
  }[];
  processes: {
    id: string;
    label: string;
    components: string[];
    avgCostUsd: number | null;
    missing?: string[];
  }[];
  topUsersByCost: {
    userId: string;
    name: string | null;
    email: string | null;
    plan: string;
    totalCostUsd: number;
    callCount: number;
  }[];
  usdBrlRate: number;
  queryErrors?: Record<string, string>;
  generatedAt: string;
}

const COLORS = {
  ink: "#0A0A0A",
  green: "#C8E87A",
  pink: "#F5B5C8",
  soft: "#E8E5DB",
  muted: "#6B6B6B",
  paper: "#F7F5EF",
  white: "#FFFFFF",
  google: "#4285F4",
  anthropic: "#D97757",
  openai: "#10A37F",
  other: "#B59BE0",
};

const PIE_COLORS = ["#C8E87A", "#F5B5C8", "#B59BE0", "#E8E5DB", "#FAD47A"];

function shortDate(iso: string): string {
  // "2026-04-22" -> "22/04"
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtUsd(n: number, digits = 2): string {
  return `$${n.toFixed(digits)}`;
}

/**
 * Normaliza o valor vindo do Recharts Tooltip formatter — pode ser
 * number, string ou array. Mantemos uma assinatura compatível com o
 * tipo `Formatter<ValueType, NameType>` (ValueType = string | number | Array<...>).
 */
function formatTooltipUsd(
  v: unknown,
  digits = 2
): [string, string] | string {
  const n = typeof v === "number" ? v : Number(v);
  return fmtUsd(Number.isFinite(n) ? n : 0, digits);
}

export default function AnalyticsTab({
  session,
}: {
  session: Session | null;
}) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [costBreakdown, setCostBreakdown] =
    useState<CostBreakdownPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("range", range);
      if (range === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }
      const t0 = performance.now();
      const [resA, resB] = await Promise.all([
        fetch(`/api/admin/analytics?${params.toString()}`, {
          method: "GET",
          headers: jsonWithAuth(session),
        }),
        fetch(`/api/admin/cost-breakdown?${params.toString()}`, {
          method: "GET",
          headers: jsonWithAuth(session),
        }),
      ]);

      // Parse analytics (mandatório — se falhar, erro)
      const textA = await resA.text();
      let payloadA: { error?: string } & Partial<AnalyticsPayload> = {};
      try {
        payloadA = textA ? JSON.parse(textA) : {};
      } catch {
        throw new Error(
          `Resposta inválida (HTTP ${resA.status}): ${textA.slice(0, 120)}`
        );
      }
      if (!resA.ok)
        throw new Error(payloadA.error || `Falha (HTTP ${resA.status})`);

      // Parse cost-breakdown (best-effort — não quebra a tab toda)
      const textB = await resB.text();
      let payloadB: { error?: string } & Partial<CostBreakdownPayload> = {};
      try {
        payloadB = textB ? JSON.parse(textB) : {};
      } catch {
        payloadB = { error: "resposta inválida" };
      }

      const dt = Math.round(performance.now() - t0);
      console.info(`[admin/analytics+cost] range=${range} took ${dt}ms`);
      if (dt > 2000) {
        console.warn(`[admin/analytics+cost] SLOW query ${dt}ms (>2s)`);
      }
      setData(payloadA as AnalyticsPayload);
      if (resB.ok) {
        setCostBreakdown(payloadB as CostBreakdownPayload);
      } else {
        setCostBreakdown(null);
        console.warn(
          `[admin/cost-breakdown] falhou HTTP ${resB.status}: ${payloadB.error || "?"}`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [session, range, customFrom, customTo]);

  useEffect(() => {
    if (range !== "custom") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, session?.access_token]);

  const promptTypeChart = useMemo(() => {
    if (!data) return [];
    return data.costByPromptType.map((r) => ({
      type: r.type,
      cost: r.cost,
      count: r.count,
    }));
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro de período */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{
          padding: "12px 14px",
          border: "1.5px solid var(--sv-ink)",
          background: "var(--sv-white)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
        }}
      >
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-muted)",
            fontWeight: 700,
          }}
        >
          Período:
        </span>
        {(["7d", "30d", "90d", "ytd", "custom"] as RangeKey[]).map((r) => {
          const label =
            r === "7d"
              ? "7 dias"
              : r === "30d"
                ? "30 dias"
                : r === "90d"
                  ? "90 dias"
                  : r === "ytd"
                    ? "Este ano"
                    : "Custom";
          const on = range === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className="uppercase"
              style={{
                padding: "6px 11px",
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                fontWeight: 700,
                border: "1.5px solid var(--sv-ink)",
                background: on ? "var(--sv-green)" : "var(--sv-paper)",
                color: "var(--sv-ink)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
        {range === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="sv-input"
              style={{ padding: "6px 8px", fontSize: 11 }}
            />
            <span style={{ color: "var(--sv-muted)", fontSize: 11 }}>→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="sv-input"
              style={{ padding: "6px 8px", fontSize: 11 }}
            />
            <button
              type="button"
              onClick={() => void load()}
              disabled={!customFrom || !customTo || loading}
              className="sv-btn sv-btn-outline"
              style={{ padding: "6px 11px", fontSize: 10 }}
            >
              Aplicar
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {loading && (
            <Loader2
              size={14}
              className="animate-spin"
              style={{ color: "var(--sv-ink)" }}
            />
          )}
          {data && (
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.14em",
                color: "var(--sv-muted)",
                fontWeight: 700,
              }}
            >
              {data.range.from.slice(0, 10)} → {data.range.to.slice(0, 10)}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div
          className="p-3"
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

      {data?.queryErrors && (
        <div
          className="p-3"
          style={{
            border: "1.5px solid #c94f3b",
            background: "#fff8e5",
            color: "#7a2a1a",
            fontFamily: "var(--sv-sans)",
            fontSize: 12,
          }}
        >
          <strong>Queries parciais:</strong>{" "}
          {Object.entries(data.queryErrors)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}
        </div>
      )}

      {!data && !loading && !error && (
        <div
          className="p-6 text-center"
          style={{ color: "var(--sv-muted)", fontFamily: "var(--sv-mono)" }}
        >
          Selecione um período pra ver os dados.
        </div>
      )}

      {data && (
        <>
          {/* KPIs do range */}
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            }}
          >
            <MiniStat
              icon={<Users size={13} />}
              label="Novos usuários"
              value={String(data.totals.usersInRange)}
              sub={`${data.totals.users} total`}
            />
            <MiniStat
              icon={<Activity size={13} />}
              label="Carrosséis"
              value={String(data.totals.carousels)}
              sub={`${data.totals.generations} gerações`}
            />
            <MiniStat
              icon={<DollarSign size={13} />}
              label="Receita"
              value={fmtUsd(data.totals.revenueUsd)}
              sub="Período"
            />
            <MiniStat
              icon={<DollarSign size={13} />}
              label="Custo IA"
              value={fmtUsd(data.totals.costUsd, 4)}
              sub="APIs · período"
            />
            <MiniStat
              icon={<TrendingUp size={13} />}
              label="Conversão approx"
              value={`${data.conversionRate.pct}%`}
              sub={`${data.conversionRate.upgradedInRange} upgrades`}
            />
            <MiniStat
              icon={<Activity size={13} />}
              label="Erro em gerações"
              value={`${data.errorRate.pct}%`}
              sub={`${data.errorRate.errors}/${data.errorRate.total}`}
            />
          </div>

          {/* Seção: Uso */}
          <SectionTitle>Uso · Crescimento</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Novos usuários por dia">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.userSignups}>
                  <defs>
                    <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.soft} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickFormatter={shortDate}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(v) => `Dia: ${v}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={COLORS.ink}
                    strokeWidth={1.5}
                    fill="url(#gSignups)"
                    name="Signups"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Carrosséis por dia · por status">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.carouselsByDay}>
                  <CartesianGrid stroke={COLORS.soft} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickFormatter={shortDate}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: 10, fontFamily: "var(--sv-mono)" }}
                  />
                  <Bar
                    dataKey="draft"
                    stackId="a"
                    fill={COLORS.soft}
                    stroke={COLORS.ink}
                    name="Draft"
                  />
                  <Bar
                    dataKey="published"
                    stackId="a"
                    fill={COLORS.green}
                    stroke={COLORS.ink}
                    name="Published"
                  />
                  <Bar
                    dataKey="archived"
                    stackId="a"
                    fill={COLORS.pink}
                    stroke={COLORS.ink}
                    name="Archived"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Seção: Custos IA */}
          <SectionTitle>Custos IA</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Custo por dia · por provider">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.costByDay}>
                  <CartesianGrid stroke={COLORS.soft} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickFormatter={shortDate}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(n) => `$${Number(n).toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => formatTooltipUsd(v, 4)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, fontFamily: "var(--sv-mono)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="google"
                    stackId="1"
                    stroke={COLORS.ink}
                    fill={COLORS.google}
                    fillOpacity={0.7}
                    name="Google"
                  />
                  <Area
                    type="monotone"
                    dataKey="anthropic"
                    stackId="1"
                    stroke={COLORS.ink}
                    fill={COLORS.anthropic}
                    fillOpacity={0.7}
                    name="Anthropic"
                  />
                  <Area
                    type="monotone"
                    dataKey="openai"
                    stackId="1"
                    stroke={COLORS.ink}
                    fill={COLORS.openai}
                    fillOpacity={0.7}
                    name="OpenAI"
                  />
                  <Area
                    type="monotone"
                    dataKey="other"
                    stackId="1"
                    stroke={COLORS.ink}
                    fill={COLORS.other}
                    fillOpacity={0.7}
                    name="Outro"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Custo por tipo de prompt">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={promptTypeChart}
                  layout="vertical"
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGrid stroke={COLORS.soft} strokeDasharray="2 4" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(n) => `$${Number(n).toFixed(2)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="type"
                    tick={{ fontSize: 10, fill: COLORS.ink }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => formatTooltipUsd(v, 4)}
                  />
                  <Bar
                    dataKey="cost"
                    fill={COLORS.green}
                    stroke={COLORS.ink}
                    name="Custo"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Seção: Custo por processo */}
          {costBreakdown && (
            <>
              <SectionTitle>Custo por processo · Unit economics</SectionTitle>
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(220px, 1fr))",
                }}
              >
                {costBreakdown.processes.map((p) => (
                  <ProcessCard
                    key={p.id}
                    process={p}
                    usdBrl={costBreakdown.usdBrlRate}
                    highlight={p.id === "onboarding"}
                  />
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Custo médio por tipo de prompt">
                  <div style={{ maxHeight: 280, overflow: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontFamily: "var(--sv-sans)",
                        fontSize: 11.5,
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
                          <MiniTh>Prompt type</MiniTh>
                          <MiniTh align="right">Chamadas</MiniTh>
                          <MiniTh align="right">Custo médio</MiniTh>
                          <MiniTh align="right">Total</MiniTh>
                        </tr>
                      </thead>
                      <tbody>
                        {costBreakdown.perPromptType.map((r) => (
                          <tr
                            key={r.type}
                            style={{
                              borderTop: "1px solid rgba(10,10,10,0.08)",
                            }}
                          >
                            <MiniTd>
                              <span
                                style={{
                                  fontFamily: "var(--sv-mono)",
                                  fontSize: 10.5,
                                  letterSpacing: "0.06em",
                                  fontWeight: 700,
                                }}
                              >
                                {r.type}
                              </span>
                              <div
                                style={{
                                  fontFamily: "var(--sv-mono)",
                                  fontSize: 9,
                                  color: "var(--sv-muted)",
                                }}
                              >
                                tokens: {r.avgTokens.in}→{r.avgTokens.out}
                              </div>
                            </MiniTd>
                            <MiniTd align="right">{r.calls}</MiniTd>
                            <MiniTd align="right">
                              {fmtUsd(r.avgCostUsd, 6)}
                            </MiniTd>
                            <MiniTd align="right">
                              {fmtUsd(r.totalCostUsd, 4)}
                            </MiniTd>
                          </tr>
                        ))}
                        {costBreakdown.perPromptType.length === 0 && (
                          <tr>
                            <MiniTd>
                              <span style={{ color: "var(--sv-muted)" }}>
                                Sem gerações no período.
                              </span>
                            </MiniTd>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card title="Top 10 usuários por custo IA">
                  <div style={{ maxHeight: 280, overflow: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontFamily: "var(--sv-sans)",
                        fontSize: 11.5,
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
                          <MiniTh>Usuário</MiniTh>
                          <MiniTh>Plano</MiniTh>
                          <MiniTh align="right">Chamadas</MiniTh>
                          <MiniTh align="right">Custo</MiniTh>
                        </tr>
                      </thead>
                      <tbody>
                        {costBreakdown.topUsersByCost.map((u) => (
                          <tr
                            key={u.userId}
                            style={{
                              borderTop: "1px solid rgba(10,10,10,0.08)",
                            }}
                          >
                            <MiniTd>
                              <div style={{ fontWeight: 700 }}>
                                {u.name || "—"}
                              </div>
                              <div
                                style={{
                                  fontFamily: "var(--sv-mono)",
                                  fontSize: 9,
                                  color: "var(--sv-muted)",
                                  letterSpacing: "0.1em",
                                }}
                              >
                                {u.email || u.userId.slice(0, 8)}
                              </div>
                            </MiniTd>
                            <MiniTd>
                              <span
                                className="uppercase"
                                style={{
                                  fontFamily: "var(--sv-mono)",
                                  fontSize: 9,
                                  letterSpacing: "0.14em",
                                  fontWeight: 700,
                                  padding: "2px 5px",
                                  background:
                                    u.plan === "pro"
                                      ? COLORS.green
                                      : u.plan === "business"
                                        ? COLORS.pink
                                        : COLORS.soft,
                                  color: COLORS.ink,
                                }}
                              >
                                {u.plan}
                              </span>
                            </MiniTd>
                            <MiniTd align="right">{u.callCount}</MiniTd>
                            <MiniTd align="right">
                              {fmtUsd(u.totalCostUsd, 4)}
                            </MiniTd>
                          </tr>
                        ))}
                        {costBreakdown.topUsersByCost.length === 0 && (
                          <tr>
                            <MiniTd>
                              <span style={{ color: "var(--sv-muted)" }}>
                                Sem atividade no período.
                              </span>
                            </MiniTd>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Seção: Receita + Planos */}
          <SectionTitle>Financeiro · Planos</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Receita por dia (USD)">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.revenueByDay}>
                  <CartesianGrid stroke={COLORS.soft} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickFormatter={shortDate}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: COLORS.muted }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(n) => `$${Number(n)}`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => formatTooltipUsd(v)}
                  />
                  <Line
                    type="monotone"
                    dataKey="usd"
                    stroke={COLORS.ink}
                    strokeWidth={2}
                    dot={{ fill: COLORS.green, stroke: COLORS.ink, r: 3 }}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Distribuição por plano">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.planDistribution}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    stroke={COLORS.ink}
                    strokeWidth={1.5}
                    label={(entry) => {
                      // Recharts tipa label como any — o que recebemos é
                      // { plan, count, percent } nesse pie.
                      const e = entry as unknown as {
                        plan: string;
                        count: number;
                        percent?: number;
                      };
                      const pct = e.percent
                        ? ` ${Math.round(e.percent * 100)}%`
                        : "";
                      return `${e.plan}${pct}`;
                    }}
                    labelLine={false}
                  >
                    {data.planDistribution.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Seção: Heatmap + Top users */}
          <SectionTitle>Performance · Peak hours</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Heatmap · hora × dia da semana (UTC)">
              <Heatmap
                matrix={data.hourHeatmap}
                max={data.hourHeatmapMax}
              />
            </Card>

            <Card title="Top 10 usuários mais ativos">
              <div style={{ maxHeight: 280, overflow: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: "var(--sv-sans)",
                    fontSize: 11.5,
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
                      <MiniTh>Usuário</MiniTh>
                      <MiniTh>Plano</MiniTh>
                      <MiniTh align="right">Carrosséis</MiniTh>
                      <MiniTh align="right">Custo</MiniTh>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((u) => (
                      <tr
                        key={u.id}
                        style={{ borderTop: "1px solid rgba(10,10,10,0.08)" }}
                      >
                        <MiniTd>
                          <div style={{ fontWeight: 700 }}>
                            {u.name || "—"}
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--sv-mono)",
                              fontSize: 9,
                              color: "var(--sv-muted)",
                              letterSpacing: "0.1em",
                            }}
                          >
                            {u.email || u.id.slice(0, 8)}
                          </div>
                        </MiniTd>
                        <MiniTd>
                          <span
                            className="uppercase"
                            style={{
                              fontFamily: "var(--sv-mono)",
                              fontSize: 9,
                              letterSpacing: "0.14em",
                              fontWeight: 700,
                              padding: "2px 5px",
                              background:
                                u.plan === "pro"
                                  ? COLORS.green
                                  : u.plan === "business"
                                    ? COLORS.pink
                                    : COLORS.soft,
                              color: COLORS.ink,
                            }}
                          >
                            {u.plan}
                          </span>
                        </MiniTd>
                        <MiniTd align="right">{u.carousels}</MiniTd>
                        <MiniTd align="right">{fmtUsd(u.costUsd, 4)}</MiniTd>
                      </tr>
                    ))}
                    {data.topUsers.length === 0 && (
                      <tr>
                        <MiniTd>
                          <span style={{ color: "var(--sv-muted)" }}>
                            Sem atividade no período.
                          </span>
                        </MiniTd>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ─── bits ───────────────────────────────────────────────────────────────

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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
        className="uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 11,
        letterSpacing: "0.2em",
        color: "var(--sv-ink)",
        fontWeight: 700,
        marginTop: 6,
        paddingBottom: 4,
        borderBottom: "1.5px solid var(--sv-ink)",
      }}
    >
      ● {children}
    </div>
  );
}

function MiniStat({
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
        padding: 12,
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <div
        className="flex items-center gap-1 uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {icon}
        {label}
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
        {value}
      </div>
      <div
        className="mt-1 uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 8.5,
          letterSpacing: "0.12em",
          color: "var(--sv-muted)",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function ProcessCard({
  process,
  usdBrl,
  highlight,
}: {
  process: {
    id: string;
    label: string;
    components: string[];
    avgCostUsd: number | null;
    missing?: string[];
  };
  usdBrl: number;
  highlight?: boolean;
}) {
  const usd = process.avgCostUsd;
  const brl = usd !== null && usd !== undefined ? usd * usdBrl : null;
  const bg = highlight ? COLORS.green : COLORS.white;
  return (
    <div
      style={{
        padding: 14,
        background: bg,
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "3px 3px 0 0 var(--sv-ink)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.16em",
          color: highlight ? COLORS.ink : COLORS.muted,
          fontWeight: 700,
        }}
      >
        {highlight ? "● unit economics" : "custo médio"}
      </div>
      <div
        style={{
          fontFamily: "var(--sv-sans)",
          fontSize: 13,
          lineHeight: 1.25,
          color: COLORS.ink,
          fontWeight: 700,
        }}
      >
        {process.label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 2,
        }}
      >
        <div
          className="italic"
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: 26,
            lineHeight: 1,
            color: COLORS.ink,
          }}
        >
          {usd === null || usd === undefined ? "—" : fmtUsd(usd, 4)}
        </div>
        <div
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            color: COLORS.muted,
            letterSpacing: "0.06em",
          }}
        >
          {brl === null ? "" : `≈ R$ ${brl.toFixed(4)}`}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          color: COLORS.muted,
          letterSpacing: "0.05em",
          lineHeight: 1.4,
          marginTop: 4,
          borderTop: "1px dashed rgba(10,10,10,0.2)",
          paddingTop: 6,
        }}
      >
        {process.components.join(" + ")}
      </div>
      {process.missing && process.missing.length > 0 && (
        <div
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 8.5,
            letterSpacing: "0.14em",
            color: "#c94f3b",
            fontWeight: 700,
            marginTop: 4,
          }}
          title={`Sem dados pra: ${process.missing.join(", ")}`}
        >
          Sem dados: {process.missing.join(", ")}
        </div>
      )}
    </div>
  );
}

function MiniTh({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right" | "left";
}) {
  return (
    <th
      style={{
        padding: "8px 10px",
        textAlign: align ?? "left",
        fontFamily: "var(--sv-mono)",
        fontSize: 9,
        letterSpacing: "0.14em",
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

function MiniTd({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right" | "left";
}) {
  return (
    <td
      style={{
        padding: "8px 10px",
        textAlign: align ?? "left",
        color: "var(--sv-ink)",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--sv-white, #fff)",
  border: "1.5px solid var(--sv-ink, #0A0A0A)",
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  borderRadius: 0,
  boxShadow: "2px 2px 0 0 var(--sv-ink, #0A0A0A)",
  color: "var(--sv-ink, #0A0A0A)",
};

function Heatmap({ matrix, max }: { matrix: number[][]; max: number }) {
  const dayLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const safeMax = Math.max(max, 1);
  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px repeat(24, 1fr)",
          gap: 2,
          minWidth: 520,
        }}
      >
        <span />
        {hours.map((h) => (
          <span
            key={h}
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 8,
              color: COLORS.muted,
              textAlign: "center",
            }}
          >
            {h.toString().padStart(2, "0")}
          </span>
        ))}
        {dayLabels.map((label, dow) => (
          <>
            <span
              key={`l-${dow}`}
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                color: COLORS.muted,
                fontWeight: 700,
                letterSpacing: "0.12em",
                display: "flex",
                alignItems: "center",
              }}
            >
              {label}
            </span>
            {hours.map((h) => {
              const v = matrix[dow]?.[h] ?? 0;
              const intensity = v / safeMax;
              // Cor entre soft → green forte (mapeado por intensidade)
              const bg =
                v === 0
                  ? COLORS.paper
                  : `rgba(200, 232, 122, ${0.25 + intensity * 0.75})`;
              return (
                <div
                  key={`${dow}-${h}`}
                  title={`${label} ${h.toString().padStart(2, "0")}h · ${v} carrosséis`}
                  style={{
                    background: bg,
                    border: "1px solid rgba(10,10,10,0.15)",
                    height: 22,
                    position: "relative",
                  }}
                />
              );
            })}
          </>
        ))}
      </div>
      <div
        className="mt-3 flex items-center gap-2 uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.14em",
          color: COLORS.muted,
          fontWeight: 700,
        }}
      >
        Menos
        <div style={{ display: "flex", gap: 1 }}>
          {[0.25, 0.4, 0.6, 0.8, 1].map((o) => (
            <div
              key={o}
              style={{
                width: 14,
                height: 10,
                background: `rgba(200, 232, 122, ${o})`,
                border: "1px solid rgba(10,10,10,0.15)",
              }}
            />
          ))}
        </div>
        Mais · pico: {max}
      </div>
    </div>
  );
}
