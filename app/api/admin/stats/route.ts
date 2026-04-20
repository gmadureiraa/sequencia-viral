import {
  requireAdmin,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";

export const maxDuration = 30;

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

interface CarouselRow {
  id?: string | null;
  user_id: string | null;
  status: string | null;
  title?: string | null;
  style?: Record<string, unknown> | null;
  updated_at?: string | null;
}

interface FeedbackEntry {
  carouselId: string;
  userId: string | null;
  title: string | null;
  sentiment: "up" | "down" | null;
  comment: string;
  updatedAt: string | null;
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

/**
 * Dashboard admin — retorna agregados globais + listas recentes pra UI.
 * Acesso restrito a ADMIN_EMAILS (lib/server/auth.ts).
 *
 * Payload expandido pra suportar as 5 abas do /app/admin:
 *  - Overview: summary + dailySeries (últimos 14d)
 *  - Usuários: users[] com stats
 *  - Gerações: recentGenerations[]
 *  - APIs: apiHealth (env presentes + último uso)
 *  - Assinaturas: subscriptions (MRR, churn, payments)
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

    // Busca paralela. `Promise.allSettled` + tolerância por query: se uma
    // tabela vier com erro (RLS policy mudou, coluna removida, timeout
    // pontual), o endpoint devolve stats parciais com `queryErrors`
    // anexado em vez de 500 matar o painel inteiro.
    const queries = await Promise.allSettled([
      sb
        .from("profiles")
        .select(
          "id,email,name,plan,usage_count,usage_limit,onboarding_completed,created_at,instagram_handle,twitter_handle,stripe_customer_id,stripe_subscription_id"
        )
        .order("created_at", { ascending: false })
        .limit(500),
      sb
        .from("generations")
        .select(
          "id,user_id,model,provider,input_tokens,output_tokens,cost_usd,prompt_type,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      sb
        .from("carousels")
        .select("id,user_id,status,title,style,updated_at")
        .order("updated_at", { ascending: false })
        .limit(10000),
      sb
        .from("payments")
        .select(
          "id,user_id,amount_usd,currency,method,status,plan,period_start,period_end,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const queryErrors: Record<string, string> = {};
    const names = ["profiles", "generations", "carousels", "payments"] as const;

    function pickData<T>(idx: number, label: (typeof names)[number]): T[] {
      const r = queries[idx];
      if (r.status === "rejected") {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        console.error(`[admin/stats] query ${label} rejected:`, msg);
        queryErrors[label] = msg.slice(0, 200);
        return [];
      }
      const res = r.value as { data: T[] | null; error: { message: string } | null };
      if (res.error) {
        console.error(`[admin/stats] query ${label} error:`, res.error.message);
        queryErrors[label] = res.error.message.slice(0, 200);
        return [];
      }
      return res.data ?? [];
    }

    const profiles = pickData<UserRow>(0, "profiles");
    const generations = pickData<GenerationRow>(1, "generations");
    const carousels = pickData<CarouselRow>(2, "carousels");
    const payments = pickData<PaymentRow>(3, "payments");

    // Totais globais
    const totalUsers = profiles.length;
    const completedOnboarding = profiles.filter(
      (p) => p.onboarding_completed
    ).length;
    const planCounts: Record<string, number> = {};
    for (const p of profiles) {
      const plan = p.plan || "free";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    }

    const totalGenerations = generations.length;
    const parseCost = (c: number | string | null | undefined): number => {
      const n = typeof c === "string" ? parseFloat(c) : c ?? 0;
      return Number.isFinite(n) ? n : 0;
    };

    const totalCostUsd = generations.reduce(
      (acc, g) => acc + parseCost(g.cost_usd),
      0
    );
    const totalInputTokens = generations.reduce(
      (acc, g) => acc + (g.input_tokens ?? 0),
      0
    );
    const totalOutputTokens = generations.reduce(
      (acc, g) => acc + (g.output_tokens ?? 0),
      0
    );

    // Breakdown por provider
    const providerBreakdown: Record<
      string,
      { count: number; cost: number; tokens: number; lastUsedAt?: string }
    > = {};
    for (const g of generations) {
      const p = g.provider || "unknown";
      const cost = parseCost(g.cost_usd);
      const tokens = (g.input_tokens ?? 0) + (g.output_tokens ?? 0);
      if (!providerBreakdown[p]) {
        providerBreakdown[p] = { count: 0, cost: 0, tokens: 0 };
      }
      providerBreakdown[p].count += 1;
      providerBreakdown[p].cost += cost;
      providerBreakdown[p].tokens += tokens;
      if (!providerBreakdown[p].lastUsedAt && g.created_at) {
        providerBreakdown[p].lastUsedAt = g.created_at;
      }
    }

    // Breakdown por prompt_type (caption, carousel, image, etc).
    const typeBreakdown: Record<
      string,
      { count: number; cost: number; tokens: number }
    > = {};
    for (const g of generations) {
      const t = g.prompt_type || "unknown";
      const cost = parseCost(g.cost_usd);
      const tokens = (g.input_tokens ?? 0) + (g.output_tokens ?? 0);
      if (!typeBreakdown[t]) typeBreakdown[t] = { count: 0, cost: 0, tokens: 0 };
      typeBreakdown[t].count += 1;
      typeBreakdown[t].cost += cost;
      typeBreakdown[t].tokens += tokens;
    }

    // Série diária de gerações (últimos 14 dias).
    const dailySeries: Array<{
      date: string;
      count: number;
      cost: number;
    }> = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      dailySeries.push({ date: iso, count: 0, cost: 0 });
    }
    const byDate = new Map(dailySeries.map((d) => [d.date, d]));
    for (const g of generations) {
      if (!g.created_at) continue;
      const key = g.created_at.slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.cost += parseCost(g.cost_usd);
      }
    }

    // Carrosséis por usuário + por status
    const totalCarousels = carousels.length;
    const carouselStatus: Record<string, number> = {};
    for (const c of carousels) {
      const s = c.status || "draft";
      carouselStatus[s] = (carouselStatus[s] || 0) + 1;
    }

    // Per-user aggregates
    const perUser: Record<
      string,
      {
        carousels: number;
        generations: number;
        cost: number;
        tokens: number;
        payments: number;
        ltv: number;
      }
    > = {};
    for (const c of carousels) {
      if (!c.user_id) continue;
      perUser[c.user_id] ??= {
        carousels: 0,
        generations: 0,
        cost: 0,
        tokens: 0,
        payments: 0,
        ltv: 0,
      };
      perUser[c.user_id].carousels += 1;
    }
    for (const g of generations) {
      if (!g.user_id) continue;
      perUser[g.user_id] ??= {
        carousels: 0,
        generations: 0,
        cost: 0,
        tokens: 0,
        payments: 0,
        ltv: 0,
      };
      perUser[g.user_id].generations += 1;
      perUser[g.user_id].cost += parseCost(g.cost_usd);
      perUser[g.user_id].tokens +=
        (g.input_tokens ?? 0) + (g.output_tokens ?? 0);
    }
    for (const pay of payments) {
      if (!pay.user_id) continue;
      perUser[pay.user_id] ??= {
        carousels: 0,
        generations: 0,
        cost: 0,
        tokens: 0,
        payments: 0,
        ltv: 0,
      };
      if (pay.status === "confirmed") {
        perUser[pay.user_id].payments += 1;
        perUser[pay.user_id].ltv += parseCost(pay.amount_usd);
      }
    }

    const userRows = profiles.map((p) => ({
      ...p,
      stats: perUser[p.id] ?? {
        carousels: 0,
        generations: 0,
        cost: 0,
        tokens: 0,
        payments: 0,
        ltv: 0,
      },
    }));

    // Feedback agregado dos carrosséis (salvo em style.feedback).
    let feedbackUp = 0;
    let feedbackDown = 0;
    const feedbackEntries: FeedbackEntry[] = [];
    for (const c of carousels) {
      const fb = (c.style as Record<string, unknown> | null)?.feedback as
        | Record<string, unknown>
        | undefined;
      if (!fb || typeof fb !== "object") continue;
      const s = fb.sentiment;
      const sentiment: "up" | "down" | null =
        s === "up" || s === "down" ? s : null;
      const comment =
        typeof fb.comment === "string" ? fb.comment.trim() : "";
      if (!sentiment && !comment) continue;
      if (sentiment === "up") feedbackUp += 1;
      if (sentiment === "down") feedbackDown += 1;
      feedbackEntries.push({
        carouselId: String(c.id ?? ""),
        userId: c.user_id,
        title: c.title ?? null,
        sentiment,
        comment,
        updatedAt:
          typeof fb.updated_at === "string"
            ? fb.updated_at
            : c.updated_at ?? null,
      });
    }
    feedbackEntries.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
    const feedbackTotal = feedbackUp + feedbackDown;
    const feedbackSatisfaction =
      feedbackTotal > 0 ? Math.round((feedbackUp / feedbackTotal) * 100) : null;

    // Assinaturas / MRR — preços de lançamento em USD.
    // (Stripe cobra em USD, cartão BR converte automaticamente.)
    const PRO_PRICE_USD = 9.9; // $/mês
    const BUSINESS_PRICE_USD = 29.9; // $/mês
    const activePaid = profiles.filter(
      (p) =>
        (p.plan === "pro" || p.plan === "business") && p.stripe_subscription_id
    );
    const mrrUsd =
      activePaid.filter((p) => p.plan === "pro").length * PRO_PRICE_USD +
      activePaid.filter((p) => p.plan === "business").length * BUSINESS_PRICE_USD;
    // Alias BRL pra retrocompat de alguém consumindo o campo antigo.
    const mrrBrl = mrrUsd;

    const confirmedPayments = payments.filter((p) => p.status === "confirmed");
    const failedPayments = payments.filter((p) => p.status === "failed");
    const totalRevenueUsd = confirmedPayments.reduce(
      (acc, p) => acc + parseCost(p.amount_usd),
      0
    );

    // Churn 30d: contagem de usuários que foram pra free com stripe_subscription_id
    // ainda setado (indicio de cancelamento). Como downgrade já limpa o ID,
    // isso ficaria imperfeito — melhor contar payments failed nos últimos 30d.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const failedIn30d = failedPayments.filter((p) => {
      if (!p.created_at) return false;
      return new Date(p.created_at) >= thirtyDaysAgo;
    }).length;

    // API Health — checa env vars setadas no runtime.
    const envKey = (name: string): "SET" | "MISSING" =>
      process.env[name] ? "SET" : "MISSING";
    const apiHealth = {
      GEMINI_API_KEY: envKey("GEMINI_API_KEY"),
      ANTHROPIC_API_KEY: envKey("ANTHROPIC_API_KEY"),
      SUPABASE_URL: envKey("NEXT_PUBLIC_SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: envKey("SUPABASE_SERVICE_ROLE_KEY"),
      STRIPE_SECRET_KEY: envKey("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: envKey("STRIPE_WEBHOOK_SECRET"),
      RESEND_API_KEY: envKey("RESEND_API_KEY"),
      APIFY_API_KEY: envKey("APIFY_API_KEY"),
      SERPER_API_KEY: envKey("SERPER_API_KEY"),
      SUPADATA_API_KEY: envKey("SUPADATA_API_KEY"),
      CRON_SECRET: envKey("CRON_SECRET"),
    };

    // Último uso de cada provider (do breakdown já computado).
    const apiLastUsed: Record<string, string | null> = {
      google: providerBreakdown.google?.lastUsedAt ?? null,
      anthropic: providerBreakdown.anthropic?.lastUsedAt ?? null,
      stripe: payments[0]?.created_at ?? null,
    };

    return Response.json({
      summary: {
        totalUsers,
        completedOnboarding,
        planCounts,
        totalGenerations,
        totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
        totalInputTokens,
        totalOutputTokens,
        totalCarousels,
        carouselStatus,
      },
      providerBreakdown,
      typeBreakdown,
      dailySeries,
      users: userRows,
      recentGenerations: generations.slice(0, 100),
      subscriptions: {
        activePaidCount: activePaid.length,
        mrrUsd: Math.round(mrrUsd * 100) / 100,
        mrrBrl, // retrocompat — mesmo valor que mrrUsd agora
        totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
        failedIn30d,
        recentPayments: payments.slice(0, 50),
      },
      apiHealth,
      apiLastUsed,
      feedback: {
        totalWithFeedback: feedbackTotal,
        up: feedbackUp,
        down: feedbackDown,
        satisfactionPct: feedbackSatisfaction,
        recent: feedbackEntries.slice(0, 50),
      },
      queryErrors: Object.keys(queryErrors).length > 0 ? queryErrors : undefined,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/stats] error:", msg);
    return Response.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}
