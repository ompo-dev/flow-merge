import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  cancelUserAccess,
  evaluateUserAccessState,
  hardDeleteUserAccount,
} from "@/lib/server/license-service";

export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return Response.json(
      { error: "Sessao invalida." },
      { status: 401 },
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

  if (
    evaluation.user.accessState !== "active_monthly" &&
    evaluation.user.accessState !== "active_lifetime"
  ) {
    return Response.json(
      { error: "Nao existe plano ativo para cancelar." },
      { status: 409 },
    );
  }

  await cancelUserAccess(session.user.id);

  return Response.json({
    success: true,
  });
}
