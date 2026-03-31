import "server-only";
import {
  BLOCKED_GRACE_DAYS,
  type AccessState,
  type BillingChargeStatus,
  MONTHLY_BILLING_DAYS,
  PAYMENT_GRACE_DAYS,
  PLAN_PRICING,
  type PlanType,
  TRIAL_DAYS,
  canAccessWorkspace,
  requiresPayment,
} from "@/lib/license";
import { prisma } from "@/lib/prisma";
import { getReleaseAccess, type ReleaseRole } from "@/lib/release-access";

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function coerceDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function defaultTrialEndsAt(from = new Date()) {
  return addDays(from, TRIAL_DAYS);
}

export function defaultPaymentGraceEndsAt(from = new Date()) {
  return addDays(from, PAYMENT_GRACE_DAYS);
}

export function defaultBlockedDeleteAt(from = new Date()) {
  return addDays(from, BLOCKED_GRACE_DAYS);
}

export function defaultMonthlyRenewalAt(from = new Date()) {
  return addDays(from, MONTHLY_BILLING_DAYS);
}

export async function getLatestPendingCharge(userId: string) {
  return prisma.billingCharge.findFirst({
    where: {
      userId,
      status: "pending",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function expireOverduePendingCharges(userId: string, referenceDate = new Date()) {
  await prisma.billingCharge.updateMany({
    where: {
      userId,
      status: "pending",
      dueAt: {
        lt: referenceDate,
      },
    },
    data: {
      status: "expired",
    },
  });
}

export function serializeCharge(charge: {
  id: string;
  providerChargeId: string;
  planType: PlanType;
  amount: number;
  status: BillingChargeStatus;
  dueAt: Date;
  paidAt: Date | null;
  qrCodePayload: unknown;
}) {
  return {
    id: charge.id,
    providerChargeId: charge.providerChargeId,
    planType: charge.planType,
    amount: charge.amount,
    status: charge.status,
    dueAt: charge.dueAt.toISOString(),
    paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
    qrCodePayload: charge.qrCodePayload,
  };
}

export async function evaluateUserAccessState(userId: string) {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      kind: "missing" as const,
      user: null,
      activeCharge: null,
    };
  }

  await expireOverduePendingCharges(user.id, now);

  let nextAccessState = user.accessState as AccessState;
  let nextPaymentDueAt = user.paymentDueAt;
  let nextBlockedAt = user.blockedAt;
  let nextDeleteAt = user.deleteAt;
  let nextIsActive = user.isActive;
  let shouldUpdate = false;

  if (nextAccessState === "trial_active") {
    const trialEndsAt = coerceDate(user.trialEndsAt) ?? defaultTrialEndsAt(now);
    if (!user.trialEndsAt) {
      nextPaymentDueAt = user.paymentDueAt;
      shouldUpdate = true;
    }
    if (trialEndsAt <= now) {
      nextAccessState = "payment_pending";
      nextPaymentDueAt = defaultPaymentGraceEndsAt(trialEndsAt);
      nextBlockedAt = null;
      nextDeleteAt = null;
      nextIsActive = true;
      shouldUpdate = true;
    }
  }

  if (nextAccessState === "active_monthly") {
    const renewalDueAt = coerceDate(user.paymentDueAt) ?? defaultMonthlyRenewalAt(now);
    if (!user.paymentDueAt) {
      nextPaymentDueAt = renewalDueAt;
      shouldUpdate = true;
    }
    if (renewalDueAt <= now) {
      nextAccessState = "payment_pending";
      nextPaymentDueAt = defaultPaymentGraceEndsAt(renewalDueAt);
      nextBlockedAt = null;
      nextDeleteAt = null;
      nextIsActive = true;
      shouldUpdate = true;
    }
  }

  if (nextAccessState === "payment_pending") {
    const paymentDueAt = coerceDate(nextPaymentDueAt) ?? defaultPaymentGraceEndsAt(now);
    if (!nextPaymentDueAt) {
      nextPaymentDueAt = paymentDueAt;
      shouldUpdate = true;
    }
    if (paymentDueAt <= now) {
      nextAccessState = "blocked";
      nextBlockedAt = now;
      nextDeleteAt = defaultBlockedDeleteAt(now);
      nextIsActive = false;
      shouldUpdate = true;
    }
  }

  if (nextAccessState === "blocked") {
    const deleteAt = coerceDate(nextDeleteAt) ?? defaultBlockedDeleteAt(now);
    if (!nextDeleteAt) {
      nextDeleteAt = deleteAt;
      shouldUpdate = true;
    }
    if (deleteAt <= now) {
      const activeCharge = await getLatestPendingCharge(user.id);
      return {
        kind: "deleted" as const,
        user,
        activeCharge,
      };
    }
  }

  const normalizedTrialEndsAt = coerceDate(user.trialEndsAt) ?? defaultTrialEndsAt(now);

  const updatedUser = shouldUpdate
    ? await prisma.user.update({
        where: { id: user.id },
        data: {
          accessState: nextAccessState,
          trialEndsAt: normalizedTrialEndsAt,
          paymentDueAt: nextPaymentDueAt,
          blockedAt: nextBlockedAt,
          deleteAt: nextDeleteAt,
          isActive: nextIsActive,
        },
      })
    : user.trialEndsAt
      ? user
      : await prisma.user.update({
          where: { id: user.id },
          data: {
            trialEndsAt: normalizedTrialEndsAt,
          },
        });

  const activeCharge = await getLatestPendingCharge(updatedUser.id);

  return {
    kind: "active" as const,
    user: updatedUser,
    activeCharge,
  };
}

export async function hardDeleteUserAccount(userId: string) {
  await prisma.$transaction([
    prisma.billingCharge.deleteMany({
      where: { userId },
    }),
    prisma.user.delete({
      where: { id: userId },
    }),
  ]);
}

export async function cancelUserAccess(userId: string, canceledAt = new Date()) {
  const paymentDueAt = defaultPaymentGraceEndsAt(canceledAt);

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        accessState: "payment_pending",
        paymentDueAt,
        blockedAt: null,
        deleteAt: null,
        isActive: true,
      },
    }),
    prisma.billingCharge.updateMany({
      where: {
        userId,
        status: "pending",
      },
      data: {
        status: "canceled",
      },
    }),
  ]);

  return user;
}

