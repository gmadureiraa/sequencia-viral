import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { getOrCreateReferralCode, REFERRAL_CAROUSELS_BONUS } from "@/lib/referrals";

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

  // Busca referrals + soma de carrosséis bônus já creditados.
  const [refsRes, creditsRes] = await Promise.all([
    admin
      .from("referrals")
      .select("status, reward_applied")
      .eq("referrer_user_id", user.id),
    admin
      .from("referral_credits")
      .select("amount")
      .eq("referrer_user_id", user.id)
      .eq("type", "carousels_bonus"),
  ]);

  const list = (refsRes.data ?? []) as Array<{
    status: string;
    reward_applied: boolean | null;
  }>;
  const credits = (creditsRes.data ?? []) as Array<{ amount: number }>;

  const signupCount = list.filter((r) =>
    ["signup", "converted"].includes(r.status)
  ).length;
  const conversionCount = list.filter((r) => r.status === "converted").length;
  const totalCarouselsBonus = credits.reduce(
    (acc, c) => acc + (c.amount ?? 0),
    0
  );

  return Response.json({
    code,
    signupCount,
    conversionCount,
    totalCarouselsBonus,
    bonusPerReferral: REFERRAL_CAROUSELS_BONUS,
  });
}
