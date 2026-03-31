import type {
  RuntimeWebhookDelivery,
  RuntimeWebhookResponse,
  RuntimeWebhookRoute,
  TerminalOutputEvent,
  TerminalPatternMode,
  TerminalSessionShell,
  TerminalSessionSnapshot,
  TerminalSignal,
} from "@/lib/runtime-types";

export interface DesktopRuntimeStatus {
  running: boolean;
  port: number;
  baseUrl: string;
}

export interface DesktopTerminalCommandOptions {
  projectId: string;
  sessionId?: string;
  shell?: TerminalSessionShell;
  workingDirectory?: string;
  cols?: number;
  rows?: number;
  command: string;
  timeoutMs?: number;
  patternMode?: TerminalPatternMode;
  pattern?: string;
  closeSessionAfterRun?: boolean;
}

export interface DesktopTerminalCommandResult {
  session: TerminalSessionSnapshot;
  output: string;
  cleanedOutput: string;
  promptReturned: boolean;
  successMatched: boolean;
  completionLine: string | null;
  completionPayload: string | null;
  exitCode: number | null;
  durationMs: number;
}

export function isDesktopRuntimeAvailable() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function buildDesktopTerminalSessionId(
  projectId: string,
  workflowId: string,
  sessionKey: string,
) {
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  return `terminal_${normalize(projectId)}_${normalize(workflowId)}_${normalize(sessionKey)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countPromptMarkers(output: string, marker: string) {
  if (!marker) return 0;
  return (output.match(new RegExp(escapeRegExp(marker), "g")) ?? []).length;
}

function hasPrompt(output: string, marker: string) {
  if (!marker) return false;
  return output
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .reverse()
    .some((line) => line.trimStart().startsWith(marker));
}

export function stripDesktopTerminalPromptMarkers(output: string, marker: string) {
  if (!marker) return output;
  return output
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => {
      const startTrimmed = line.trimStart();
      if (!startTrimmed.startsWith(marker)) return line;
      const leadingWhitespaceLength = line.length - startTrimmed.length;
      return `${line.slice(0, leadingWhitespaceLength)}${startTrimmed.slice(marker.length)}`;
    })
    .join("\n");
}

function extractTerminalPatternMatch(
  output: string,
  patternMode: TerminalPatternMode,
  pattern: string,
) {
  if (!pattern || patternMode === "none") {
    return {
      successMatched: true,
      completionLine: null,
      completionPayload: null,
    };
  }

  const normalizedOutput = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedOutput.split("\n");

  if (patternMode === "contains") {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index]?.trim();
      if (!line?.includes(pattern)) continue;
      const markerIndex = line.indexOf(pattern);
      return {
        successMatched: true,
        completionLine: line,
        completionPayload: line.slice(markerIndex + pattern.length).trim() || null,
      };
    }

    return {
      successMatched: false,
      completionLine: null,
      completionPayload: null,
    };
  }

  const regex = new RegExp(pattern, "gm");
  const matches = Array.from(normalizedOutput.matchAll(regex));
  const lastMatch = matches[matches.length - 1];

  if (!lastMatch) {
    return {
      successMatched: false,
      completionLine: null,
      completionPayload: null,
    };
  }

  const matchedText = lastMatch[0] ?? "";
  const completionLine = matchedText.trim() || null;
  const completionPayload =
    typeof lastMatch[1] === "string" && lastMatch[1].trim()
      ? lastMatch[1].trim()
      : completionLine;

  return {
    successMatched: true,
    completionLine,
    completionPayload,
  };
}

async function waitForTerminalCondition(
  sessionId: string,
  initialSnapshot: TerminalSessionSnapshot,
  timeoutMs: number,
  predicate: (snapshot: TerminalSessionSnapshot) => boolean,
) {
  if (predicate(initialSnapshot)) {
    return initialSnapshot;
  }

  return new Promise<TerminalSessionSnapshot>((resolve, reject) => {
    let finished = false;
    const timeoutId = window.setTimeout(() => {
      finished = true;
      dispose();
      reject(new Error("Terminal local excedeu o timeout aguardando o shell responder."));
    }, timeoutMs);

    let dispose = () => {};

    void listenDesktopTerminalEvents((event) => {
      if (finished || event.id !== sessionId) return;
      if (!predicate(event)) return;
      finished = true;
      window.clearTimeout(timeoutId);
      dispose();
      resolve(event);
    })
      .then((unlisten) => {
        dispose = unlisten;
      })
      .catch((error) => {
        finished = true;
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function getDesktopRuntimeStatus(): Promise<DesktopRuntimeStatus | null> {
  if (!isDesktopRuntimeAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopRuntimeStatus>("runtime_status");
}

export async function syncDesktopWebhookRoutes(routes: RuntimeWebhookRoute[]) {
  if (!isDesktopRuntimeAvailable()) return 0;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("runtime_sync_webhooks", { routes });
}

export async function completeDesktopWebhookDelivery(
  completion: RuntimeWebhookResponse & { deliveryId: string },
) {
  if (!isDesktopRuntimeAvailable()) return false;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("runtime_complete_webhook_delivery", {
    completion: {
      deliveryId: completion.deliveryId,
      status: completion.status,
      body: completion.body,
      headers: completion.headers ?? {},
    },
  });
}

export async function listenDesktopWebhookDeliveries(
  handler: (delivery: RuntimeWebhookDelivery) => void | Promise<void>,
) {
  if (!isDesktopRuntimeAvailable()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<RuntimeWebhookDelivery>("runtime://webhook", (event) => {
    void handler(event.payload);
  });

  return unlisten;
}

export async function openDesktopTerminalSession(input: {
  projectId: string;
  sessionId?: string;
  shell?: TerminalSessionShell;
  workingDirectory?: string;
  cols?: number;
  rows?: number;
}) {
  if (!isDesktopRuntimeAvailable()) {
    throw new Error("Terminal node is only available in the desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TerminalSessionSnapshot>("terminal_open_session", {
    input,
  });
}

export async function attachDesktopTerminalSession(projectId: string, sessionId: string) {
  if (!isDesktopRuntimeAvailable()) {
    throw new Error("Terminal node is only available in the desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TerminalSessionSnapshot>("terminal_attach_session", {
    input: {
      projectId,
      sessionId,
    },
  });
}

export async function listDesktopTerminalSessions(projectId?: string) {
  if (!isDesktopRuntimeAvailable()) return [];

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TerminalSessionSnapshot[]>("terminal_list_sessions", {
    projectId: projectId ?? null,
  });
}

export async function writeDesktopTerminalInput(input: {
  projectId: string;
  sessionId: string;
  data: string;
}) {
  if (!isDesktopRuntimeAvailable()) {
    throw new Error("Terminal node is only available in the desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TerminalSessionSnapshot>("terminal_write_input", {
    input,
  });
}

export async function resizeDesktopTerminalSession(input: {
  projectId: string;
  sessionId: string;
  cols: number;
  rows: number;
}) {
  if (!isDesktopRuntimeAvailable()) {
    throw new Error("Terminal node is only available in the desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TerminalSessionSnapshot>("terminal_resize_session", {
    input,
  });
}

export async function sendDesktopTerminalSignal(input: {
  projectId: string;
  sessionId: string;
  signal: TerminalSignal;
}) {
  if (!isDesktopRuntimeAvailable()) {
    throw new Error("Terminal node is only available in the desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TerminalSessionSnapshot>("terminal_send_signal", {
    input,
  });
}

export async function closeDesktopTerminalSession(projectId: string, sessionId: string) {
  if (!isDesktopRuntimeAvailable()) {
    throw new Error("Terminal node is only available in the desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TerminalSessionSnapshot>("terminal_close_session", {
    input: {
      projectId,
      sessionId,
    },
  });
}

export async function listenDesktopTerminalEvents(
  handler: (event: TerminalOutputEvent) => void | Promise<void>,
) {
  if (!isDesktopRuntimeAvailable()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<TerminalOutputEvent>("terminal://output", (event) => {
    void handler(event.payload);
  });

  return unlisten;
}

export async function runDesktopTerminalCommand(
  options: DesktopTerminalCommandOptions,
): Promise<DesktopTerminalCommandResult> {
  if (!isDesktopRuntimeAvailable()) {
    throw new Error("Terminal node is only available in the desktop app.");
  }

  const startedAt = Date.now();
  const timeoutMs = Math.max(options.timeoutMs ?? 900_000, 1_000);
  const patternMode = options.patternMode ?? "none";
  const pattern = options.pattern ?? "";

  let session = await openDesktopTerminalSession({
    projectId: options.projectId,
    sessionId: options.sessionId,
    shell: options.shell,
    workingDirectory: options.workingDirectory,
    cols: options.cols,
    rows: options.rows,
  });

  session = await waitForTerminalCondition(
    session.id,
    session,
    timeoutMs,
    (snapshot) =>
      snapshot.status !== "error" &&
      (snapshot.status === "exited" || hasPrompt(snapshot.output, snapshot.promptMarker)),
  );

  const baselineOutput = session.output;
  const promptCountBefore = countPromptMarkers(baselineOutput, session.promptMarker);

  const finalSnapshot = await new Promise<TerminalSessionSnapshot>((resolve, reject) => {
    let finished = false;
    const timeoutId = window.setTimeout(async () => {
      if (finished) return;
      finished = true;
      cleanup();
      try {
        await sendDesktopTerminalSignal({
          projectId: options.projectId,
          sessionId: session.id,
          signal: "SIGINT",
        });
      } catch {}
      reject(new Error("Terminal local excedeu o timeout aguardando o comando terminar."));
    }, timeoutMs);

    let cleanup = () => {};

    void listenDesktopTerminalEvents((event) => {
      if (finished || event.id !== session.id) return;

      const promptReturned =
        event.status === "exited" ||
        countPromptMarkers(event.output, event.promptMarker) > promptCountBefore;

      if (!promptReturned && event.status !== "error") return;

      finished = true;
      window.clearTimeout(timeoutId);
      cleanup();
      resolve(event);
    })
      .then(async (unlisten) => {
        cleanup = unlisten;
        await writeDesktopTerminalInput({
          projectId: options.projectId,
          sessionId: session.id,
          data: options.command.endsWith("\n") ? options.command : `${options.command}\n`,
        });
      })
      .catch((error) => {
        finished = true;
        window.clearTimeout(timeoutId);
        cleanup();
        reject(error);
      });
  });

  const rawSegment = finalSnapshot.output.slice(baselineOutput.length);
  const cleanedOutput = stripDesktopTerminalPromptMarkers(
    rawSegment,
    finalSnapshot.promptMarker,
  ).trim();
  const patternMatch = extractTerminalPatternMatch(cleanedOutput, patternMode, pattern);

  if (options.closeSessionAfterRun) {
    await closeDesktopTerminalSession(options.projectId, finalSnapshot.id);
  }

  return {
    session: finalSnapshot,
    output: rawSegment,
    cleanedOutput,
    promptReturned: finalSnapshot.status !== "error",
    successMatched: patternMatch.successMatched,
    completionLine: patternMatch.completionLine,
    completionPayload: patternMatch.completionPayload,
    exitCode: finalSnapshot.exitCode ?? null,
    durationMs: Date.now() - startedAt,
  };
}
