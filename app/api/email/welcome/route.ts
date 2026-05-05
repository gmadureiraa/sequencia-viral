import {
  createServiceRoleSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import { sendWelcome } from "@/lib/email/dispatch";
import { addContactToAudience } from "@/lib/integrations/resend/contacts";
import { fireResendEvent } from "@/lib/integrations/resend/events";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export const maxDuration = 10;

/**
 * Idempotente: dispara welcome 1x por user. Armazena em `profiles.metadata`
 * a flag `welcome_sent_at` para evitar reenvio em hot-refresh.
 *
 * Chamado pelo client imediatamente após signup confirmado (ver auth-context).
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "email-welcome", user.id),
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json({ skipped: true, reason: "rate_limit" });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) {
    return Response.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("name,email,brand_analysis")
    .eq("id", user.id)
    .single();

  // Usamos brand_analysis JSONB como sidecar de lifecycle pra evitar
  // migrações: gravamos `brand_analysis.__lifecycle.welcome_sent_at`.
  const lifecycle =
    ((profile?.brand_analysis as Record<string, unknown> | null)?.__lifecycle as
      | Record<string, string>
      | undefined) || {};
  if (lifecycle.welcome_sent_at) {
    return Response.json({ skipped: true, reason: "already_sent" });
  }

  const email = profile?.email || user.email;
  if (!email) {
    return Response.json({ skipped: true, reason: "no_email" });
  }

  // Dispara welcome transactional + adiciona contato na audience "Sequência
  // Viral" do Resend em paralelo. A audience é o trigger da automation de
  // lifecycle (D+0, D+1, D+3, D+5, D+9, D+14, D+30). Falha de qualquer um
  // dos dois é silenciosa — `sendWelcome` retorna null, `addContactToAudience`
  // também. Não bloqueia signup.
  const [sentId] = await Promise.all([
    sendWelcome({ email, name: profile?.name || undefined }),
    addContactToAudience({ email, name: profile?.name || undefined }),
  ]);

  // Lifecycle: dispara evento Resend pra Automations de signup. Roda depois
  // do addContactToAudience pra garantir que o contato existe na audience
  // antes da Automation tentar referenciar.
  await fireResendEvent("sv.signup", {
    email,
    user_id: user.id,
    first_name: profile?.name || null,
    source: "organic",
    plan: "free",
  });

  if (sentId) {
    const prev =
      profile?.brand_analysis &&
      typeof profile.brand_analysis === "object" &&
      !Array.isArray(profile.brand_analysis)
        ? { ...(profile.brand_analysis as Record<string, unknown>) }
        : {};
    prev.__lifecycle = {
      ...lifecycle,
      welcome_sent_at: new Date().toISOString(),
    };
    await sb
      .from("profiles")
      .update({ brand_analysis: prev })
      .eq("id", user.id);
  }

  return Response.json({ ok: true, id: sentId });
}
