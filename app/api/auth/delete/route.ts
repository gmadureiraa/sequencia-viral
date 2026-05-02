import {
  createServiceRoleSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import { getPostHogClient } from "@/lib/posthog-server";

export const maxDuration = 15;

/**
 * Apaga definitivamente a conta do usuário autenticado:
 *   1. Remove `auth.users` via Admin API (cascade deleta profiles/carousels/etc
 *      via `on delete cascade` do schema).
 *   2. Emite evento `account_deleted` no PostHog para encerrar retenção.
 */
export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const admin = createServiceRoleSupabaseClient();
  if (!admin) {
    return Response.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  // Cancela subscription Stripe (se existir) antes de apagar — evita cobrança órfã.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id,email,name")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_subscription_id) {
    // Em dev sem STRIPE_SECRET_KEY, lib/stripe.ts inicializa o cliente com
    // "sk_test_missing" e qualquer subscriptions.cancel explode. Pular.
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn(
        "[auth/delete] STRIPE_SECRET_KEY ausente — skip cancelamento Stripe"
      );
    } else {
      try {
        const { stripe } = await import("@/lib/stripe");
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (err) {
        console.warn(
          "[auth/delete] Falha ao cancelar subscription Stripe:",
          err
        );
      }
    }
  }

  // Admin API: deleta user → cascade em profiles/carousels/generations/payments.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[auth/delete] Falha ao deletar:", error);
    return Response.json(
      { error: "Não foi possível excluir a conta. Tente de novo." },
      { status: 500 }
    );
  }

  getPostHogClient().capture({
    distinctId: user.id,
    event: "account_deleted",
    properties: { email: profile?.email },
  });

  return Response.json({ ok: true });
}
