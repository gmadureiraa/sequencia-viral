import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";

/**
 * Lista as indicacoes do user atual. Trunca o email do referido pra
 * proteger privacidade (a@b.com -> a***@b.com).
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

  const { data, error } = await admin
    .from("referrals")
    .select(
      "id, referred_email, status, signup_at, conversion_at, reward_amount_cents, reward_applied, created_at"
    )
    .eq("referrer_user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[referrals/list] erro:", error.message);
    return Response.json({ error: "Falha ao buscar indicacoes" }, { status: 500 });
  }

  // 2026-05-08: a coluna `reward_amount_cents` agora carrega o número de
  // carrosséis bônus (não centavos). Mantemos o nome da coluna pra evitar
  // migration destrutiva no DB; expomos como `rewardCarousels` na API.
  const items = (data ?? []).map((r) => ({
    id: r.id,
    email: maskEmail((r.referred_email as string) || ""),
    status: r.status,
    signupAt: r.signup_at,
    conversionAt: r.conversion_at,
    rewardCarousels: (r.reward_amount_cents as number | null) ?? 0,
    rewardApplied: !!r.reward_applied,
    createdAt: r.created_at,
  }));

  return Response.json({ items });
}
