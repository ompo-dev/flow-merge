import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  evaluateUserAccessStateMock,
  hardDeleteUserAccountMock,
  cancelUserAccessMock,
  enforceRateLimitMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  evaluateUserAccessStateMock: vi.fn(),
  hardDeleteUserAccountMock: vi.fn(),
  cancelUserAccessMock: vi.fn(),
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

vi.mock("@/lib/server/license-service", () => ({
  evaluateUserAccessState: evaluateUserAccessStateMock,
  hardDeleteUserAccount: hardDeleteUserAccountMock,
  cancelUserAccess: cancelUserAccessMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

import { POST } from "@/app/api/billing/cancel/route";

describe("POST /api/billing/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceRateLimitMock.mockReturnValue(null);
  });

  it("retorna 401 sem sessao valida", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/billing/cancel", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sessao invalida." });
  });

  it("bloqueia cancelamento quando nao existe plano ativo", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "active",
      user: {
        id: "user_1",
        accessState: "payment_pending",
      },
    });

    const response = await POST(new Request("http://localhost/api/billing/cancel", { method: "POST" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Nao existe plano ativo para cancelar.",
    });
  });

  it("cancela o plano quando a conta esta com assinatura ativa", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    evaluateUserAccessStateMock.mockResolvedValue({
      kind: "active",
      user: {
        id: "user_1",
        accessState: "active_lifetime",
      },
    });

    const response = await POST(new Request("http://localhost/api/billing/cancel", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(cancelUserAccessMock).toHaveBeenCalledWith("user_1");
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
