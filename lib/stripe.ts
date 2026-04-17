import Stripe from "stripe";
export * from "./pricing";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production");
}

export const stripe = new Stripe(stripeSecretKey || "sk_test_missing", {
  typescript: true,
});
