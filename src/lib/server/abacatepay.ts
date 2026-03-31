import "server-only";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/http-client";
import { PAYMENT_GRACE_DAYS, PLAN_PRICING, type PlanType } from "@/lib/license";
import { getServerEnv } from "@/lib/server-env";

const ABACATEPAY_REQUEST_TIMEOUT_MS = 15_000;

interface CreatePixQrCodeResponse {
  data: {
    id: string;
    amount: number;
    status: string;
    brCode: string;
    brCodeBase64: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
  };
  error: unknown;
}

interface CheckPixQrCodeResponse {
  data: {
    status: string;
    expiresAt: string;
  };
  error: unknown;
}

export class AbacatePayRequestError extends Error {
  readonly kind: "timeout" | "upstream";
  readonly statusCode: number;

  constructor(
    message: string,
    input: {
      kind: "timeout" | "upstream";
      statusCode: number;
      cause?: unknown;
    },
  ) {
    super(message, input.cause ? { cause: input.cause } : undefined);
    this.name = "AbacatePayRequestError";
    this.kind = input.kind;
    this.statusCode = input.statusCode;
  }
}

function getAbacatePayHeaders() {
  const env = getServerEnv();
  if (!env.ABACATEPAY_API_KEY) {
    throw new Error("ABACATEPAY_API_KEY is required to create or reconcile PIX charges.");
  }

  return {
    Authorization: `Bearer ${env.ABACATEPAY_API_KEY}`,
  };
}

export function buildChargeDescription(planType: PlanType) {
  return planType === "monthly" ? "Flow Merge Pro mensal" : "Flow Merge Founder Lifetime";
}

function toAbacatePayRequestError(error: unknown, operation: "create" | "check") {
  if (
    error instanceof AxiosError &&
    (error.code === "ECONNABORTED" || error.message.toLowerCase().includes("timeout"))
  ) {
    return new AbacatePayRequestError(
      operation === "create"
        ? "A AbacatePay demorou demais para criar o PIX."
        : "A AbacatePay demorou demais para confirmar o PIX.",
      {
        kind: "timeout",
        statusCode: 504,
        cause: error,
      },
    );
  }

  if (error instanceof AxiosError) {
    return new AbacatePayRequestError(
      operation === "create"
        ? "A AbacatePay recusou a criacao do PIX."
        : "A AbacatePay recusou a consulta do PIX.",
      {
        kind: "upstream",
        statusCode: 502,
        cause: error,
      },
    );
  }

  return new AbacatePayRequestError(
    operation === "create"
      ? "Falha inesperada ao criar o PIX na AbacatePay."
      : "Falha inesperada ao consultar o PIX na AbacatePay.",
    {
      kind: "upstream",
      statusCode: 502,
      cause: error,
    },
  );
}

export async function createAbacatePixCharge(input: {
  userId: string;
  planType: PlanType;
  email: string;
  name: string;
}) {
  const amount = PLAN_PRICING[input.planType].amountInCents;
  try {
    const response = await apiClient.post<CreatePixQrCodeResponse>(
      "https://api.abacatepay.com/v1/pixQrCode/create",
      {
        amount,
        expiresIn: PAYMENT_GRACE_DAYS * 24 * 60 * 60,
        description: buildChargeDescription(input.planType),
        metadata: {
          externalId: `${input.userId}:${input.planType}:${Date.now()}`,
          userId: input.userId,
          planType: input.planType,
          email: input.email,
        },
      },
      {
        headers: getAbacatePayHeaders(),
        timeout: ABACATEPAY_REQUEST_TIMEOUT_MS,
      },
    );

    return response.data.data;
  } catch (error) {
    throw toAbacatePayRequestError(error, "create");
  }
}

export async function checkAbacatePixChargeStatus(providerChargeId: string) {
  try {
    const response = await apiClient.get<CheckPixQrCodeResponse>(
      "https://api.abacatepay.com/v1/pixQrCode/check",
      {
        headers: getAbacatePayHeaders(),
        params: {
          id: providerChargeId,
        },
        timeout: ABACATEPAY_REQUEST_TIMEOUT_MS,
      },
    );

    return response.data.data;
  } catch (error) {
    throw toAbacatePayRequestError(error, "check");
  }
}
