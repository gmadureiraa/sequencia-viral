/**
 * POST /api/zernio/autopilot/recipes/:id/run-now
 *
 * Dispara processRecipe imediatamente pro recipe especificado, sem esperar
 * o cron. Útil pra testar config antes de deixar autopilot rodar sozinho.
 *
 * Idempotência: o pipeline tem UNIQUE(recipe_id, run_date) em
 * zernio_autopilot_runs — se já rodou hoje e está scheduled, retorna
 * 'skipped' em vez de duplicar.
 *
 * Não atualiza next_run_at quando bem-sucedido (pra preservar a cadência
 * agendada — run-now é EXTRA, não substitui o run agendado).
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { processRecipe, type Recipe } from "@/app/api/cron/zernio-autopilot/route";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;
  const { id } = await params;

  // Cap apertado: 10 run-now por hora por admin. Cada um custa 1 geração
  // Gemini + N Imagens render + Storage upload + Zernio call.
  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-run-now", user.id),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data, error } = await sb
    .from("zernio_autopilot_recipes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Recipe não encontrado." }, { status: 404 });

  let result;
  try {
    result = await processRecipe(data as Recipe);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `processRecipe: ${detail}` }, { status: 500 });
  }

  return Response.json(result);
}
