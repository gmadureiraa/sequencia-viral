import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { sendReEngagement } from "@/lib/email/dispatch";

export const maxDuration = 60;

/**
 * Envia re-engagement pra users que:
 *   - Geraram ≥1 carrossel alguma vez (ou seja, estão ativados)
 *   - Não geram carrossel há ≥ 7 dias
 *   - Nunca receberam re-engagement OU passou >45 dias do último
 *
 * Assina as últimas `generations` do user pra saber a data de atividade.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("re-engagement")) return cronSkipped("re-engagement");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86400_000);

  // Queremos ativos com última geração antes de 7 dias.
  // Abordagem simples: pega candidates usage_count>0, depois filtra pela maior data de generation.
  const { data: profiles } = await sb
    .from("profiles")
    .select("id,name,email,usage_count,brand_analysis")
    .gt("usage_count", 0)
    .limit(500);

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const p of profiles || []) {
    const { data: lastGen } = await sb
      .from("generations")
      .select("created_at")
      .eq("user_id", p.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastGen?.created_at) {
      skipped.push(p.id);
      continue;
    }
    if (lastGen.created_at > sevenDaysAgo) {
      // ainda ativo nos últimos 7 dias
      skipped.push(p.id);
      continue;
    }

    const lifecycle =
      ((p.brand_analysis as Record<string, unknown> | null)?.__lifecycle as
        | Record<string, string>
        | undefined) || {};
    const lastReeng = lifecycle.re_engagement_sent_at
      ? new Date(lifecycle.re_engagement_sent_at)
      : null;
    if (lastReeng && lastReeng > fortyFiveDaysAgo) {
      skipped.push(p.id);
      continue;
    }
    if (!p.email) {
      skipped.push(p.id);
      continue;
    }
    const daysSince = Math.floor(
      (Date.now() - new Date(lastGen.created_at).getTime()) / 86400_000
    );
    const id = await sendReEngagement(
      { email: p.email, name: p.name },
      { daysSinceLastUse: daysSince }
    );
    if (id) {
      const prev =
        p.brand_analysis && typeof p.brand_analysis === "object"
          ? { ...(p.brand_analysis as Record<string, unknown>) }
          : {};
      prev.__lifecycle = {
        ...lifecycle,
        re_engagement_sent_at: new Date().toISOString(),
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
