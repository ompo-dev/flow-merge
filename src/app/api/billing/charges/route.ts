import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { PLAN_PRICING, isPlanType } from "@/lib/license";
import { createAbacatePixCharge } from "@/lib/server/abacatepay";
import {
  createPendingChargeRecord,
  evaluateUserAccessState,
  hardDeleteUserAccount,
  serializeCharge,
} from "@/lib/server/license-service";

const createChargeSchema = z.object({
  planType: z.string().refine(isPlanType, "Selecione um plano valido."),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return Response.json(
      { error: "Sessao invalida." },
      { status: 401 },
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

  const parsed = createChargeSchema.safeParse(requestPayload);
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

  const user = evaluation.user;
  const planType = parsed.data.planType;

  if (user.accessState === "active_monthly" && planType === "monthly") {
    return Response.json(
      { error: "Seu plano mensal ainda esta ativo. O novo PIX so abre quando entrar no prazo de pagamento." },
      { status: 409 },
    );
  }

  if (user.accessState === "active_lifetime") {
    return Response.json(
      { error: "Sua conta ja esta no plano vitalicio." },
      { status: 409 },
    );
  }

  if (evaluation.activeCharge && evaluation.activeCharge.planType === planType) {
    return Response.json({
      charge: serializeCharge({
        id: evaluation.activeCharge.id,
        providerChargeId: evaluation.activeCharge.providerChargeId,
        planType: evaluation.activeCharge.planType,
        amount: evaluation.activeCharge.amount,
        status: evaluation.activeCharge.status,
        dueAt: evaluation.activeCharge.dueAt,
        paidAt: evaluation.activeCharge.paidAt,
        qrCodePayload: evaluation.activeCharge.qrCodePayload,
      }),
      reused: true,
    });
  }

  const pixCharge = await createAbacatePixCharge({
    userId: user.id,
    planType,
    email: user.email,
    name: user.name,
  });

  const charge = await createPendingChargeRecord({
    userId: user.id,
    providerChargeId: pixCharge.id,
    planType,
    amount: PLAN_PRICING[planType].amountInCents,
    dueAt: new Date(pixCharge.expiresAt),
    qrCodePayload: {
      brCode: pixCharge.brCode,
      brCodeBase64: pixCharge.brCodeBase64,
      expiresAt: pixCharge.expiresAt,
    },
    providerStatus: pixCharge.status,
    providerPayload: pixCharge,
    chargeKind:
      user.planType === "monthly" &&
      planType === "monthly" &&
      (user.accessState === "payment_pending" || user.accessState === "blocked")
        ? "renewal"
        : "initial",
  });

  return Response.json({
    charge: serializeCharge({
      id: charge.id,
      providerChargeId: charge.providerChargeId,
      planType: charge.planType,
      amount: charge.amount,
      status: charge.status,
      dueAt: charge.dueAt,
      paidAt: charge.paidAt,
      qrCodePayload: charge.qrCodePayload,
    }),
    reused: false,
  });
}
