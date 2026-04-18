import {
  stripe,
  FREE_PLAN_USAGE_LIMIT,
  isPaidPlanId,
  stripePaymentAmountUsd,
  usageLimitForPaidPlan,
} from "@/lib/stripe";
import { PLANS } from "@/lib/pricing";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { getPostHogClient } from "@/lib/posthog-server";
import { sendPaymentSuccess } from "@/lib/email/dispatch";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const admin = createServiceRoleSupabaseClient();
  if (!admin) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for webhook processing" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const allowUnverified =
    process.env.ALLOW_UNVERIFIED_STRIPE_WEBHOOK === "true";

  if (webhookSecret && signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
      return handleEvent(event, admin);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  if (process.env.NODE_ENV === "production" && allowUnverified) {
    console.error("[stripe webhook] ALLOW_UNVERIFIED_STRIPE_WEBHOOK is forbidden in production");
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!allowUnverified) {
    return Response.json(
      {
        error:
          "Missing Stripe webhook signature or secret. For local testing only, set ALLOW_UNVERIFIED_STRIPE_WEBHOOK=true",
      },
      { status: 400 }
    );
  }

  console.warn(
    "[stripe webhook] Processing without signature verification (ALLOW_UNVERIFIED_STRIPE_WEBHOOK)"
  );
  let parsed: Stripe.Event;
  try {
    parsed = JSON.parse(body) as Stripe.Event;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return handleEvent(parsed, admin);
}

async function handleEvent(event: Stripe.Event, supabaseAdmin: SupabaseClient) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        metadata?: { userId?: string; planId?: string };
        subscription?: string;
        customer?: string;
        customer_email?: string;
      };

      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (userId && planId && isPaidPlanId(planId)) {
        const usageLimit = usageLimitForPaidPlan(planId);

        // Update user plan in Supabase
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: planId,
            usage_limit: usageLimit,
            usage_count: 0,
            ...(customerId ? { stripe_customer_id: customerId } : {}),
            ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
          })
          .eq("id", userId);

        if (error) {
          console.error("Failed to update profile plan:", error);
        }

        // Record payment
        const { error: payErr } = await supabaseAdmin.from("payments").insert({
          user_id: userId,
          amount_usd: stripePaymentAmountUsd(planId),
          currency: "USD",
          method: "stripe",
          status: "confirmed",
          plan: planId,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (payErr) {
          console.error("[stripe webhook] Failed to record payment:", payErr.message);
        }

        getPostHogClient().capture({
          distinctId: userId,
          event: "subscription_confirmed",
          properties: {
            plan: planId,
            amount_usd: stripePaymentAmountUsd(planId),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          },
        });

        // Email de confirmação (não bloqueia o webhook)
        const { data: profileRow } = await supabaseAdmin
          .from("profiles")
          .select("name,email")
          .eq("id", userId)
          .single();
        const recipientEmail = profileRow?.email || session.customer_email;
        if (recipientEmail) {
          const planMeta = PLANS[planId];
          const carouselsPerMonth =
            planMeta.carouselsPerMonth === -1
              ? ("ilimitado" as const)
              : planMeta.carouselsPerMonth;
          await sendPaymentSuccess(
            { email: recipientEmail, name: profileRow?.name || undefined },
            { planName: planMeta.name, carouselsPerMonth }
          );
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Subscription cancelled — downgrade to free
      const subscription = event.data.object as { metadata?: { userId?: string } };
      const userId = subscription.metadata?.userId;

      if (userId) {
        const { error: downgradeErr } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: "free",
            usage_limit: FREE_PLAN_USAGE_LIMIT,
          })
          .eq("id", userId);
        if (downgradeErr) {
          console.error("[stripe webhook] Failed to downgrade user to free:", downgradeErr.message);
        }

        getPostHogClient().capture({
          distinctId: userId,
          event: "subscription_cancelled",
          properties: { downgraded_to: "free" },
        });
      }
      break;
    }
  }

  return Response.json({ received: true });
}
