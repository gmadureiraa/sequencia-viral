/**
 * Gate server-side baseado em plano (não só admin).
 *
 * `requireAdmin` (lib/server/auth.ts) é usado pra páginas admin internas
 * (debug, dashboards globais). Pra features que admin + alguns planos pagos
 * podem usar (Zernio integration), use `requireAdminOrPlan`.
 *
 * Plans gateados pelo perfil em DB (`profiles.plan`):
 *   - "free"     → não tem acesso
 *   - "pro"      → não tem acesso (a Zernio)
 *   - "business" → tem acesso (tier topo)
 *
 * Admin emails sempre passam, independentemente do plano.
 */

import type { User } from "@supabase/supabase-js";
import {
  isAdminEmail,
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "./auth";

export type AllowedPlan = "free" | "pro" | "business";

/**
 * Valida que o user é admin OU tem plano em `allowedPlans`.
 * Default `allowedPlans = ['business']` — único plano que destrava Zernio.
 */
export async function requireAdminOrPlan(
  request: Request,
  allowedPlans: AllowedPlan[] = ["business"]
): Promise<{ ok: true; user: User; isAdmin: boolean; plan: string | null } | { ok: false; response: Response }> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;
  const { user } = auth;

  // Admin bypass — sempre passa
  if (isAdminEmail(user.email ?? null)) {
    return { ok: true, user, isAdmin: true, plan: null };
  }

  // Lookup plano no profile
  const sb = createServiceRoleSupabaseClient();
  if (!sb) {
    return {
      ok: false,
      response: Response.json(
        { error: "DB indisponível pra checar plano." },
        { status: 503 }
      ),
    };
  }

  const { data: profile, error } = await sb
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: Response.json(
        { error: `Falha ao checar plano: ${error.message}` },
        { status: 500 }
      ),
    };
  }

  const plan = (profile?.plan ?? "free") as string;
  if (!allowedPlans.includes(plan as AllowedPlan)) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            "Esse recurso é exclusivo do plano Max. Faça upgrade em /app/plans.",
          code: "plan_required",
          requiredPlans: allowedPlans,
          currentPlan: plan,
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user, isAdmin: false, plan };
}
