/**
 * POST /api/zernio/debug-fix-profile
 *
 * Garante que o profile do admin existe + tem onboarding_completed=true.
 * Útil pra contas admin antigas (anteriores ao flow de onboarding) que
 * estavam sendo redirecionadas pra /app/onboarding.
 *
 * Auth: requireAdmin (Bearer header). NÃO usa cookie sb-* porque o SV
 * persiste sessão em localStorage (não cookie) — ver comentário em
 * lib/supabase.ts. Cliente chama com `Authorization: Bearer <access_token>`
 * via jsonWithAuth(session).
 *
 * Idempotente: roda sempre que chamada — se profile não existe, cria com
 * onboarding=true + plan='business'. Se existe e está OK, no-op.
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: existing } = await sb
    .from("profiles")
    .select("id, onboarding_completed, plan")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    // Cria profile pro admin com onboarding completo + plano business.
    const { error: insErr } = await sb.from("profiles").insert({
      id: user.id,
      email: user.email,
      onboarding_completed: true,
      plan: "business",
    });
    if (insErr) {
      return Response.json(
        { error: `Falha ao criar profile: ${insErr.message}` },
        { status: 500 }
      );
    }
    return Response.json({
      ok: true,
      action: "created",
      onboarding_completed: true,
      plan: "business",
    });
  }

  if (existing.onboarding_completed) {
    return Response.json({
      ok: true,
      action: "noop",
      message: "Onboarding já estava completo.",
      plan: existing.plan,
    });
  }

  const { error: updErr } = await sb
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  if (updErr) {
    return Response.json(
      { error: `Falha ao atualizar: ${updErr.message}` },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    action: "updated",
    onboarding_completed: true,
    plan: existing.plan,
  });
}
