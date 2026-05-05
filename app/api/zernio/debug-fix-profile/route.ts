/**
 * POST /api/zernio/debug-fix-profile
 *
 * Endpoint de troubleshoot: marca `onboarding_completed = true` pro user
 * cujo email vem da sessão. Útil quando admin foi criado antes do flow de
 * onboarding existir e está sendo redirecionado pra /app/onboarding.
 *
 * Só roda se o email da sessão é admin (validação local — não requer
 * requireAdmin que faz fetch ao Supabase). Idempotente.
 */

import { ADMIN_EMAILS } from "@/lib/admin-emails";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { getSupabaseSessionEmail } from "@/proxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Lê cookie via shim igual ao debug-auth
  const cookieHeader = request.headers.get("cookie") || "";
  const allCookies: Array<{ name: string; value: string }> = [];
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    if (name) allCookies.push({ name, value });
  }
  const fakeReq = {
    cookies: { getAll: () => allCookies },
  } as Parameters<typeof getSupabaseSessionEmail>[0];

  const email = getSupabaseSessionEmail(fakeReq);
  if (!email) {
    return Response.json({ error: "Sem sessão." }, { status: 401 });
  }
  const adminLower = ADMIN_EMAILS.map((e) => e.toLowerCase());
  if (!adminLower.includes(email.toLowerCase())) {
    return Response.json({ error: "Não é admin." }, { status: 403 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Acha o auth user pelo email
  const { data: usersList } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const authUser = usersList?.users?.find(
    (u) => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
  );
  if (!authUser) {
    return Response.json({ error: "Auth user não encontrado." }, { status: 404 });
  }

  // Garante que existe profile + onboarding_completed=true
  const { data: existing } = await sb
    .from("profiles")
    .select("id, onboarding_completed")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!existing) {
    // Cria profile se não existir
    const { error: insErr } = await sb.from("profiles").insert({
      id: authUser.id,
      email: authUser.email,
      onboarding_completed: true,
      plan: "business", // admin = business pra ter acesso ilimitado
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
    });
  }

  if (existing.onboarding_completed) {
    return Response.json({
      ok: true,
      action: "noop",
      message: "Onboarding já estava completo.",
    });
  }

  const { error: updErr } = await sb
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", authUser.id);
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
  });
}
