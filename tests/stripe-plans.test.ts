import { describe, expect, it } from "vitest";
import {
  BUSINESS_USAGE_LIMIT_SENTINEL,
  FREE_PLAN_USAGE_LIMIT,
  PLANS,
  stripePaymentAmountUsd,
  usageLimitForPaidPlan,
} from "@/lib/stripe";

describe("stripe plans", () => {
  it("mantém ids e preços esperados", () => {
    expect(Object.keys(PLANS)).toEqual(["pro", "business"]);
    expect(PLANS.pro.priceMonthly).toBe(999);
    expect(PLANS.business.priceMonthly).toBe(2999);
  });

  it("centraliza limites e valores de cobrança", () => {
    expect(FREE_PLAN_USAGE_LIMIT).toBe(5);
    expect(usageLimitForPaidPlan("pro")).toBe(30);
    expect(usageLimitForPaidPlan("business")).toBe(BUSINESS_USAGE_LIMIT_SENTINEL);
    expect(stripePaymentAmountUsd("pro")).toBe(9.99);
    expect(stripePaymentAmountUsd("business")).toBe(29.99);
  });
});
