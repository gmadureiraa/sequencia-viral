import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { getOrCreateReferralCode } from "@/lib/referrals";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const admin = createServiceRoleSupabaseClient();
  if (!admin) {
    return Response.json({ error: "Service role nao configurado" }, { status: 500 });
  }

  const code = await getOrCreateReferralCode(user.id, admin);
  if (!code) {
    return Response.json(
      { error: "Falha ao gerar codigo de indicacao" },
      { status: 500 }
    );
  }

  // Busca contadores agregados.
  const [{ data: rows }, { data: profile }] = await Promise.all([
    admin
      .from("referrals")
      .select("status, reward_amount_cents, reward_applied")
      .eq("referrer_user_id", user.id),
    admin
      .from("profiles")
      .select("referral_credits_cents")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const list = (rows ?? []) as Array<{
    status: string;
    reward_amount_cents: number | null;
    reward_applied: boolean | null;
  }>;

  const signupCount = list.filter((r) =>
    ["signup", "converted"].includes(r.status)
  ).length;
  const conversionCount = list.filter((r) => r.status === "converted").length;
  const totalCreditCents =
    (profile?.referral_credits_cents as number | null) ??
    list
      .filter((r) => r.reward_applied)
      .reduce((acc, r) => acc + (r.reward_amount_cents ?? 0), 0);

  return Response.json({
    code,
    signupCount,
    conversionCount,
    totalCreditCents,
  });
}
