/**
 * POST /api/zernio/triggers/:id/run-now
 *
 * Dispara processTrigger imediatamente, ignorando schedule/RSS/webhook
 * gating. Útil pra testar config sem esperar cron.
 *
 * Body opcional: { theme?: string } → override do tema sorteado.
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { processTrigger, type Trigger } from "@/lib/server/zernio-trigger-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-trigger-run-now", user.id),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: { theme?: string } = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = (await request.json()) as { theme?: string };
    }
  } catch {
    // Body opcional
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: trigger } = await sb
    .from("zernio_autopilot_triggers")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!trigger) {
    return Response.json({ error: "Trigger não encontrado." }, { status: 404 });
  }

  let result;
  try {
    result = await processTrigger({
      trigger: trigger as Trigger,
      firedBy: "manual",
      explicitTheme: body.theme?.trim() || undefined,
      payload: { manual: true, theme_override: body.theme ?? null },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ error: detail }, { status: 500 });
  }

  return Response.json(result);
}
