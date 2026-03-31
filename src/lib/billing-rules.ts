import type { AccessState, PlanType } from "@/lib/license";

export type BillingBlockReason = "active_monthly" | "active_lifetime";

export function canOfferMonthlyPlan(accessState: AccessState | null) {
  return (
    accessState === "trial_active" ||
    accessState === "payment_pending" ||
    accessState === "blocked"
  );
}

export function canOfferLifetimePlan(accessState: AccessState | null) {
  return (
    accessState === "trial_active" ||
    accessState === "payment_pending" ||
    accessState === "blocked" ||
    accessState === "active_monthly"
  );
}

export function hasActivePlan(accessState: AccessState | null) {
  return accessState === "active_monthly" || accessState === "active_lifetime";
}

export function getBillingBlockReason(
  accessState: AccessState | null,
  planType: PlanType,
): BillingBlockReason | null {
  if (accessState === "active_lifetime") {
    return "active_lifetime";
  }

  if (accessState === "active_monthly" && planType === "monthly") {
    return "active_monthly";
  }

  return null;
}
