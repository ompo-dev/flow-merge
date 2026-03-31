import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  prismaFindUniqueMock,
  checkAbacatePixChargeStatusMock,
  evaluateUserAccessStateMock,
  hardDeleteUserAccountMock,
  markChargePaidMock,
  buildLicensePayloadMock,
  enforceRateLimitMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  prismaFindUniqueMock: vi.fn(),
  checkAbacatePixChargeStatusMock: vi.fn(),
  evaluateUserAccessStateMock: vi.fn(),
  hardDeleteUserAccountMock: vi.fn(),
  markChargePaidMock: vi.fn(),
  buildLicensePayloadMock: vi.fn((input) => ({
    authenticated: input.authenticated,
    shouldWipeLocalData: input.shouldWipeLocalData ?? false,
    user: input.user
      ? {
          id: input.user.id,
          name: input.user.name,
          email: input.user.email,
        }
      : null,
    activeCharge: input.activeCharge ?? null,
  })),
  enforceRateLimitMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: prismaFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/server/abacatepay", () => ({
  checkAbacatePixChargeStatus: checkAbacatePixChargeStatusMock,
}));

vi.mock("@/lib/server/license-service", () => ({
  buildLicensePayload: buildLicensePayloadMock,
  evaluateUserAccessState: evaluateUserAccessStateMock,
  hardDeleteUserAccount: hardDeleteUserAccountMock,
  markChargePaid: markChargePaidMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

import { GET } from "@/app/api/license/status/route";

describe("GET /api/license/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceRateLimitMock.mockReturnValue(null);
  });

  it("retorna payload anonimo quando nao ha sessao", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/license/status"));

    expect(response.status).toBe(200);
    expect(buildLicensePayloadMock).toHaveBeenCalledWith({ authenticated: false });
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      shouldWipeLocalData: false,
      user: null,
      activeCharge: null,
    });
  });

  it("reconcilia um PIX pago antes de retornar a licenca", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    evaluateUserAccessStateMock
      .mockResolvedValueOnce({
        kind: "active",
        user: {
          id: "user_1",
          name: "User",
          email: "user@example.com",
          image: null,
          planType: "monthly",
          accessState: "payment_pending",
          releaseRole: "stable",
          trialEndsAt: null,
          paymentDueAt: new Date("2026-04-01T00:00:00.000Z"),
          blockedAt: null,
          deleteAt: null,
        },
        activeCharge: {
          id: "charge_1",
          providerChargeId: "pix_1",
          planType: "monthly",
          amount: 8900,
          status: "pending",
          dueAt: new Date("2026-04-01T00:00:00.000Z"),
          paidAt: null,
          qrCodePayload: {},
        },
      })
      .mockResolvedValueOnce({
        kind: "active",
        user: {
          id: "user_1",
          name: "User",
          email: "user@example.com",
          image: null,
          planType: "monthly",
          accessState: "active_monthly",
          releaseRole: "stable",
          trialEndsAt: null,
          paymentDueAt: new Date("2026-04-30T00:00:00.000Z"),
          blockedAt: null,
          deleteAt: null,
        },
        activeCharge: null,
      });
    checkAbacatePixChargeStatusMock.mockResolvedValue({ status: "PAID" });
    prismaFindUniqueMock.mockResolvedValue({
      id: "user_1",
      name: "User",
      email: "user@example.com",
      image: null,
      planType: "monthly",
      accessState: "active_monthly",
      releaseRole: "stable",
      trialEndsAt: null,
      paymentDueAt: new Date("2026-04-30T00:00:00.000Z"),
      blockedAt: null,
      deleteAt: null,
    });

    const response = await GET(new Request("http://localhost/api/license/status"));

    expect(response.status).toBe(200);
    expect(checkAbacatePixChargeStatusMock).toHaveBeenCalledWith("pix_1");
    expect(markChargePaidMock).toHaveBeenCalledWith({
      providerChargeId: "pix_1",
      providerStatus: "PAID",
      providerPayload: { status: "PAID" },
    });
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      shouldWipeLocalData: false,
      user: {
        id: "user_1",
        name: "User",
        email: "user@example.com",
      },
      activeCharge: null,
    });
  });

  it("retorna wipe local quando a conta foi deletada e faz hard delete no backend", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "deleted",
      user: {
        id: "user_1",
        name: "User",
        email: "user@example.com",
        image: null,
        planType: "monthly",
        accessState: "blocked",
        releaseRole: "stable",
        trialEndsAt: null,
        paymentDueAt: null,
        blockedAt: null,
        deleteAt: null,
      },
      activeCharge: null,
    });

    const response = await GET(new Request("http://localhost/api/license/status"));

    expect(response.status).toBe(200);
    expect(hardDeleteUserAccountMock).toHaveBeenCalledWith("user_1");
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      shouldWipeLocalData: true,
      user: {
        id: "user_1",
        name: "User",
        email: "user@example.com",
      },
      activeCharge: null,
    });
  });
});
