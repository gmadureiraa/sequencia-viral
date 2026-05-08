import { stripe } from "@/lib/stripe";
import {
  createServiceRoleSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export const maxDuration = 15;

// Mantém allowlist alinhada com `/api/stripe/checkout` (P2-5 audit
// 2026-05-08 — antes aceitava `request.headers.get('origin')` direto, sem
// checar contra lista). Stripe valida internamente, mas consistência
// fecha a porta de origin spoofing nos logs/return URL.
const ALLOWED_ORIGINS = [
  "https://viral.kaleidos.com.br",
  "https://www.viral.kaleidos.com.br",
  "https://sequencia-viral.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];
const DEFAULT_ORIGIN = "https://viral.kaleidos.com.br";

/**
 * Cria uma sessão do Customer Portal do Stripe e retorna a URL para redirect.
 * O frontend chama POST com Authorization Bearer e faz `window.location.href = url`.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "stripe-portal", user.id),
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Muitas requisições. Tente novamente mais tarde." },
        { status: 429 }
      );
    }

    const sb = createServiceRoleSupabaseClient();
    if (!sb) {
      return Response.json(
        { error: "Serviço indisponível." },
        { status: 503 }
      );
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("stripe_customer_id,email")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      // Tenta localizar customer pelo email (caso checkout anterior não tenha salvo)
      if (profile?.email) {
        const existing = await stripe.customers.list({
          email: profile.email,
          limit: 1,
        });
        if (existing.data[0]) {
          customerId = existing.data[0].id;
          await sb
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("id", user.id);
        }
      }
    }

    if (!customerId) {
      return Response.json(
        {
          error:
            "Você ainda não tem uma assinatura. Faça upgrade para um plano pago primeiro.",
          code: "NO_CUSTOMER",
        },
        { status: 404 }
      );
    }

    const requestOrigin = request.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : process.env.NEXT_PUBLIC_APP_URL && ALLOWED_ORIGINS.includes(process.env.NEXT_PUBLIC_APP_URL)
        ? process.env.NEXT_PUBLIC_APP_URL
        : DEFAULT_ORIGIN;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/portal] erro:", err);
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao abrir portal.",
      },
      { status: 500 }
    );
  }
}
