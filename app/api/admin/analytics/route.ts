import {
  requireAdmin,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";

export const maxDuration = 30;

/**
 * GET /api/admin/analytics?range=7d|30d|90d|ytd|custom&from=ISO&to=ISO
 *
 * Payload secundário ao /api/admin/stats: agrega SÓ dados dentro do range
 * pedido (o /stats já tem o snapshot global). Usado pra alimentar os
 * gráficos filtráveis da seção "Analytics" do /app/admin.
 *
 * Agregações devolvidas:
 *  - userSignups[]          { date, count }  — profiles criados por dia
 *  - carouselsByDay[]       { date, total, draft, published, archived }
 *  - costByDay[]            { date, google, anthropic, openai, other, total }
 *  - costByPromptType[]     { type, cost, count }
 *  - planDistribution[]     { plan, count }  — snapshot atual (não filtra por range)
 *  - revenueByDay[]         { date, usd }
 *  - conversionRate         { freeViewedPaywall, upgradedInRange, pct }  (approx)
 *  - topUsers[]             { id, email, name, plan, carousels, costUsd }
 *  - hourHeatmap[][]        matriz 7 dias (0=Dom) x 24h de carrosseis criados
 *  - errorRate              { total, errors, pct }  — de generations.model='error' ou prompt_type='error'
 *  - totals                 { users, carousels, revenueUsd, costUsd, generations }
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const sb = createServiceRoleSupabaseClient();
    if (!sb) {
      return Response.json(
        { error: "Service role key ausente — admin indisponível." },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const range = url.searchParams.get("range") ?? "30d";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const { from, to } = resolveRange(range, fromParam, toParam);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    // Busca paralela — todas com filtro gte/lte em created_at exceto
    // profiles (pra plan distribution e topUsers a gente quer snapshot
    // total, cruza com carrosseis do range).
    const [
      profilesAllRes,
      profilesInRangeRes,
      carouselsRes,
      generationsRes,
      paymentsRes,
    ] = await Promise.allSettled([
      sb
        .from("profiles")
        .select("id,email,name,plan,created_at")
        .limit(10000),
      sb
        .from("profiles")
        .select("id,plan,created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(10000),
      sb
        .from("carousels")
        .select("id,user_id,status,created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(20000),
      sb
        .from("generations")
        .select("user_id,provider,prompt_type,cost_usd,created_at,model")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(30000),
      sb
        .from("payments")
        .select("user_id,amount_usd,status,created_at,plan")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000),
    ]);

    const queryErrors: Record<string, string> = {};
    const pick = <T>(
      r: PromiseSettledResult<{ data: T[] | null; error: { message: string } | null }>,
      label: string
    ): T[] => {
      if (r.status === "rejected") {
        queryErrors[label] = String(r.reason).slice(0, 160);
        return [];
      }
      if (r.value.error) {
        queryErrors[label] = r.value.error.message.slice(0, 160);
        return [];
      }
      return r.value.data ?? [];
    };

    interface ProfileAllRow {
      id: string;
      email: string | null;
      name: string | null;
      plan: string | null;
      created_at: string | null;
    }
    interface ProfileInRangeRow {
      id: string;
      plan: string | null;
      created_at: string | null;
    }
    interface CarouselRow {
      id: string;
      user_id: string | null;
      status: string | null;
      created_at: string | null;
    }
    interface GenerationRow {
      user_id: string | null;
      provider: string | null;
      prompt_type: string | null;
      cost_usd: number | string | null;
      created_at: string | null;
      model: string | null;
    }
    interface PaymentRow {
      user_id: string | null;
      amount_usd: number | string | null;
      status: string | null;
      created_at: string | null;
      plan: string | null;
    }

    const profilesAll = pick<ProfileAllRow>(profilesAllRes, "profiles");
    const profilesInRange = pick<ProfileInRangeRow>(
      profilesInRangeRes,
      "profiles_range"
    );
    const carousels = pick<CarouselRow>(carouselsRes, "carousels");
    const generations = pick<GenerationRow>(generationsRes, "generations");
    const payments = pick<PaymentRow>(paymentsRes, "payments");

    const parseCost = (c: number | string | null | undefined): number => {
      const n = typeof c === "string" ? parseFloat(c) : c ?? 0;
      return Number.isFinite(n) ? n : 0;
    };

    const days = eachDayBetween(from, to);

    // ─── User signups por dia ───────────────────────────────────────────
    const signupMap = new Map(days.map((d) => [d, 0]));
    for (const p of profilesInRange) {
      if (!p.created_at) continue;
      const k = p.created_at.slice(0, 10);
      if (signupMap.has(k)) signupMap.set(k, (signupMap.get(k) ?? 0) + 1);
    }
    const userSignups = days.map((d) => ({
      date: d,
      count: signupMap.get(d) ?? 0,
    }));

    // ─── Carrosseis por dia por status ──────────────────────────────────
    const carouselByDay = new Map(
      days.map((d) => [d, { draft: 0, published: 0, archived: 0, total: 0 }])
    );
    for (const c of carousels) {
      if (!c.created_at) continue;
      const k = c.created_at.slice(0, 10);
      const row = carouselByDay.get(k);
      if (!row) continue;
      row.total += 1;
      const s = (c.status || "draft") as "draft" | "published" | "archived";
      if (s === "published") row.published += 1;
      else if (s === "archived") row.archived += 1;
      else row.draft += 1;
    }
    const carouselsByDay = days.map((d) => ({
      date: d,
      ...(carouselByDay.get(d) ?? {
        draft: 0,
        published: 0,
        archived: 0,
        total: 0,
      }),
    }));

    // ─── Custo IA por dia, quebrado por provider ────────────────────────
    const costByDayMap = new Map(
      days.map((d) => [
        d,
        { google: 0, anthropic: 0, openai: 0, other: 0, total: 0 },
      ])
    );
    for (const g of generations) {
      if (!g.created_at) continue;
      const k = g.created_at.slice(0, 10);
      const row = costByDayMap.get(k);
      if (!row) continue;
      const cost = parseCost(g.cost_usd);
      row.total += cost;
      const p = (g.provider || "other").toLowerCase();
      if (p === "google") row.google += cost;
      else if (p === "anthropic") row.anthropic += cost;
      else if (p === "openai") row.openai += cost;
      else row.other += cost;
    }
    const costByDay = days.map((d) => {
      const r = costByDayMap.get(d) ?? {
        google: 0,
        anthropic: 0,
        openai: 0,
        other: 0,
        total: 0,
      };
      return {
        date: d,
        google: round6(r.google),
        anthropic: round6(r.anthropic),
        openai: round6(r.openai),
        other: round6(r.other),
        total: round6(r.total),
      };
    });

    // ─── Custo por prompt_type ──────────────────────────────────────────
    const costByTypeMap: Record<string, { cost: number; count: number }> = {};
    for (const g of generations) {
      const t = g.prompt_type || "unknown";
      if (!costByTypeMap[t]) costByTypeMap[t] = { cost: 0, count: 0 };
      costByTypeMap[t].cost += parseCost(g.cost_usd);
      costByTypeMap[t].count += 1;
    }
    const costByPromptType = Object.entries(costByTypeMap)
      .map(([type, v]) => ({
        type,
        cost: round6(v.cost),
        count: v.count,
      }))
      .sort((a, b) => b.cost - a.cost);

    // ─── Plan distribution (snapshot atual) ─────────────────────────────
    const planCounts: Record<string, number> = {};
    for (const p of profilesAll) {
      const plan = p.plan || "free";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    }
    const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({
      plan,
      count,
    }));

    // ─── Receita por dia ────────────────────────────────────────────────
    const revenueMap = new Map(days.map((d) => [d, 0]));
    for (const p of payments) {
      if (p.status !== "confirmed" || !p.created_at) continue;
      const k = p.created_at.slice(0, 10);
      if (revenueMap.has(k))
        revenueMap.set(k, (revenueMap.get(k) ?? 0) + parseCost(p.amount_usd));
    }
    const revenueByDay = days.map((d) => ({
      date: d,
      usd: round2(revenueMap.get(d) ?? 0),
    }));

    // ─── Conversion approx ──────────────────────────────────────────────
    // "Upgraded in range" = payments confirmed agrupados por user_id único
    // no período. Base free = usuários free atuais (snapshot).
    const upgradedUsers = new Set(
      payments
        .filter((p) => p.status === "confirmed" && p.user_id)
        .map((p) => p.user_id as string)
    );
    const upgradedInRange = upgradedUsers.size;
    const totalUsers = profilesAll.length;
    const freeBase = profilesAll.filter((p) => (p.plan || "free") === "free")
      .length;
    // approx: (upgrades do periodo) / (upgrades + free atual) — não é a
    // "verdade" do funil, mas serve de proxy pra dashboard.
    const conversionDenominator = upgradedInRange + freeBase;
    const conversionRate = {
      freeViewedPaywall: freeBase, // placeholder — sem telemetria de paywall view ainda
      upgradedInRange,
      pct:
        conversionDenominator > 0
          ? Math.round((upgradedInRange / conversionDenominator) * 10000) / 100
          : 0,
    };

    // ─── Top 10 users mais ativos (por carrosseis criados no range) ─────
    const userAgg = new Map<
      string,
      { carousels: number; costUsd: number }
    >();
    for (const c of carousels) {
      if (!c.user_id) continue;
      const cur = userAgg.get(c.user_id) ?? { carousels: 0, costUsd: 0 };
      cur.carousels += 1;
      userAgg.set(c.user_id, cur);
    }
    for (const g of generations) {
      if (!g.user_id) continue;
      const cur = userAgg.get(g.user_id) ?? { carousels: 0, costUsd: 0 };
      cur.costUsd += parseCost(g.cost_usd);
      userAgg.set(g.user_id, cur);
    }
    const profileById = new Map(profilesAll.map((p) => [p.id, p]));
    const topUsers = [...userAgg.entries()]
      .map(([id, stats]) => {
        const prof = profileById.get(id);
        return {
          id,
          email: prof?.email ?? null,
          name: prof?.name ?? null,
          plan: prof?.plan ?? "free",
          carousels: stats.carousels,
          costUsd: round6(stats.costUsd),
        };
      })
      .sort((a, b) => {
        if (b.carousels !== a.carousels) return b.carousels - a.carousels;
        return b.costUsd - a.costUsd;
      })
      .slice(0, 10);

    // ─── Heatmap horário (dia da semana x hora) ─────────────────────────
    // matriz 7x24: heatmap[dow][hour]. dow 0 = Domingo.
    const heatmap: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0)
    );
    let heatmapMax = 0;
    for (const c of carousels) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const dow = d.getUTCDay(); // 0..6
      const h = d.getUTCHours();
      heatmap[dow][h] += 1;
      if (heatmap[dow][h] > heatmapMax) heatmapMax = heatmap[dow][h];
    }

    // ─── Error rate ─────────────────────────────────────────────────────
    // Não tem coluna `status` em generations. Proxy: count de linhas cujo
    // `model` contém "error" ou `prompt_type` contém "error"/"fail".
    const errorCount = generations.filter((g) => {
      const m = (g.model || "").toLowerCase();
      const t = (g.prompt_type || "").toLowerCase();
      return m.includes("error") || t.includes("error") || t.includes("fail");
    }).length;
    const errorRate = {
      total: generations.length,
      errors: errorCount,
      pct:
        generations.length > 0
          ? Math.round((errorCount / generations.length) * 10000) / 100
          : 0,
    };

    // ─── Totais do range ────────────────────────────────────────────────
    const totalRevenueUsd = payments
      .filter((p) => p.status === "confirmed")
      .reduce((a, p) => a + parseCost(p.amount_usd), 0);
    const totalCostUsd = generations.reduce(
      (a, g) => a + parseCost(g.cost_usd),
      0
    );

    return Response.json({
      range: { key: range, from: fromIso, to: toIso },
      totals: {
        users: totalUsers,
        usersInRange: profilesInRange.length,
        carousels: carousels.length,
        revenueUsd: round2(totalRevenueUsd),
        costUsd: round6(totalCostUsd),
        generations: generations.length,
      },
      userSignups,
      carouselsByDay,
      costByDay,
      costByPromptType,
      planDistribution,
      revenueByDay,
      conversionRate,
      topUsers,
      hourHeatmap: heatmap,
      hourHeatmapMax: heatmapMax,
      errorRate,
      queryErrors:
        Object.keys(queryErrors).length > 0 ? queryErrors : undefined,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/analytics] error:", msg);
    return Response.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────

function resolveRange(
  range: string,
  fromParam: string | null,
  toParam: string | null
): { from: Date; to: Date } {
  const now = new Date();
  // Fim do dia de hoje em UTC.
  const to = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  if (range === "custom" && fromParam && toParam) {
    const f = new Date(fromParam);
    const t = new Date(toParam);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
      f.setUTCHours(0, 0, 0, 0);
      t.setUTCHours(23, 59, 59, 999);
      return { from: f, to: t };
    }
  }

  const from = new Date(to);
  from.setUTCHours(0, 0, 0, 0);

  if (range === "7d") from.setUTCDate(from.getUTCDate() - 6);
  else if (range === "90d") from.setUTCDate(from.getUTCDate() - 89);
  else if (range === "ytd")
    from.setUTCFullYear(from.getUTCFullYear(), 0, 1);
  else from.setUTCDate(from.getUTCDate() - 29); // default 30d

  return { from, to };
}

function eachDayBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  // Cap defensivo em 400 dias pra evitar loop runaway se algum client
  // mandar "custom" com range absurdo. Filtro ainda roda no SQL.
  let i = 0;
  while (d.getTime() <= end.getTime() && i < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
    i += 1;
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
