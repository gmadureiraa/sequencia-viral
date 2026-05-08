import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";

/**
 * Lista as indicacoes do user atual. Trunca o email do referido pra
 * proteger privacidade (a@b.com -> a***@b.com).
 *
 * Cada linha agora carrega ambos bônus (ativação + pagamento) consultados
 * em `referral_credits` por referee, pra UI mostrar exatamente em qual
 * estágio o referrer recebeu cada parcela.
 */
function maskEmail(email: string): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] || ""}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const admin = createServiceRoleSupabaseClient();
  if (!admin) {
    return Response.json({ error: "Service role nao configurado" }, { status: 500 });
  }

  const { data: referrals, error } = await admin
    .from("referrals")
    .select(
      "id, referred_email, referred_user_id, status, signup_at, conversion_at, reward_amount_cents, reward_applied, created_at"
    )
    .eq("referrer_user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[referrals/list] erro:", error.message);
    return Response.json({ error: "Falha ao buscar indicacoes" }, { status: 500 });
  }

  // Carrega créditos de ativação por referee. Paid bônus já vem em
  // referrals.reward_amount_cents (mantido pra retrocompat com tabela).
  const referredIds = (referrals ?? [])
    .map((r) => r.referred_user_id as string | null)
    .filter((v): v is string => Boolean(v));

  let creditsByReferee: Record<string, { activation: number; paid: number }> = {};
  if (referredIds.length > 0) {
    const { data: creditRows } = await admin
      .from("referral_credits")
      .select("referred_user_id, type, amount")
      .eq("referrer_user_id", auth.user.id)
      .in("referred_user_id", referredIds);

    creditsByReferee = (creditRows ?? []).reduce<typeof creditsByReferee>(
      (acc, c) => {
        const key = c.referred_user_id as string;
        if (!acc[key]) acc[key] = { activation: 0, paid: 0 };
        if (c.type === "activation_bonus") {
          acc[key].activation += (c.amount as number) ?? 0;
        } else if (c.type === "paid_bonus" || c.type === "carousels_bonus") {
          acc[key].paid += (c.amount as number) ?? 0;
        }
        return acc;
      },
      {}
    );
  }

  const items = (referrals ?? []).map((r) => {
    const referredId = (r.referred_user_id as string | null) || "";
    const credits = creditsByReferee[referredId] || { activation: 0, paid: 0 };
    const totalBonus = credits.activation + credits.paid;
    return {
      id: r.id,
      email: maskEmail((r.referred_email as string) || ""),
      status: r.status,
      signupAt: r.signup_at,
      conversionAt: r.conversion_at,
      // 2026-05-08: legacy field — soma total dos dois eventos pra UI antiga.
      rewardCarousels: totalBonus || ((r.reward_amount_cents as number) ?? 0),
      rewardApplied: !!r.reward_applied || totalBonus > 0,
      activationCarousels: credits.activation,
      paidCarousels: credits.paid,
      activated: credits.activation > 0,
      paid: credits.paid > 0,
      createdAt: r.created_at,
    };
  });

  return Response.json({ items });
}
