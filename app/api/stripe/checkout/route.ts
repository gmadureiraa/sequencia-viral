import { stripe, PLANS, PlanId, AUTOPUBLISH_BUMP } from "@/lib/stripe";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

const ALLOWED_ORIGINS = [
  "https://sequencia-viral.app",
  "https://www.sequencia-viral.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limiter = checkRateLimit({
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

    const { planId, email, bump } = await request.json();

    if (!planId || !PLANS[planId as PlanId]) {
      return Response.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = PLANS[planId as PlanId];
    const includeBump = bump === true;

    const planItem = {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Sequência Viral ${plan.name}`,
          description: plan.features.join(" · "),
        },
        unit_amount: plan.priceMonthly as number,
        recurring: { interval: "month" as const },
      },
      quantity: 1,
    };
    const bumpItem = {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Add-on · ${AUTOPUBLISH_BUMP.name}`,
          description: AUTOPUBLISH_BUMP.description,
        },
        unit_amount: AUTOPUBLISH_BUMP.priceMonthly as number,
        recurring: { interval: "month" as const },
      },
      quantity: 1,
    };
    const lineItems = includeBump ? [planItem, bumpItem] : [planItem];

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || user.email || undefined,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planId,
        bump: includeBump ? "autopublish" : "none",
      },
      line_items: lineItems,
      success_url: `${ALLOWED_ORIGINS.includes(request.headers.get("origin") || "") ? request.headers.get("origin") : "https://sequencia-viral.app"}/app/settings?payment=success&plan=${planId}${includeBump ? "&bump=1" : ""}`,
      cancel_url: `${ALLOWED_ORIGINS.includes(request.headers.get("origin") || "") ? request.headers.get("origin") : "https://sequencia-viral.app"}/app/checkout?plan=${planId}&payment=cancelled`,
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
