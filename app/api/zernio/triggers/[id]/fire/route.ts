/**
 * POST /api/zernio/triggers/:id/fire?secret=<token>
 *
 * Endpoint público de disparo de webhook trigger. Permite Zapier/Make/n8n
 * dispararem geração + post automaticamente. Sem auth Bearer — protegido
 * pelo `secret` na query string que é exclusivo do trigger.
 *
 * Body opcional (JSON):
 *   { theme?: string, payload?: object }
 *   - `theme`: tema sugerido. Se ausente, sorteia da pool do trigger.
 *   - `payload`: salvo em zernio_autopilot_runs.trigger_payload pra debug.
 *
 * Response: status do processamento (status: scheduled | failed | etc).
 *
 * Idempotência: cada call cria um novo run. Se quiser idempotência por
 * payload, fazer no caller (Zapier filtra antes).
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { processTrigger } from "@/lib/server/zernio-trigger-runner";
import type { Trigger } from "@/lib/server/zernio-trigger-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!secret) {
    return Response.json({ error: "secret obrigatório." }, { status: 401 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: trigger } = await sb
    .from("zernio_autopilot_triggers")
    .select("*")
    .eq("id", id)
    .eq("trigger_type", "webhook")
    .maybeSingle();
  if (!trigger) {
    return Response.json({ error: "Trigger não encontrado." }, { status: 404 });
  }
  if (trigger.webhook_secret !== secret) {
    // Resposta genérica pra não vazar info
    return Response.json({ error: "Trigger não encontrado." }, { status: 404 });
  }
  if (!trigger.is_active) {
    return Response.json({ error: "Trigger desativado." }, { status: 403 });
  }

  let body: { theme?: string; payload?: unknown } = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = (await request.json()) as { theme?: string; payload?: unknown };
    }
  } catch {
    // Body opcional — JSON inválido ignorado.
  }

  const explicitTheme = typeof body.theme === "string" ? body.theme.trim() : "";

  let result;
  try {
    result = await processTrigger({
      trigger: trigger as Trigger,
      firedBy: "webhook",
      explicitTheme: explicitTheme || undefined,
      payload: { theme: explicitTheme || null, body: body.payload ?? null },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ error: detail }, { status: 500 });
  }

  return Response.json(result);
}
