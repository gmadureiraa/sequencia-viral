/**
 * GET /api/zernio/stats
 *
 * Resumo agregado pro dashboard admin. Retorna contagens + posts notáveis:
 *  - totals por status (scheduled, published, failed, draft, cancelled)
 *  - publicados últimos 7 dias
 *  - próximos 5 agendados
 *  - últimos 5 publicados
 *  - autopilot: total de runs hoje, falhas recentes
 *
 * Tudo via single round-trip de queries paralelas pro Supabase.
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const now = new Date();
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayIso = now.toISOString().slice(0, 10);

  // Queries paralelas pra reduzir latência total.
  const [
    profilesQ,
    accountsActiveQ,
    accountsDisconnectedQ,
    postsAllQ,
    publishedRecentQ,
    nextScheduledQ,
    recentPublishedQ,
    autopilotRunsTodayQ,
    autopilotRunsFailedQ,
  ] = await Promise.all([
    sb
      .from("zernio_profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("archived_at", null),
    sb
      .from("zernio_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    sb
      .from("zernio_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "disconnected"),
    // status grouping: bater 1 select com agrupamento manual no JS
    // (Supabase JS lib não tem GROUP BY nativo; usamos contagens individuais
    // já que a lista total é pequena por user).
    sb
      .from("zernio_scheduled_posts")
      .select("status")
      .eq("user_id", user.id),
    sb
      .from("zernio_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "published")
      .gte("published_at", sevenDaysAgoIso),
    sb
      .from("zernio_scheduled_posts")
      .select(
        "id, profile_id, content, scheduled_for, platforms, source, status"
      )
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .gte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(5),
    sb
      .from("zernio_scheduled_posts")
      .select(
        "id, profile_id, content, published_at, platforms, source, status"
      )
      .eq("user_id", user.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5),
    sb
      .from("zernio_autopilot_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("run_date", todayIso),
    sb
      .from("zernio_autopilot_runs")
      .select("id, recipe_id, run_date, error, started_at")
      .eq("user_id", user.id)
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  // Agrega status counts manualmente.
  const statusCounts: Record<string, number> = {
    draft: 0,
    scheduled: 0,
    publishing: 0,
    published: 0,
    failed: 0,
    partial: 0,
    cancelled: 0,
  };
  for (const row of postsAllQ.data ?? []) {
    const s = (row as { status: string }).status;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  return Response.json({
    profiles: profilesQ.count ?? 0,
    accounts: {
      active: accountsActiveQ.count ?? 0,
      disconnected: accountsDisconnectedQ.count ?? 0,
    },
    posts: {
      total: (postsAllQ.data ?? []).length,
      byStatus: statusCounts,
      publishedLast7d: publishedRecentQ.count ?? 0,
    },
    nextScheduled: nextScheduledQ.data ?? [],
    recentPublished: recentPublishedQ.data ?? [],
    autopilot: {
      runsToday: autopilotRunsTodayQ.count ?? 0,
      recentFailures: autopilotRunsFailedQ.data ?? [],
    },
    generatedAt: now.toISOString(),
  });
}