export async function markChargePaid(input: {
  providerChargeId: string;
  paidAt?: Date;
  providerStatus?: string;
  providerPayload?: unknown;
}) {
  const paidAt = input.paidAt ?? new Date();
  const charge = await prisma.billingCharge.update({
    where: {
      providerChargeId: input.providerChargeId,
    },
    data: {
      status: "paid",
      paidAt,
      providerStatus: input.providerStatus,
      providerPayload: input.providerPayload as never,
    },
  });

  const nextUserData =
    charge.planType === "lifetime"
      ? {
          planType: "lifetime" as const,
          accessState: "active_lifetime" as const,
          paymentDueAt: null,
          blockedAt: null,
          deleteAt: null,
          isActive: true,
        }
      : {
          planType: "monthly" as const,
          accessState: "active_monthly" as const,
          paymentDueAt: defaultMonthlyRenewalAt(paidAt),
          blockedAt: null,
          deleteAt: null,
          isActive: true,
        };

  await prisma.billingCharge.updateMany({
    where: {
      userId: charge.userId,
      status: "pending",
      id: {
        not: charge.id,
      },
    },
    data: {
      status: "canceled",
    },
  });

  const user = await prisma.user.update({
    where: { id: charge.userId },
    data: nextUserData,
  });

  return {
    charge,
    user,
  };
}

export async function createPendingChargeRecord(input: {
  userId: string;
  providerChargeId: string;
  planType: PlanType;
  amount: number;
  dueAt: Date;
  qrCodePayload: unknown;
  providerStatus?: string;
  providerPayload?: unknown;
  chargeKind?: "initial" | "renewal";
}) {
  await prisma.billingCharge.updateMany({
    where: {
      userId: input.userId,
      status: "pending",
    },
    data: {
      status: "canceled",
    },
  });

  const charge = await prisma.billingCharge.create({
    data: {
      providerChargeId: input.providerChargeId,
      userId: input.userId,
      planType: input.planType,
      amount: input.amount,
      status: "pending",
      dueAt: input.dueAt,
      qrCodePayload: input.qrCodePayload as never,
      providerStatus: input.providerStatus,
      providerPayload: input.providerPayload as never,
      chargeKind: input.chargeKind ?? "initial",
    },
  });

  return charge;
}

export function buildLicensePayload(input: {
  authenticated: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    planType: PlanType | null;
    accessState: AccessState;
    releaseRole: ReleaseRole;
    trialEndsAt: Date | null;
    paymentDueAt: Date | null;
    blockedAt: Date | null;
    deleteAt: Date | null;
  } | null;
  activeCharge?: {
    id: string;
    providerChargeId: string;
    planType: PlanType;
    amount: number;
    status: BillingChargeStatus;
    dueAt: Date;
    paidAt: Date | null;
    qrCodePayload: unknown;
  } | null;
  shouldWipeLocalData?: boolean;
}) {
  const user = input.user ?? null;
  const accessState = user?.accessState ?? null;
  const releaseAccess = getReleaseAccess(user?.releaseRole);

  return {
    authenticated: input.authenticated,
    canAccessWorkspace: canAccessWorkspace(accessState),
    requiresPayment: requiresPayment(accessState),
    shouldWipeLocalData: input.shouldWipeLocalData ?? false,
    planType: user?.planType ?? null,
    accessState,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          imageUrl: user.image,
        }
      : null,
    timeline: {
      trialEndsAt: user?.trialEndsAt ? user.trialEndsAt.toISOString() : null,
      paymentDueAt: user?.paymentDueAt ? user.paymentDueAt.toISOString() : null,
      blockedAt: user?.blockedAt ? user.blockedAt.toISOString() : null,
      deleteAt: user?.deleteAt ? user.deleteAt.toISOString() : null,
    },
    releaseAccess,
    billing: {
      planOptions: PLAN_PRICING,
      activeCharge: input.activeCharge ? serializeCharge(input.activeCharge) : null,
    },
  };
}
