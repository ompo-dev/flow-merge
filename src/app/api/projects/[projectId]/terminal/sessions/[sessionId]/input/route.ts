import { writeInput } from "@/lib/server/terminal-runtime";
import {
  parseTerminalBody,
  requireTerminalSession,
  terminalInputSchema,
  terminalJsonError,
} from "@/lib/server/terminal-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  const authFailure = await requireTerminalSession();
  if (authFailure) return authFailure;

  const parsed = await parseTerminalBody(request, terminalInputSchema);
  if ("response" in parsed) return parsed.response;

  const { projectId, sessionId } = await context.params;

  try {
    return Response.json(
      writeInput({
        projectId,
        sessionId,
        data: parsed.data.data,
      }),
    );
  } catch (error) {
    return terminalJsonError(
      error instanceof Error ? error.message : "Falha ao enviar input ao terminal.",
      404,
    );
  }
}
