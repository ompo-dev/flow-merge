import {
  listSessions,
  openSession,
} from "@/lib/server/terminal-runtime";
import {
  parseTerminalBody,
  requireTerminalSession,
  terminalJsonError,
  terminalOpenSessionSchema,
} from "@/lib/server/terminal-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const authFailure = await requireTerminalSession();
  if (authFailure) return authFailure;

  const { projectId } = await context.params;
  return Response.json(listSessions(projectId));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const authFailure = await requireTerminalSession();
  if (authFailure) return authFailure;

  const parsed = await parseTerminalBody(request, terminalOpenSessionSchema);
  if ("response" in parsed) return parsed.response;

  const { projectId } = await context.params;

  try {
    const snapshot = await openSession({
      projectId,
      sessionId: parsed.data.sessionId,
      shell: parsed.data.shell,
      workingDirectory: parsed.data.workingDirectory,
      cols: parsed.data.cols,
      rows: parsed.data.rows,
      initialOutput: parsed.data.initialOutput,
    });

    return Response.json(snapshot);
  } catch (error) {
    return terminalJsonError(
      error instanceof Error ? error.message : "Falha ao abrir a sessao do terminal.",
      400,
    );
  }
}
