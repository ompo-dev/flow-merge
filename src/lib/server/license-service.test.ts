import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  userFindUniqueMock,
  userUpdateMock,
  billingChargeFindFirstMock,
  billingChargeUpdateManyMock,
  billingChargeUpdateMock,
  transactionMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
  billingChargeFindFirstMock: vi.fn(),
  billingChargeUpdateManyMock: vi.fn(),
  billingChargeUpdateMock: vi.fn(),
  transactionMock: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    user: {
      findUnique: userFindUniqueMock,
      update: userUpdateMock,
    },
    billingCharge: {
      findFirst: billingChargeFindFirstMock,
      updateMany: billingChargeUpdateManyMock,
      update: billingChargeUpdateMock,
    },
  },
}));

import {
  cancelUserAccess,
  evaluateUserAccessState,
  markChargePaid,
} from "@/lib/server/license-service";

describe("license-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("move trial expirado para payment_pending com grace de 7 dias", async () => {
    vi.setSystemTime(new Date("2026-03-30T12:00:00.000Z"));
    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      name: "User",
      email: "user@example.com",
      image: null,
      planType: null,
      accessState: "trial_active",
      releaseRole: "stable",
      trialEndsAt: new Date("2026-03-29T12:00:00.000Z"),
      paymentDueAt: null,
      blockedAt: null,
      deleteAt: null,
      isActive: true,
    });
    billingChargeUpdateManyMock.mockResolvedValue({ count: 0 });
    userUpdateMock.mockResolvedValue({
      id: "user_1",
      name: "User",
      email: "user@example.com",
      image: null,
      planType: null,
      accessState: "payment_pending",
      releaseRole: "stable",
      trialEndsAt: new Date("2026-03-29T12:00:00.000Z"),
      paymentDueAt: new Date("2026-04-05T12:00:00.000Z"),
      blockedAt: null,
      deleteAt: null,
      isActive: true,
    });
    billingChargeFindFirstMock.mockResolvedValue(null);

    const result = await evaluateUserAccessState("user_1");

    expect(result.kind).toBe("active");
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({
        accessState: "payment_pending",
        paymentDueAt: new Date("2026-04-05T12:00:00.000Z"),
        isActive: true,
      }),
    });
    expect(result.user?.accessState).toBe("payment_pending");
  });

  it("retorna deleted quando a conta bloqueada passou do prazo final", async () => {
    vi.setSystemTime(new Date("2026-04-28T12:00:00.000Z"));
    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      name: "User",
      email: "user@example.com",
      image: null,
      planType: "monthly",
      accessState: "blocked",
      releaseRole: "stable",
      trialEndsAt: new Date("2026-03-10T12:00:00.000Z"),
      paymentDueAt: new Date("2026-04-13T12:00:00.000Z"),
      blockedAt: new Date("2026-04-20T12:00:00.000Z"),
      deleteAt: new Date("2026-04-27T12:00:00.000Z"),
      isActive: false,
    });
    billingChargeUpdateManyMock.mockResolvedValue({ count: 0 });
    billingChargeFindFirstMock.mockResolvedValue({
      id: "charge_1",
      providerChargeId: "pix_1",
      planType: "monthly",
      amount: 8900,
      status: "pending",
      dueAt: new Date("2026-04-27T12:00:00.000Z"),
      paidAt: null,
      qrCodePayload: {},
    });

    const result = await evaluateUserAccessState("user_1");

    expect(result.kind).toBe("deleted");
    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(result.activeCharge?.providerChargeId).toBe("pix_1");
  });

  it("ativa mensal e cancela outros PIX pendentes quando um charge e pago", async () => {
    vi.setSystemTime(new Date("2026-03-30T12:00:00.000Z"));
    billingChargeUpdateMock.mockResolvedValue({
      id: "charge_paid",
      providerChargeId: "pix_1",
      userId: "user_1",
      planType: "monthly",
      amount: 8900,
      status: "paid",
      paidAt: new Date("2026-03-30T12:00:00.000Z"),
    });
    billingChargeUpdateManyMock.mockResolvedValue({ count: 1 });
    userUpdateMock.mockResolvedValue({
      id: "user_1",
      accessState: "active_monthly",
      paymentDueAt: new Date("2026-04-29T12:00:00.000Z"),
      planType: "monthly",
    });

    const result = await markChargePaid({
      providerChargeId: "pix_1",
      providerStatus: "PAID",
      providerPayload: { status: "PAID" },
      paidAt: new Date("2026-03-30T12:00:00.000Z"),
    });

    expect(billingChargeUpdateMock).toHaveBeenCalledWith({
      where: {
        providerChargeId: "pix_1",
      },
      data: expect.objectContaining({
        status: "paid",
        providerStatus: "PAID",
      }),
    });
    expect(billingChargeUpdateManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        status: "pending",
        id: {
          not: "charge_paid",
        },
      },
      data: {
        status: "canceled",
      },
    });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({
        planType: "monthly",
        accessState: "active_monthly",
        paymentDueAt: new Date("2026-04-29T12:00:00.000Z"),
      }),
    });
    expect(result.user.accessState).toBe("active_monthly");
  });

  it("cancela o plano ativo e abre nova janela de pagamento", async () => {
    const canceledAt = new Date("2026-03-30T12:00:00.000Z");
    const userUpdateValue = Promise.resolve({
      id: "user_1",
      accessState: "payment_pending",
      paymentDueAt: new Date("2026-04-06T12:00:00.000Z"),
      blockedAt: null,
      deleteAt: null,
      isActive: true,
    });
    const cancelChargesValue = Promise.resolve({ count: 2 });

    userUpdateMock.mockReturnValue(userUpdateValue);
    billingChargeUpdateManyMock.mockReturnValue(cancelChargesValue);

    const result = await cancelUserAccess("user_1", canceledAt);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        accessState: "payment_pending",
        paymentDueAt: new Date("2026-04-06T12:00:00.000Z"),
        blockedAt: null,
        deleteAt: null,
        isActive: true,
      },
    });
    expect(result).toEqual(await userUpdateValue);
  });
});
