import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import {
  sendOnboardingHowItWorks,
  sendOnboardingFirstCase,
  sendOnboardingWhyUpgrade,
} from "@/lib/email/dispatch";

export const maxDuration = 60;

/**
 * Onboarding drip diário — D+1, D+3 e D+7 após signup.
 *
 * Lógica:
 *  - Busca profiles criados entre (D+step - 24h) e (D+step) pra cada step.
 *  - Idempotência: grava `brand_analysis.__lifecycle.onboarding_<step>_sent_at`.
 *  - Não bloqueia usuários que já aplicam re-engagement/activation — esses têm
 *    seus próprios flags separados.
 *
 * Schedule: diário — ver vercel.json.
 */

type Step = {
  days: number;
  flag: string;
  /** Se true, filtra apenas `plan = 'free'` (pitch de upgrade só faz sentido
   *  pra quem ainda não assinou). Steps educacionais deixam undefined. */
  freeOnly?: boolean;
  send: (args: { email: string; name?: string }) => Promise<string | null>;
};

const STEPS: Step[] = [
  { days: 1, flag: "onboarding_how_it_works_sent_at", send: sendOnboardingHowItWorks },
  { days: 3, flag: "onboarding_first_case_sent_at", send: sendOnboardingFirstCase },
  {
    days: 7,
    flag: "onboarding_why_upgrade_sent_at",
    freeOnly: true,
    send: sendOnboardingWhyUpgrade,
  },
];

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("onboarding-drip")) return cronSkipped("onboarding-drip");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const summary: Record<string, { candidates: number; sent: number; skipped: number }> = {};

  for (const step of STEPS) {
    const to = new Date(Date.now() - step.days * 24 * 3600_000).toISOString();
    const from = new Date(Date.now() - (step.days + 1) * 24 * 3600_000).toISOString();

    let query = sb
      .from("profiles")
      .select("id,name,email,brand_analysis,created_at,plan")
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(500);

    if (step.freeOnly) {
      query = query.eq("plan", "free");
    }

    const { data: candidates } = await query;

    let sent = 0;
    let skipped = 0;

    for (const p of candidates || []) {
      const lifecycle =
        ((p.brand_analysis as Record<string, unknown> | null)?.__lifecycle as
          | Record<string, string>
          | undefined) || {};
      if (lifecycle[step.flag]) {
        skipped += 1;
        continue;
      }
      if (!p.email) {
        skipped += 1;
        continue;
      }
      const id = await step.send({ email: p.email, name: p.name });
      if (id) {
        const prev =
          p.brand_analysis && typeof p.brand_analysis === "object"
            ? { ...(p.brand_analysis as Record<string, unknown>) }
            : {};
        prev.__lifecycle = {
          ...lifecycle,
          [step.flag]: new Date().toISOString(),
        };
        await sb.from("profiles").update({ brand_analysis: prev }).eq("id", p.id);
        sent += 1;
      } else {
        skipped += 1;
      }
    }

    summary[`D+${step.days}`] = {
      candidates: candidates?.length ?? 0,
      sent,
      skipped,
    };
  }

  return Response.json({ ok: true, summary });
}
