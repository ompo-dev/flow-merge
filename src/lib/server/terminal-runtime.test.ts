import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TerminalOutputEvent, TerminalSessionShell } from "@/lib/runtime-types";

vi.mock("server-only", () => ({}));

let terminalRuntime: typeof import("@/lib/server/terminal-runtime");

const PROJECT_ID = "proj_terminal_runtime_test";

function getShell(): TerminalSessionShell {
  return process.platform === "win32" ? "cmd" : "bash";
}

function getEnterKey(shell: TerminalSessionShell) {
  return shell === "bash" || shell === "zsh" ? "\n" : "\r\n";
}

async function waitForTerminalEvent(
  projectId: string,
  sessionId: string,
  predicate: (event: TerminalOutputEvent) => boolean,
  timeoutMs = 15_000,
) {
  return await new Promise<TerminalOutputEvent>((resolve, reject) => {
    let finished = false;
    const timeoutId = setTimeout(() => {
      finished = true;
      unsubscribe();
      reject(new Error("Timed out waiting for terminal output."));
    }, timeoutMs);

    const unsubscribe = terminalRuntime.subscribeOutput({ projectId, sessionId }, (event) => {
      if (finished || !predicate(event)) return;
      finished = true;
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(event);
    });
  });
}

async function closeIfExists(projectId: string, sessionId: string) {
  try {
    terminalRuntime.closeSession(projectId, sessionId);
  } catch {
    // session already gone
  }
}

beforeAll(async () => {
  terminalRuntime = await import("@/lib/server/terminal-runtime");
});

afterEach(async () => {
  await closeIfExists(PROJECT_ID, "terminal_runtime_echo");
  await closeIfExists(PROJECT_ID, "terminal_runtime_resize");
});

describe("terminal-runtime", () => {
  it("opens a session, accepts input, and returns shell output", async () => {
    const shell = getShell();
    const session = await terminalRuntime.openSession({
      projectId: PROJECT_ID,
      sessionId: "terminal_runtime_echo",
      shell,
      cols: 120,
      rows: 24,
    });

    const marker = "FLOW_MERGE_RUNTIME_TEST";

    terminalRuntime.writeInput({
      projectId: PROJECT_ID,
      sessionId: session.id,
      data: `echo ${marker}${getEnterKey(shell)}`,
    });

    const event = await waitForTerminalEvent(
      PROJECT_ID,
      session.id,
      (outputEvent) =>
        outputEvent.output.includes(marker) &&
        outputEvent.output.includes(outputEvent.promptMarker),
    );

    expect(event.output).toContain(marker);
    expect(event.promptMarker).toBeTruthy();

    const snapshot = terminalRuntime.attachSession(PROJECT_ID, session.id);
    expect(snapshot.output).toContain(marker);
    expect(snapshot.promptMarker).toContain("FLOW_MERGE_PROMPT");
  });

  it("resizes a session and keeps the snapshot in sync", async () => {
    const shell = getShell();
    const session = await terminalRuntime.openSession({
      projectId: PROJECT_ID,
      sessionId: "terminal_runtime_resize",
      shell,
      cols: 80,
      rows: 20,
    });

    const resized = terminalRuntime.resizeSession({
      projectId: PROJECT_ID,
      sessionId: session.id,
      cols: 132,
      rows: 32,
    });

    expect(resized.cols).toBe(132);
    expect(resized.rows).toBe(32);

    const snapshot = terminalRuntime.attachSession(PROJECT_ID, session.id);
    expect(snapshot.cols).toBe(132);
    expect(snapshot.rows).toBe(32);
  });
});
