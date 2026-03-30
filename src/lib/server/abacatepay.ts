import { apiClient } from "@/lib/http-client";
import { PAYMENT_GRACE_DAYS, PLAN_PRICING, type PlanType } from "@/lib/license";
import { getServerEnv } from "@/lib/server-env";

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

export async function createAbacatePixCharge(input: {
  userId: string;
  planType: PlanType;
  email: string;
  name: string;
}) {
  const amount = PLAN_PRICING[input.planType].amountInCents;
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
    },
  );

  return response.data.data;
}

export async function checkAbacatePixChargeStatus(providerChargeId: string) {
  const response = await apiClient.get<CheckPixQrCodeResponse>(
    "https://api.abacatepay.com/v1/pixQrCode/check",
    {
      headers: getAbacatePayHeaders(),
      params: {
        id: providerChargeId,
      },
    },
  );

  return response.data.data;
}
