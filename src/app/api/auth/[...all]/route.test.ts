import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHandlerMock, postHandlerMock, enforceRateLimitMock, toNextJsHandlerMock } = vi.hoisted(
  () => ({
    getHandlerMock: vi.fn(),
    postHandlerMock: vi.fn(),
    enforceRateLimitMock: vi.fn(),
    toNextJsHandlerMock: vi.fn(() => ({
      GET: getHandlerMock,
      POST: postHandlerMock,
      PATCH: vi.fn(),
      PUT: vi.fn(),
      DELETE: vi.fn(),
    })),
  }),
);

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: toNextJsHandlerMock,
}));

vi.mock("@/lib/auth", () => ({
  auth: {},
}));

vi.mock("@/lib/server/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

import { GET, POST } from "@/app/api/auth/[...all]/route";

describe("auth route rate limit wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHandlerMock.mockResolvedValue(new Response("get ok", { status: 200 }));
    postHandlerMock.mockResolvedValue(new Response("post ok", { status: 200 }));
    enforceRateLimitMock.mockReturnValue(null);
  });

  it("encaminha a requisicao para o handler do Better Auth quando nao ha throttling", async () => {
    const request = new Request("http://localhost/api/auth/session");

    const response = await GET(request);

    expect(enforceRateLimitMock).toHaveBeenCalledWith("auth", request);
    expect(getHandlerMock).toHaveBeenCalledWith(request);
    await expect(response.text()).resolves.toBe("get ok");
  });

  it("retorna o 429 imediatamente quando a rota de auth excede o limite", async () => {
    const limitedResponse = Response.json(
      {
        error: "Muitas tentativas de autenticacao em pouco tempo. Tente novamente em instantes.",
      },
      { status: 429 },
    );
    enforceRateLimitMock.mockReturnValue(limitedResponse);
    const request = new Request("http://localhost/api/auth/sign-in/social", {
      method: "POST",
    });

    const response = await POST(request);

    expect(enforceRateLimitMock).toHaveBeenCalledWith("auth", request);
    expect(postHandlerMock).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Muitas tentativas de autenticacao em pouco tempo. Tente novamente em instantes.",
    });
  });
});
