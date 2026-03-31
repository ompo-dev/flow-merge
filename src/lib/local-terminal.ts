"use client";

import {
  attachDesktopTerminalSession,
  buildDesktopTerminalSessionId,
  closeDesktopTerminalSession,
  isDesktopRuntimeAvailable,
  listenDesktopTerminalEvents,
  openDesktopTerminalSession,
  resizeDesktopTerminalSession,
  runDesktopTerminalCommand,
  sendDesktopTerminalSignal,
  stripDesktopTerminalPromptMarkers,
  writeDesktopTerminalInput,
} from "@/lib/tauri-runtime";
import type {
  TerminalOutputEvent,
  TerminalPatternMode,
  TerminalSessionShell,
  TerminalSessionSnapshot,
  TerminalSignal,
} from "@/lib/runtime-types";
import {
  attachWebTerminalSession,
  buildWebTerminalStreamUrl,
  closeWebTerminalSession,
  listenWebTerminalEvents,
  openWebTerminalSession,
  resizeWebTerminalSession,
  signalWebTerminalSession,
  writeWebTerminalInput,
} from "@/lib/web-terminal";

export interface LocalTerminalSessionInput {
  projectId: string;
  sessionId?: string;
  shell?: TerminalSessionShell;
  workingDirectory?: string;
  cols?: number;
  rows?: number;
}

export interface LocalTerminalWriteInput {
  projectId: string;
  sessionId: string;
  data: string;
}

export interface LocalTerminalResizeInput {
  projectId: string;
  sessionId: string;
  cols: number;
  rows: number;
}

export interface LocalTerminalSignalInput {
  projectId: string;
  sessionId: string;
  signal: TerminalSignal;
}

export interface LocalTerminalCommandOptions extends LocalTerminalSessionInput {
  command: string;
  timeoutMs?: number;
  patternMode?: TerminalPatternMode;
  pattern?: string;
  closeSessionAfterRun?: boolean;
}

export interface LocalTerminalCommandResult {
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

export type LocalTerminalTransport = "desktop" | "web";

export type LocalTerminalSessionEvent =
  | {
      type: "snapshot";
      snapshot: TerminalSessionSnapshot;
      transport: LocalTerminalTransport;
    }
  | {
      type: "output";
      event: TerminalOutputEvent;
      transport: LocalTerminalTransport;
    };

export interface LocalTerminalAvailability {
  available: boolean;
  transport: LocalTerminalTransport | null;
  reason: string | null;
}

function countPromptMarkers(output: string, marker: string) {
  if (!marker) return 0;
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (output.match(new RegExp(escaped, "g")) ?? []).length;
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

function getTransport() {
  if (isDesktopRuntimeAvailable()) {
    return {
      transport: "desktop" as const,
    };
  }

  return {
    transport: "web" as const,
  };
}

export function getLocalTerminalAvailability(): LocalTerminalAvailability {
  if (isDesktopRuntimeAvailable()) {
    return {
      available: true,
      transport: "desktop",
      reason: null,
    };
  }

  return {
    available: true,
    transport: "web",
    reason: null,
  };
}

export function buildLocalTerminalSessionId(
  projectId: string,
  workflowId: string,
  sessionKey: string,
) {
  return buildDesktopTerminalSessionId(projectId, workflowId, sessionKey);
}

export async function openLocalTerminalSession(input: LocalTerminalSessionInput) {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    return openDesktopTerminalSession(input);
  }

  return openWebTerminalSession(
    input.projectId,
    input as unknown as Record<string, unknown>,
  );
}

export async function attachLocalTerminalSession(projectId: string, sessionId: string) {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    return attachDesktopTerminalSession(projectId, sessionId);
  }

  return attachWebTerminalSession(projectId, sessionId);
}

export async function writeLocalTerminalInput(input: LocalTerminalWriteInput) {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    return writeDesktopTerminalInput(input);
  }

  return writeWebTerminalInput(
    input.projectId,
    input.sessionId,
    input as unknown as Record<string, unknown>,
  );
}

export async function resizeLocalTerminalSession(input: LocalTerminalResizeInput) {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    return resizeDesktopTerminalSession(input);
  }

  return resizeWebTerminalSession(
    input.projectId,
    input.sessionId,
    input as unknown as Record<string, unknown>,
  );
}

export async function sendLocalTerminalSignal(input: LocalTerminalSignalInput) {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    return sendDesktopTerminalSignal(input);
  }

  return signalWebTerminalSession(
    input.projectId,
    input.sessionId,
    input as unknown as Record<string, unknown>,
  );
}

