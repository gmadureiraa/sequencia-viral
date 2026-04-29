import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { isPaidPlanId } from "@/lib/pricing";

export const maxDuration = 10;

type CouponRow = {
  id: string;
  code: string;
  discount_pct: number | null;
  discount_amount_cents: number | null;
  currency: string;
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
  active: boolean;
  plan_scope: string[] | null;
};

/**
 * POST /api/coupons/validate
 * body: { code: string, planId?: 'pro' | 'business' }
 *
 * Retorna detalhes do cupom sem incrementar o contador.
 * O incremento real acontece no webhook Stripe após o checkout completar
 * (nunca confiar no cliente).
 */
export async function POST(request: Request) {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) {
    return Response.json(
      { valid: false, error: "Servidor sem Supabase configurado." },
      { status: 503 }
    );
  }

  // Rate limit por IP — 30 validações/hora é mais que suficiente.
  const ipKey = getRateLimitKey(request, "coupons-validate");
  const limiter = await rateLimit({
    key: ipKey,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { valid: false, error: "Muitas tentativas. Tente de novo em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: { code?: string; planId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { valid: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const code = (body.code || "").trim();
  const planId = (body.planId || "").trim();
  if (!code || code.length < 2 || code.length > 40) {
    return Response.json(
      { valid: false, error: "Cupom inválido." },
      { status: 400 }
    );
  }

  const { data, error } = await sb
    .from("coupons")
    .select(
      "id,code,discount_pct,discount_amount_cents,currency,max_uses,used_count,expires_at,active,plan_scope"
    )
    .ilike("code", code)
    .maybeSingle();

  if (error) {
    console.error("[coupons/validate] query error:", error);
    return Response.json(
      { valid: false, error: "Erro ao verificar cupom." },
      { status: 500 }
    );
  }

  const row = data as CouponRow | null;
  if (!row) {
    return Response.json({ valid: false, error: "Cupom não encontrado." });
  }

  if (!row.active) {
    return Response.json({ valid: false, error: "Cupom desativado." });
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return Response.json({ valid: false, error: "Cupom expirado." });
  }

  if (
    typeof row.max_uses === "number" &&
    row.max_uses > 0 &&
    (row.used_count ?? 0) >= row.max_uses
  ) {
    return Response.json({
      valid: false,
      error: "Cupom esgotado (limite de usos atingido).",
    });
  }

  // Se o cupom é restrito a um plano, valida.
  if (
    planId &&
    isPaidPlanId(planId) &&
    row.plan_scope &&
    row.plan_scope.length > 0 &&
    !row.plan_scope.includes(planId)
  ) {
    return Response.json({
      valid: false,
      error: `Cupom válido somente para os planos: ${row.plan_scope.join(", ")}.`,
    });
  }

  return Response.json({
    valid: true,
    coupon: {
      id: row.id,
      code: row.code,
      discountPct: row.discount_pct,
      discountAmountCents: row.discount_amount_cents,
      currency: row.currency,
      expiresAt: row.expires_at,
      planScope: row.plan_scope || [],
    },
  });
}
