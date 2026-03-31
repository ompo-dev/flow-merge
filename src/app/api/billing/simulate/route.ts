import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getBillingBlockReason } from "@/lib/billing-rules";
import { PLAN_PRICING, isPlanType } from "@/lib/license";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import {
  createPendingChargeRecord,
  evaluateUserAccessState,
  hardDeleteUserAccount,
  markChargePaid,
} from "@/lib/server/license-service";

const simulateChargeSchema = z.object({
  planType: z.string().refine(isPlanType, "Selecione um plano valido."),
});

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit("billing", request);
  if (rateLimited) return rateLimited;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return Response.json(
      { error: "Sessao invalida." },
      { status: 401 },
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  });

  if (!currentUser) {
    return Response.json(
      { error: "Usuario nao encontrado." },
      { status: 404 },
    );
  }

  if (currentUser.releaseRole !== "internal") {
    return Response.json(
      { error: "A simulacao de pagamento e exclusiva para contas internal." },
      { status: 403 },
    );
  }

  let requestPayload: unknown;

  try {
    requestPayload = await request.json();
  } catch {
    return Response.json(
      { error: "Payload invalido." },
      { status: 400 },
    );
  }

  const parsed = simulateChargeSchema.safeParse(requestPayload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Payload invalido." },
      { status: 400 },
    );
  }

  const evaluation = await evaluateUserAccessState(session.user.id);

  if (evaluation.kind === "missing") {
    return Response.json(
      { error: "Usuario nao encontrado." },
      { status: 404 },
    );
  }

  if (evaluation.kind === "deleted" && evaluation.user) {
    await hardDeleteUserAccount(evaluation.user.id);
    return Response.json(
      { error: "Conta removida. Limpe os dados locais e faca login novamente." },
      { status: 410 },
    );
  }

  const planType = parsed.data.planType;
  const blockReason = getBillingBlockReason(evaluation.user.accessState, planType);

  if (blockReason === "active_monthly") {
    return Response.json(
      { error: "O plano mensal ainda esta ativo. A simulacao so abre quando entrar no prazo de pagamento." },
      { status: 409 },
    );
  }

  if (blockReason === "active_lifetime") {
    return Response.json(
      { error: "A conta ja esta no lifetime. Nao ha simulacao pendente para abrir agora." },
      { status: 409 },
    );
  }

  const existingCharge =
    evaluation.activeCharge && evaluation.activeCharge.planType === planType
      ? evaluation.activeCharge
      : null;

  const providerChargeId =
    existingCharge?.providerChargeId ??
    `simulated:${session.user.id}:${planType}:${Date.now()}`;

  if (!existingCharge) {
    await createPendingChargeRecord({
      userId: session.user.id,
      providerChargeId,
      planType,
      amount: PLAN_PRICING[planType].amountInCents,
      dueAt: new Date(),
      qrCodePayload: {
        simulated: true,
      },
      providerStatus: "SIMULATED_PENDING",
      providerPayload: {
        simulated: true,
        planType,
      },
      chargeKind:
        evaluation.user.planType === "monthly" &&
        planType === "monthly" &&
        (evaluation.user.accessState === "payment_pending" ||
          evaluation.user.accessState === "blocked")
          ? "renewal"
          : "initial",
    });
  }

  const paid = await markChargePaid({
    providerChargeId,
    providerStatus: "SIMULATED_PAID",
    providerPayload: {
      simulated: true,
      planType,
    },
  });

  return Response.json({
    success: true,
    planType,
    paidAt: paid.charge.paidAt?.toISOString() ?? new Date().toISOString(),
  });
}