export async function closeLocalTerminalSession(projectId: string, sessionId: string) {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    return closeDesktopTerminalSession(projectId, sessionId);
  }

  return closeWebTerminalSession(projectId, sessionId);
}

export async function listenLocalTerminalSessionEvents(
  projectId: string,
  sessionId: string,
  handler: (event: LocalTerminalSessionEvent) => void | Promise<void>,
) {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    const unlisten = await listenDesktopTerminalEvents((event) => {
      if (event.id !== sessionId || event.projectId !== projectId) return;
      void handler({
        type: "output",
        event,
        transport: "desktop",
      });
    });

    return unlisten;
  }

  return listenWebTerminalEvents(
    {
      projectId,
      sessionId,
    },
    (payload, type) => {
      if (type === "snapshot") {
        void handler({
          type: "snapshot",
          snapshot: payload as TerminalSessionSnapshot,
          transport: "web",
        });
        return;
      }

      void handler({
        type: "output",
        event: payload as TerminalOutputEvent,
        transport: "web",
      });
    },
  );
}

async function waitForWebTerminalCondition(
  session: TerminalSessionSnapshot,
  timeoutMs: number,
  predicate: (snapshot: TerminalSessionSnapshot) => boolean,
) {
  if (predicate(session)) {
    return session;
  }

  return new Promise<TerminalSessionSnapshot>((resolve, reject) => {
    let finished = false;
    let dispose = () => {};
    const timeoutId = window.setTimeout(() => {
      finished = true;
      dispose();
      reject(new Error("Terminal local excedeu o timeout aguardando o shell responder."));
    }, timeoutMs);

    void listenWebTerminalEvents(
      {
        projectId: session.projectId,
        sessionId: session.id,
      },
      (payload, type) => {
        if (finished) return;
        const snapshot =
          type === "snapshot"
            ? (payload as TerminalSessionSnapshot)
            : (payload as TerminalOutputEvent);

        if (!predicate(snapshot)) return;

        finished = true;
        window.clearTimeout(timeoutId);
        dispose();
        resolve(snapshot);
      },
    )
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

async function runWebTerminalCommand(
  options: LocalTerminalCommandOptions,
): Promise<LocalTerminalCommandResult> {
  const startedAt = Date.now();
  const timeoutMs = Math.max(options.timeoutMs ?? 900_000, 1_000);
  const patternMode = options.patternMode ?? "none";
  const pattern = options.pattern ?? "";

  let session = await openWebTerminalSession(options.projectId, {
    projectId: options.projectId,
    sessionId: options.sessionId,
    shell: options.shell,
    workingDirectory: options.workingDirectory,
    cols: options.cols,
    rows: options.rows,
  } as unknown as Record<string, unknown>);

  session = await waitForWebTerminalCondition(
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
    let cleanup = () => {};
    const timeoutId = window.setTimeout(async () => {
      if (finished) return;
      finished = true;
      cleanup();

      try {
        await signalWebTerminalSession(options.projectId, session.id, {
          projectId: options.projectId,
          sessionId: session.id,
          signal: "SIGINT",
        });
      } catch {}

      reject(new Error("Terminal local excedeu o timeout aguardando o comando terminar."));
    }, timeoutMs);

    void listenWebTerminalEvents(
      {
        projectId: options.projectId,
        sessionId: session.id,
      },
      (payload, type) => {
        if (finished) return;
        if (type === "snapshot") return;

        const event = payload as TerminalOutputEvent;
        const promptReturned =
          event.status === "exited" ||
          countPromptMarkers(event.output, event.promptMarker) > promptCountBefore;

        if (!promptReturned && event.status !== "error") return;

        finished = true;
        window.clearTimeout(timeoutId);
        cleanup();
        resolve(event);
      },
    )
      .then(async (unlisten) => {
        cleanup = unlisten;
        await writeWebTerminalInput(
          options.projectId,
          session.id,
          {
            projectId: options.projectId,
            sessionId: session.id,
            data: options.command.endsWith("\n")
              ? options.command
              : `${options.command}\n`,
          } as unknown as Record<string, unknown>,
        );
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
    await closeWebTerminalSession(options.projectId, finalSnapshot.id);
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

export async function runLocalTerminalCommand(
  options: LocalTerminalCommandOptions,
): Promise<LocalTerminalCommandResult> {
  const selection = getTransport();

  if (selection.transport === "desktop") {
    return runDesktopTerminalCommand(options);
  }

  return runWebTerminalCommand(options);
}

export function getLocalTerminalStreamUrl(projectId: string, sessionId: string) {
  if (isDesktopRuntimeAvailable()) return null;

  return buildWebTerminalStreamUrl({
    projectId,
    sessionId,
  });
}
