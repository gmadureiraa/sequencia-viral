import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import {
  getOrCreateReferralCode,
  REFERRAL_BONUS_ACTIVATION,
  REFERRAL_BONUS_PAID,
} from "@/lib/referrals";

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

  // Busca referrals + créditos por tipo. Inclui o legado 'carousels_bonus'
  // pra somar usuários cujo backfill ainda não rodou (defensivo).
  const [refsRes, creditsRes] = await Promise.all([
    admin
      .from("referrals")
      .select("status, reward_applied")
      .eq("referrer_user_id", user.id),
    admin
      .from("referral_credits")
      .select("type, amount")
      .eq("referrer_user_id", user.id)
      .in("type", ["activation_bonus", "paid_bonus", "carousels_bonus"]),
  ]);

  const list = (refsRes.data ?? []) as Array<{
    status: string;
    reward_applied: boolean | null;
  }>;
  const credits = (creditsRes.data ?? []) as Array<{
    type: string;
    amount: number;
  }>;

  const signupCount = list.filter((r) =>
    ["signup", "converted"].includes(r.status)
  ).length;
  const conversionCount = list.filter((r) => r.status === "converted").length;

  const activationCredits = credits.filter((c) => c.type === "activation_bonus");
  const paidCredits = credits.filter(
    (c) => c.type === "paid_bonus" || c.type === "carousels_bonus"
  );

  const activationCount = activationCredits.length;
  const totalActivationBonus = activationCredits.reduce(
    (acc, c) => acc + (c.amount ?? 0),
    0
  );
  const totalPaidBonus = paidCredits.reduce(
    (acc, c) => acc + (c.amount ?? 0),
    0
  );
  const totalCarouselsBonus = totalActivationBonus + totalPaidBonus;

  return Response.json({
    code,
    signupCount,
    conversionCount,
    activationCount,
    totalCarouselsBonus,
    totalActivationBonus,
    totalPaidBonus,
    bonusActivation: REFERRAL_BONUS_ACTIVATION,
    bonusPaid: REFERRAL_BONUS_PAID,
    /** @deprecated cliente novo usa bonusPaid */
    bonusPerReferral: REFERRAL_BONUS_PAID,
  });
}
