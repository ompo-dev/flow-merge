import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAbacatePixChargeStatus } from "@/lib/server/abacatepay";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import {
  buildLicensePayload,
  evaluateUserAccessState,
  hardDeleteUserAccount,
  markChargePaid,
} from "@/lib/server/license-service";

function isPaidProviderStatus(status: string) {
  const normalized = status.trim().toUpperCase();
  return (
    normalized === "PAID" ||
    normalized === "COMPLETED" ||
    normalized === "CONFIRMED" ||
    normalized === "SUCCESS"
  );
}

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit("license", request);
  if (rateLimited) return rateLimited;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return Response.json(
      buildLicensePayload({
        authenticated: false,
      }),
    );
  }

  let evaluation = await evaluateUserAccessState(session.user.id);

  if (evaluation.kind === "missing") {
    return Response.json(
      buildLicensePayload({
        authenticated: false,
      }),
    );
  }

  if (evaluation.kind === "active" && evaluation.activeCharge?.providerChargeId) {
    try {
      const providerStatus = await checkAbacatePixChargeStatus(evaluation.activeCharge.providerChargeId);
      if (isPaidProviderStatus(providerStatus.status)) {
        await markChargePaid({
          providerChargeId: evaluation.activeCharge.providerChargeId,
          providerStatus: providerStatus.status,
          providerPayload: providerStatus,
        });
        evaluation = await evaluateUserAccessState(session.user.id);
      }
    } catch (error) {
      console.error("Failed to reconcile pending AbacatePay charge", error);
    }
  }

  if (evaluation.kind === "deleted" && evaluation.user) {
    const deletedUser = evaluation.user;
    const activeCharge = evaluation.activeCharge;
    await hardDeleteUserAccount(deletedUser.id);

    return Response.json(
      buildLicensePayload({
        authenticated: true,
        shouldWipeLocalData: true,
        user: {
          id: deletedUser.id,
          name: deletedUser.name,
          email: deletedUser.email,
          image: deletedUser.image,
          planType: deletedUser.planType,
          accessState: "deleted",
          releaseRole: deletedUser.releaseRole,
          trialEndsAt: deletedUser.trialEndsAt,
          paymentDueAt: deletedUser.paymentDueAt,
          blockedAt: deletedUser.blockedAt,
          deleteAt: deletedUser.deleteAt,
        },
        activeCharge: activeCharge
          ? {
              id: activeCharge.id,
              providerChargeId: activeCharge.providerChargeId,
              planType: activeCharge.planType,
              amount: activeCharge.amount,
              status: activeCharge.status,
              dueAt: activeCharge.dueAt,
              paidAt: activeCharge.paidAt,
              qrCodePayload: activeCharge.qrCodePayload,
            }
          : null,
      }),
    );
  }

  const user = evaluation.user;
  if (!user) {
    return Response.json(
      buildLicensePayload({
        authenticated: false,
      }),
    );
  }

  const latestUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });

  if (!latestUser) {
    return Response.json(
      buildLicensePayload({
        authenticated: false,
      }),
    );
  }

  return Response.json(
    buildLicensePayload({
      authenticated: true,
      user: {
        id: latestUser.id,
        name: latestUser.name,
        email: latestUser.email,
        image: latestUser.image,
        planType: latestUser.planType,
        accessState: latestUser.accessState,
        releaseRole: latestUser.releaseRole,
        trialEndsAt: latestUser.trialEndsAt,
        paymentDueAt: latestUser.paymentDueAt,
        blockedAt: latestUser.blockedAt,
        deleteAt: latestUser.deleteAt,
      },
      activeCharge: evaluation.activeCharge
        ? {
            id: evaluation.activeCharge.id,
            providerChargeId: evaluation.activeCharge.providerChargeId,
            planType: evaluation.activeCharge.planType,
            amount: evaluation.activeCharge.amount,
            status: evaluation.activeCharge.status,
            dueAt: evaluation.activeCharge.dueAt,
            paidAt: evaluation.activeCharge.paidAt,
            qrCodePayload: evaluation.activeCharge.qrCodePayload,
          }
        : null,
    }),
  );
}
