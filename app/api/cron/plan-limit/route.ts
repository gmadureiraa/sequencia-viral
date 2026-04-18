import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { sendPlanLimit } from "@/lib/email/dispatch";

export const maxDuration = 60;

/**
 * Envia nudge quando user free atinge ≥80% do limite E ainda não recebeu
 * o email neste ciclo mensal. Ressetado a cada novo mês (via mudança no
 * `updated_at` do profile pela função de reset de usage).
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const { data: profiles } = await sb
    .from("profiles")
    .select("id,name,email,plan,usage_count,usage_limit,brand_analysis")
    .eq("plan", "free")
    .limit(500);

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const p of profiles || []) {
    const used = p.usage_count ?? 0;
    const limit = p.usage_limit ?? 5;
    if (limit <= 0 || used / limit < 0.8) {
      skipped.push(p.id);
      continue;
    }
    const lifecycle =
      ((p.brand_analysis as Record<string, unknown> | null)?.__lifecycle as
        | Record<string, string>
        | undefined) || {};
    // Idempotente por ciclo: usa chave "plan_limit_sent_at:YYYY-MM"
    const cycleKey = new Date().toISOString().slice(0, 7);
    const tag = `plan_limit_sent_at:${cycleKey}`;
    if (lifecycle[tag]) {
      skipped.push(p.id);
      continue;
    }
    if (!p.email) {
      skipped.push(p.id);
      continue;
    }
    const id = await sendPlanLimit(
      { email: p.email, name: p.name },
      { used, limit }
    );
    if (id) {
      const prev =
        p.brand_analysis && typeof p.brand_analysis === "object"
          ? { ...(p.brand_analysis as Record<string, unknown>) }
          : {};
      prev.__lifecycle = {
        ...lifecycle,
        [tag]: new Date().toISOString(),
      };
      await sb.from("profiles").update({ brand_analysis: prev }).eq("id", p.id);
      sent.push(p.id);
    }
  }

  return Response.json({
    ok: true,
    scanned: profiles?.length ?? 0,
    sent: sent.length,
    skipped: skipped.length,
  });
}
