/**
 * POST /api/referrals/track
 * Body: { referralCode: string }
 *
 * Chamado pelo client logo apos o user fazer signup (ou no proximo SIGNED_IN
 * se tiver `sv_ref_code` no localStorage). Cria a linha em `referrals` com
 * status='signup'.
 *
 * Idempotente — chamar 2x nao duplica.
 */
import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { recordReferralSignup } from "@/lib/referrals";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "referral-track", auth.user.id),
    limit: 5,
    windowMs: 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Tente novamente em alguns segundos." },
      { status: 429 }
    );
  }

  let body: { referralCode?: string } = {};
  try {
    body = (await request.json()) as { referralCode?: string };
  } catch {
    return Response.json({ error: "JSON invalido" }, { status: 400 });
  }

  const code = (body.referralCode || "").trim();
  if (!code) {
    return Response.json({ error: "referralCode obrigatorio" }, { status: 400 });
  }

  const admin = createServiceRoleSupabaseClient();
  if (!admin) {
    return Response.json({ error: "Service role nao configurado" }, { status: 500 });
  }

  const result = await recordReferralSignup({
    referralCode: code,
    referredEmail: auth.user.email || "",
    referredUserId: auth.user.id,
    supabaseAdmin: admin,
  });

  if (!result.ok) {
    // Razoes esperadas (referrer_not_found, self_referral_blocked) nao sao
    // erro pro cliente — apenas indicam que o codigo nao foi associado.
    return Response.json({ ok: false, reason: result.reason });
  }

  return Response.json({ ok: true });
}
