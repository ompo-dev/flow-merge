import { describe, expect, it } from "vitest";
import {
  canOfferLifetimePlan,
  canOfferMonthlyPlan,
  getBillingBlockReason,
  hasActivePlan,
} from "@/lib/billing-rules";

describe("billing-rules", () => {
  it("permite cobranca mensal apenas nos estados de trial, pagamento pendente e bloqueio", () => {
    expect(canOfferMonthlyPlan("trial_active")).toBe(true);
    expect(canOfferMonthlyPlan("payment_pending")).toBe(true);
    expect(canOfferMonthlyPlan("blocked")).toBe(true);
    expect(canOfferMonthlyPlan("active_monthly")).toBe(false);
    expect(canOfferMonthlyPlan("active_lifetime")).toBe(false);
  });

  it("permite lifetime tambem como upgrade quando o mensal esta ativo", () => {
    expect(canOfferLifetimePlan("active_monthly")).toBe(true);
    expect(canOfferLifetimePlan("trial_active")).toBe(true);
    expect(canOfferLifetimePlan("active_lifetime")).toBe(false);
  });

  it("marca plano ativo apenas para mensal e lifetime", () => {
    expect(hasActivePlan("active_monthly")).toBe(true);
    expect(hasActivePlan("active_lifetime")).toBe(true);
    expect(hasActivePlan("payment_pending")).toBe(false);
  });

  it("bloqueia somente a renovacao mensal enquanto o mensal esta ativo", () => {
    expect(getBillingBlockReason("active_monthly", "monthly")).toBe("active_monthly");
    expect(getBillingBlockReason("active_monthly", "lifetime")).toBeNull();
    expect(getBillingBlockReason("active_lifetime", "monthly")).toBe("active_lifetime");
    expect(getBillingBlockReason("trial_active", "monthly")).toBeNull();
  });
});
