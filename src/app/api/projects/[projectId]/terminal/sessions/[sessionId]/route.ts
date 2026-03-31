import {
  attachSession,
  closeSession,
} from "@/lib/server/terminal-runtime";
import {
  requireTerminalSession,
  terminalJsonError,
} from "@/lib/server/terminal-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  const authFailure = await requireTerminalSession();
  if (authFailure) return authFailure;

  const { projectId, sessionId } = await context.params;

  try {
    return Response.json(attachSession(projectId, sessionId));
  } catch (error) {
    return terminalJsonError(
      error instanceof Error ? error.message : "Sessao de terminal nao encontrada.",
      404,
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  const authFailure = await requireTerminalSession();
  if (authFailure) return authFailure;

  const { projectId, sessionId } = await context.params;

  try {
    return Response.json(closeSession(projectId, sessionId));
  } catch (error) {
    return terminalJsonError(
      error instanceof Error ? error.message : "Sessao de terminal nao encontrada.",
      404,
    );
  }
}
