import {
  attachSession,
  subscribeOutput,
} from "@/lib/server/terminal-runtime";
import {
  requireTerminalSession,
  terminalJsonError,
} from "@/lib/server/terminal-route";
import type { TerminalSessionSnapshot } from "@/lib/runtime-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function encodeSseEvent(event: string, payload: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function encodeKeepAlive() {
  return encoder.encode(": keep-alive\n\n");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  const authFailure = await requireTerminalSession();
  if (authFailure) return authFailure;

  const { projectId, sessionId } = await context.params;

  let snapshot: TerminalSessionSnapshot;
  try {
    snapshot = attachSession(projectId, sessionId);
  } catch (error) {
    return terminalJsonError(
      error instanceof Error ? error.message : "Sessao de terminal nao encontrada.",
      404,
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encodeSseEvent("snapshot", snapshot));

      const unsubscribe = subscribeOutput(
        { projectId, sessionId },
        (event) => {
          controller.enqueue(encodeSseEvent(event.channel, event));
        },
      );

      const keepAliveId = setInterval(() => {
        controller.enqueue(encodeKeepAlive());
      }, 15_000);

      const abortHandler = () => {
        clearInterval(keepAliveId);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", abortHandler, { once: true });
    },
    cancel() {
      // resources are disposed by the request abort listener
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
