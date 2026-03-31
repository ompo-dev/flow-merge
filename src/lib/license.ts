import type { ReleaseAccessDescriptor } from "@/lib/release-access";

export const TRIAL_DAYS = 14;
export const PAYMENT_GRACE_DAYS = 7;
export const BLOCKED_GRACE_DAYS = 7;
export const MONTHLY_BILLING_DAYS = 30;

export const PLAN_PRICING = {
  monthly: {
    label: "Pro Mensal",
    amountInCents: 8_900,
  },
  lifetime: {
    label: "Founder Lifetime",
    amountInCents: 106_800,
  },
} as const;

export const PLAN_TYPES = ["monthly", "lifetime"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const ACCESS_STATES = [
  "trial_active",
  "payment_pending",
  "active_monthly",
  "active_lifetime",
  "blocked",
  "deleted",
] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

export const BILLING_CHARGE_STATUSES = [
  "pending",
  "paid",
  "expired",
  "canceled",
  "failed",
] as const;
export type BillingChargeStatus = (typeof BILLING_CHARGE_STATUSES)[number];

export interface LicenseStatusPayload {
  authenticated: boolean;
  canAccessWorkspace: boolean;
  requiresPayment: boolean;
  shouldWipeLocalData: boolean;
  planType: PlanType | null;
  accessState: AccessState | null;
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
  } | null;
  timeline: {
    trialEndsAt: string | null;
    paymentDueAt: string | null;
    blockedAt: string | null;
    deleteAt: string | null;
  };
  releaseAccess: ReleaseAccessDescriptor;
  billing: {
    planOptions: typeof PLAN_PRICING;
    activeCharge: {
      id: string;
      providerChargeId: string;
      planType: PlanType;
      amount: number;
      status: BillingChargeStatus;
      dueAt: string;
      paidAt: string | null;
      qrCodePayload: unknown;
    } | null;
  };
}

export function canAccessWorkspace(accessState: AccessState | null) {
  return (
    accessState === "trial_active" ||
    accessState === "payment_pending" ||
    accessState === "active_monthly" ||
    accessState === "active_lifetime"
  );
}

export function requiresPayment(accessState: AccessState | null) {
  return accessState === "payment_pending" || accessState === "blocked";
}

export function isPlanType(value: unknown): value is PlanType {
  return typeof value === "string" && PLAN_TYPES.includes(value as PlanType);
}

export function isAccessState(value: unknown): value is AccessState {
  return typeof value === "string" && ACCESS_STATES.includes(value as AccessState);
}
