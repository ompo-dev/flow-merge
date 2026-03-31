import type { AbacatePayRequestError } from "@/lib/server/abacatepay";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { postMock, getMock, getServerEnvMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn(),
  getServerEnvMock: vi.fn(),
}));

vi.mock("@/lib/http-client", () => ({
  apiClient: {
    post: postMock,
    get: getMock,
  },
}));

vi.mock("@/lib/server-env", () => ({
  getServerEnv: getServerEnvMock,
}));

import { checkAbacatePixChargeStatus, createAbacatePixCharge } from "@/lib/server/abacatepay";

describe("AbacatePay client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvMock.mockReturnValue({
      ABACATEPAY_API_KEY: "abacate_test_key",
    });
  });

  it("cria PIX com timeout e headers esperados", async () => {
    postMock.mockResolvedValue({
      data: {
        data: {
          id: "pix_1",
          amount: 8900,
          status: "PENDING",
          brCode: "000201",
          brCodeBase64: "YmFzZTY0",
          expiresAt: "2026-04-01T12:00:00.000Z",
          createdAt: "2026-03-30T12:00:00.000Z",
          updatedAt: "2026-03-30T12:00:00.000Z",
        },
      },
    });

    const result = await createAbacatePixCharge({
      userId: "user_1",
      planType: "monthly",
      email: "user@example.com",
      name: "User",
    });

    expect(result.id).toBe("pix_1");
    expect(postMock).toHaveBeenCalledWith(
      "https://api.abacatepay.com/v1/pixQrCode/create",
      expect.objectContaining({
        amount: 8900,
        description: "Flow Merge Pro mensal",
        metadata: expect.objectContaining({
          userId: "user_1",
          planType: "monthly",
          email: "user@example.com",
        }),
      }),
      expect.objectContaining({
        timeout: 15_000,
        headers: {
          Authorization: "Bearer abacate_test_key",
        },
      }),
    );
  });

  it("normaliza timeout da criacao do PIX", async () => {
    postMock.mockRejectedValue(new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED"));

    await expect(
      createAbacatePixCharge({
        userId: "user_1",
        planType: "monthly",
        email: "user@example.com",
        name: "User",
      }),
    ).rejects.toMatchObject<Partial<AbacatePayRequestError>>({
      name: "AbacatePayRequestError",
      kind: "timeout",
      statusCode: 504,
      message: "A AbacatePay demorou demais para criar o PIX.",
    });
  });

  it("normaliza falha upstream na consulta do PIX", async () => {
    getMock.mockRejectedValue(new AxiosError("Request failed with status code 500"));

    await expect(checkAbacatePixChargeStatus("pix_1")).rejects.toMatchObject<
      Partial<AbacatePayRequestError>
    >({
      name: "AbacatePayRequestError",
      kind: "upstream",
      statusCode: 502,
      message: "A AbacatePay recusou a consulta do PIX.",
    });
  });
});
