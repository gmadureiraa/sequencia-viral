import { stripe, PLANS, PlanId, AUTOPUBLISH_BUMP } from "@/lib/stripe";
import { getAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import type Stripe from "stripe";

const ALLOWED_ORIGINS = [
  "https://viral.kaleidos.com.br",
  "https://www.viral.kaleidos.com.br",
  "https://sequencia-viral.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];
const DEFAULT_ORIGIN = "https://viral.kaleidos.com.br";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "stripe-checkout", user.id),
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Too many checkout attempts. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSec),
          },
        }
      );
    }

    const { planId, email, bump, couponCode, interval, referralCode } =
      (await request.json()) as {
        planId?: string;
        email?: string;
        bump?: boolean;
        couponCode?: string;
        interval?: "month" | "year";
        referralCode?: string;
      };

    // Programa Indique-e-Ganhe — se o user tem ref code no localStorage e
    // ja fez signup, registra a indicacao agora (tem referrer + referred user).
    // Idempotente, nao duplica se ja existir. Nao bloqueia o checkout em
    // qualquer falha — apenas loga.
    const trimmedReferralCode = (referralCode || "").trim();
    if (trimmedReferralCode) {
      try {
        const admin = createServiceRoleSupabaseClient();
        if (admin) {
          const { recordReferralSignup } = await import("@/lib/referrals");
          await recordReferralSignup({
            referralCode: trimmedReferralCode,
            referredEmail: user.email || email || "",
            referredUserId: user.id,
            supabaseAdmin: admin,
          });
        }
      } catch (err) {
        console.warn("[checkout] recordReferralSignup falhou (nao bloqueia):", err);
      }
    }

    if (!planId || !PLANS[planId as PlanId]) {
      return Response.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = PLANS[planId as PlanId];
    // Autopublish bump desativado (feature nao ofertada). Mantem var como
    // false pra nao quebrar referencias legadas abaixo sem refactor maior.
    void bump;
    const includeBump = false;
    const billingInterval: "month" | "year" =
      interval === "year" ? "year" : "month";
    const planPrice =
      billingInterval === "year"
        ? (plan as { priceAnnual?: number }).priceAnnual ?? plan.priceMonthly * 12
        : plan.priceMonthly;

    // Valida cupom local antes de criar a sessão Stripe.
    // Se o cupom existe, tentamos criar um promotion_code/coupon no Stripe
    // e aplicar via `discounts`. Se Stripe falhar, apenas log e segue sem.
    let appliedStripeCouponId: string | null = null;
    let appliedCouponMeta: { code: string; discountPct?: number | null; discountAmountCents?: number | null } | null = null;
    if (typeof couponCode === "string" && couponCode.trim()) {
      const sb = createServiceRoleSupabaseClient();
      if (sb) {
        const { data: coupon } = await sb
          .from("coupons")
          .select("id,code,discount_pct,discount_amount_cents,currency,max_uses,used_count,expires_at,active,plan_scope")
          .ilike("code", couponCode.trim())
          .maybeSingle();

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
        const row = coupon as CouponRow | null;

        const valid =
          !!row &&
          row.active &&
          (!row.expires_at || new Date(row.expires_at).getTime() > Date.now()) &&
          (!row.max_uses || (row.used_count ?? 0) < row.max_uses) &&
          (!row.plan_scope || row.plan_scope.length === 0 || row.plan_scope.includes(planId));

        if (valid && row) {
          try {
            const stripeCoupon = await stripe.coupons.create({
              name: `SV ${row.code}`,
              duration: "once",
              ...(row.discount_pct
                ? { percent_off: row.discount_pct }
                : { amount_off: row.discount_amount_cents ?? 0, currency: (row.currency || "usd").toLowerCase() }),
              metadata: {
                sv_coupon_id: row.id,
                sv_coupon_code: row.code,
              },
            });
            appliedStripeCouponId = stripeCoupon.id;
            appliedCouponMeta = {
              code: row.code,
              discountPct: row.discount_pct,
              discountAmountCents: row.discount_amount_cents,
            };
          } catch (err) {
            console.warn("[checkout] falha criando coupon no Stripe, seguindo sem desconto:", err);
          }
        } else if (row) {
          console.warn("[checkout] cupom inválido/expirado:", row.code);
        }
      }
    }

    // Usa Product ID existente no Stripe (definido em lib/pricing.ts). Se
    // o plano nao tiver product cadastrado ainda, fallback pra product_data
    // inline (Stripe cria produto novo). Currency BRL em todos os casos.
    const stripeProductId = (plan as { stripeProductId?: string })
      .stripeProductId;
    const planItem = {
      price_data: {
        currency: "brl",
        ...(stripeProductId
          ? { product: stripeProductId }
          : {
              product_data: {
                name: `Sequência Viral — ${plan.name}${billingInterval === "year" ? " (anual)" : ""} by Kaleidos Digital`,
                description: plan.features.join(" · "),
              },
            }),
        unit_amount: planPrice as number,
        recurring: { interval: billingInterval },
      },
      quantity: 1,
    };
    // Autopublish bump desativado — feature nao ofertada ainda. Sem
    // line items extras no checkout. Reativar quando Planejamento +
    // Piloto auto saírem do 'em breve'.
    const lineItems = [planItem];

    // Create Stripe Checkout Session
    // Se aplicamos um cupom local, passa via `discounts` (incompatível com
    // `allow_promotion_codes` — o cliente pediu um específico).
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || user.email || undefined,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planId,
        interval: billingInterval,
        bump: includeBump ? "autopublish" : "none",
        ...(appliedCouponMeta ? { svCouponCode: appliedCouponMeta.code } : {}),
        ...(trimmedReferralCode ? { referralCode: trimmedReferralCode } : {}),
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId,
          interval: billingInterval,
          ...(appliedCouponMeta ? { svCouponCode: appliedCouponMeta.code } : {}),
          ...(trimmedReferralCode ? { referralCode: trimmedReferralCode } : {}),
        },
      },
      line_items: lineItems,
      success_url: `${ALLOWED_ORIGINS.includes(request.headers.get("origin") || "") ? request.headers.get("origin") : DEFAULT_ORIGIN}/app/settings?payment=success&plan=${planId}${includeBump ? "&bump=1" : ""}`,
      cancel_url: `${ALLOWED_ORIGINS.includes(request.headers.get("origin") || "") ? request.headers.get("origin") : DEFAULT_ORIGIN}/app/checkout?plan=${planId}&payment=cancelled`,
    };
    if (appliedStripeCouponId) {
      sessionParams.discounts = [{ coupon: appliedStripeCouponId }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return Response.json({ url: session.url, coupon: appliedCouponMeta });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return Response.json(
      {
        error: process.env.NODE_ENV === "production"
          ? "Falha ao criar sessão de pagamento. Tente novamente."
          : (error instanceof Error ? error.message : "Checkout failed"),
      },
      { status: 500 }
    );
  }
}
