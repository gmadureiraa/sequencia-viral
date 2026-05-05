import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { sendActivationNudge } from "@/lib/email/dispatch";

export const maxDuration = 60;

/**
 * Dispara "activation nudge" para contas criadas entre 48h e 72h atrás
 * que ainda não geraram 0 carrosséis. Idempotente via `brand_analysis.__lifecycle.activation_nudge_sent_at`.
 *
 * Schedule diário — ver vercel.json.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("activation-nudge")) return cronSkipped("activation-nudge");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const now = Date.now();
  const from = new Date(now - 72 * 3600_000).toISOString();
  const to = new Date(now - 48 * 3600_000).toISOString();

  const { data: candidates } = await sb
    .from("profiles")
    .select("id,name,email,usage_count,created_at,brand_analysis")
    .eq("usage_count", 0)
    .gte("created_at", from)
    .lte("created_at", to)
    .limit(200);

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const p of candidates || []) {
    const lifecycle =
      ((p.brand_analysis as Record<string, unknown> | null)?.__lifecycle as
        | Record<string, string>
        | undefined) || {};
    if (lifecycle.activation_nudge_sent_at) {
      skipped.push(p.id);
      continue;
    }
    if (!p.email) {
      skipped.push(p.id);
      continue;
    }
    const id = await sendActivationNudge({ email: p.email, name: p.name });
    if (id) {
      const prev =
        p.brand_analysis && typeof p.brand_analysis === "object"
          ? { ...(p.brand_analysis as Record<string, unknown>) }
          : {};
      prev.__lifecycle = {
        ...lifecycle,
        activation_nudge_sent_at: new Date().toISOString(),
      };
      await sb.from("profiles").update({ brand_analysis: prev }).eq("id", p.id);
      sent.push(p.id);
    }
  }

  return Response.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    sent: sent.length,
    skipped: skipped.length,
  });
}
