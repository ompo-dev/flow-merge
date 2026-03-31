import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  evaluateUserAccessStateMock,
  hardDeleteUserAccountMock,
  createAbacatePixChargeMock,
  createPendingChargeRecordMock,
  serializeChargeMock,
  enforceRateLimitMock,
  AbacatePayRequestErrorMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  evaluateUserAccessStateMock: vi.fn(),
  hardDeleteUserAccountMock: vi.fn(),
  createAbacatePixChargeMock: vi.fn(),
  createPendingChargeRecordMock: vi.fn(),
  serializeChargeMock: vi.fn((charge) => charge),
  enforceRateLimitMock: vi.fn(),
  AbacatePayRequestErrorMock: class AbacatePayRequestErrorMock extends Error {
    kind: "timeout" | "upstream";
    statusCode: number;

    constructor(
      message: string,
      input: {
        kind: "timeout" | "upstream";
        statusCode: number;
      },
    ) {
      super(message);
      this.name = "AbacatePayRequestError";
      this.kind = input.kind;
      this.statusCode = input.statusCode;
    }
  },
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

vi.mock("@/lib/server/abacatepay", () => ({
  AbacatePayRequestError: AbacatePayRequestErrorMock,
  createAbacatePixCharge: createAbacatePixChargeMock,
}));

vi.mock("@/lib/server/license-service", () => ({
  evaluateUserAccessState: evaluateUserAccessStateMock,
  hardDeleteUserAccount: hardDeleteUserAccountMock,
  createPendingChargeRecord: createPendingChargeRecordMock,
  serializeCharge: serializeChargeMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

import { POST } from "@/app/api/billing/charges/route";

describe("POST /api/billing/charges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceRateLimitMock.mockReturnValue(null);
  });

  it("retorna 401 quando nao existe sessao valida", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/billing/charges", {
        method: "POST",
        body: JSON.stringify({ planType: "monthly" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sessao invalida." });
  });

  it("bloqueia renovar o mensal antes da janela de pagamento", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "active",
      user: {
        id: "user_1",
        email: "user@example.com",
        name: "User",
        accessState: "active_monthly",
        planType: "monthly",
      },
      activeCharge: null,
    });

    const response = await POST(
      new Request("http://localhost/api/billing/charges", {
        method: "POST",
        body: JSON.stringify({ planType: "monthly" }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Seu plano mensal ainda esta ativo. O novo PIX so abre quando entrar no prazo de pagamento.",
    });
  });

  it("permite gerar PIX de lifetime como upgrade com o mensal ativo", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "active",
      user: {
        id: "user_1",
        email: "user@example.com",
        name: "User",
        accessState: "active_monthly",
        planType: "monthly",
      },
      activeCharge: null,
    });
    createAbacatePixChargeMock.mockResolvedValue({
      id: "pix_1",
      status: "PENDING",
      brCode: "000201",
      brCodeBase64: "YmFzZTY0",
      expiresAt: "2026-04-01T12:00:00.000Z",
    });
    createPendingChargeRecordMock.mockResolvedValue({
      id: "charge_1",
      providerChargeId: "pix_1",
      planType: "lifetime",
      amount: 106800,
      status: "pending",
      dueAt: new Date("2026-04-01T12:00:00.000Z"),
      paidAt: null,
      qrCodePayload: {
        brCode: "000201",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/billing/charges", {
        method: "POST",
        body: JSON.stringify({ planType: "lifetime" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createAbacatePixChargeMock).toHaveBeenCalledWith({
      userId: "user_1",
      planType: "lifetime",
      email: "user@example.com",
      name: "User",
    });
    await expect(response.json()).resolves.toMatchObject({
      reused: false,
      charge: {
        providerChargeId: "pix_1",
        planType: "lifetime",
      },
    });
  });

  it("degrada timeout da AbacatePay para 504 com mensagem controlada", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "active",
      user: {
        id: "user_1",
        email: "user@example.com",
        name: "User",
        accessState: "payment_pending",
        planType: null,
      },
      activeCharge: null,
    });
    createAbacatePixChargeMock.mockRejectedValue(
      new AbacatePayRequestErrorMock("A AbacatePay demorou demais para criar o PIX.", {
        kind: "timeout",
        statusCode: 504,
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/billing/charges", {
        method: "POST",
        body: JSON.stringify({ planType: "monthly" }),
      }),
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "A AbacatePay demorou demais para criar o PIX.",
    });
  });
});
