import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("server rate limit", () => {
  afterEach(async () => {
    vi.resetModules();
    const { resetRateLimitStore } = await import("./rate-limit");
    resetRateLimitStore();
  });

  it("bloqueia quando o bucket excede o limite dentro da janela", async () => {
    const { consumeRateLimit } = await import("./rate-limit");
    const request = new Request("http://localhost/api/billing/charges", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    for (let index = 0; index < 20; index += 1) {
      expect(consumeRateLimit("billing", request, null, 1_000 + index).allowed).toBe(true);
    }

    const blocked = consumeRateLimit("billing", request, null, 1_500);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reinicia a contagem quando a janela expira", async () => {
    const { consumeRateLimit } = await import("./rate-limit");
    const request = new Request("http://localhost/api/license/status", {
      headers: {
        "x-forwarded-for": "203.0.113.11",
      },
    });

    const first = consumeRateLimit("auth", request, null, 10_000);
    const second = consumeRateLimit("auth", request, null, 10_100);
    const reset = consumeRateLimit("auth", request, null, 71_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(59);
  });

  it("retorna resposta 429 com headers de retry", async () => {
    const { buildRateLimitResponse } = await import("./rate-limit");
    const response = buildRateLimitResponse("billing", {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 12,
      limit: 20,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    await expect(response.json()).resolves.toEqual({
      error: "Muitas operacoes de cobranca em pouco tempo. Tente novamente em instantes.",
    });
  });
});
