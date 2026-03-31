import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  prismaFindUniqueMock,
  evaluateUserAccessStateMock,
  hardDeleteUserAccountMock,
  createPendingChargeRecordMock,
  markChargePaidMock,
  enforceRateLimitMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  prismaFindUniqueMock: vi.fn(),
  evaluateUserAccessStateMock: vi.fn(),
  hardDeleteUserAccountMock: vi.fn(),
  createPendingChargeRecordMock: vi.fn(),
  markChargePaidMock: vi.fn(),
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

vi.mock("@/lib/server/license-service", () => ({
  evaluateUserAccessState: evaluateUserAccessStateMock,
  hardDeleteUserAccount: hardDeleteUserAccountMock,
  createPendingChargeRecord: createPendingChargeRecordMock,
  markChargePaid: markChargePaidMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

import { POST } from "@/app/api/billing/simulate/route";

describe("POST /api/billing/simulate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceRateLimitMock.mockReturnValue(null);
  });

  it("bloqueia simulacao para roles fora de internal", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    prismaFindUniqueMock.mockResolvedValue({
      id: "user_1",
      releaseRole: "beta",
    });

    const response = await POST(
      new Request("http://localhost/api/billing/simulate", {
        method: "POST",
        body: JSON.stringify({ planType: "monthly" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "A simulacao de pagamento e exclusiva para contas internal.",
    });
  });

  it("bloqueia simulacao mensal quando o ciclo mensal ainda esta ativo", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    prismaFindUniqueMock.mockResolvedValue({
      id: "user_1",
      releaseRole: "internal",
    });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "active",
      user: {
        id: "user_1",
        accessState: "active_monthly",
        planType: "monthly",
      },
      activeCharge: null,
    });

    const response = await POST(
      new Request("http://localhost/api/billing/simulate", {
        method: "POST",
        body: JSON.stringify({ planType: "monthly" }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "O plano mensal ainda esta ativo. A simulacao so abre quando entrar no prazo de pagamento.",
    });
  });

  it("permite simular lifetime como upgrade para internal com mensal ativo", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    prismaFindUniqueMock.mockResolvedValue({
      id: "user_1",
      releaseRole: "internal",
    });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "active",
      user: {
        id: "user_1",
        accessState: "active_monthly",
        planType: "monthly",
      },
      activeCharge: null,
    });
    markChargePaidMock.mockResolvedValue({
      charge: {
        paidAt: new Date("2026-03-30T22:00:00.000Z"),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/billing/simulate", {
        method: "POST",
        body: JSON.stringify({ planType: "lifetime" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createPendingChargeRecordMock).toHaveBeenCalledTimes(1);
    expect(markChargePaidMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      planType: "lifetime",
    });
  });
});
