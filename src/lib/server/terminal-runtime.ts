import "server-only";

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  TerminalOutputEvent,
  TerminalSessionShell,
  TerminalSessionSnapshot,
  TerminalSessionStatus,
  TerminalSignal,
} from "@/lib/runtime-types";

interface PtyRuntime {
  onData: (callback: (chunk: string) => void) => void;
  onExit: (callback: (event: { exitCode?: number; signal?: number }) => void) => void;
  write: (input: string) => void;
  resize?: (cols: number, rows: number) => void;
  kill?: () => void;
}

interface TerminalSessionRecord {
  id: string;
  projectId: string;
  shell: TerminalSessionShell;
  workingDirectory: string;
  status: TerminalSessionStatus;
  output: string;
  promptMarker: string;
  createdAt: string;
  updatedAt: string;
  exitCode: number | null;
  cols: number;
  rows: number;
  runtime: PtyRuntime;
  subscribers: Set<(event: TerminalOutputEvent) => void>;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

interface TerminalRegistry {
  sessions: Map<string, TerminalSessionRecord>;
}

type PtyModule = {
  spawn: (
    file: string,
    args: string[],
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
    },
  ) => {
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(): void;
    onData(callback: (data: string) => void): void;
    onExit(callback: (event: { exitCode?: number; signal?: number }) => void): void;
  };
};

const MAX_OUTPUT_SIZE = 400_000;
const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g",
);
const TERMINAL_PROMPT_MARKER = "__FLOW_MERGE_PROMPT__:";
const NODE_PTY_HOST_PATH = fileURLToPath(new URL("./node-pty-host.mjs", import.meta.url));
const NUL_CHARACTER = String.fromCharCode(0);

function nowIso() {
  return new Date().toISOString();
}

function getTerminalRegistry() {
  const globalRegistry = globalThis as typeof globalThis & {
    __flowMergeTerminalRegistry?: TerminalRegistry;
  };

  if (!globalRegistry.__flowMergeTerminalRegistry) {
    globalRegistry.__flowMergeTerminalRegistry = {
      sessions: new Map<string, TerminalSessionRecord>(),
    };
  }

  return globalRegistry.__flowMergeTerminalRegistry;
}

function trimOutput(output: string) {
  if (output.length <= MAX_OUTPUT_SIZE) return output;
  return output.slice(output.length - MAX_OUTPUT_SIZE);
}

function normalizeOutputLines(output: string) {
  return output
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replaceAll(NUL_CHARACTER, "").trimEnd());
}

function inferWorkingDirectoryFromPrompt(promptMarker: string, output: string) {
  const lines = normalizeOutputLines(output);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmed = (lines[index] ?? "").trim();
    const markerIndex = trimmed.indexOf(promptMarker);
    if (markerIndex === -1) continue;

    const promptBody = trimmed.slice(markerIndex + promptMarker.length).trim();
    const normalized = promptBody.replace(/[>$#]\s*$/, "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function hasPromptMarker(output: string, promptMarker: string) {
  return normalizeOutputLines(output).some((line) => line.trimStart().startsWith(promptMarker));
}

function snapshotSession(session: TerminalSessionRecord): TerminalSessionSnapshot {
  return {
    id: session.id,
    projectId: session.projectId,
    shell: session.shell,
    workingDirectory: session.workingDirectory,
    status: session.status,
    output: session.output,
    promptMarker: session.promptMarker,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    exitCode: session.exitCode,
    cols: session.cols,
    rows: session.rows,
  };
}

function emitOutput(
  session: TerminalSessionRecord,
  channel: TerminalOutputEvent["channel"],
  chunk: string,
) {
  const event: TerminalOutputEvent = {
    id: session.id,
    projectId: session.projectId,
    shell: session.shell,
    workingDirectory: session.workingDirectory,
    status: session.status,
    output: session.output,
    promptMarker: session.promptMarker,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    exitCode: session.exitCode,
    cols: session.cols,
    rows: session.rows,
    channel,
    chunk,
  };

  session.subscribers.forEach((subscriber) => {
    subscriber(event);
  });
}

function emitSessionState(session: TerminalSessionRecord) {
  emitOutput(session, "terminal.output", "");
}

function clearIdleTimer(session: TerminalSessionRecord) {
  if (!session.idleTimer) return;
  clearTimeout(session.idleTimer);
  session.idleTimer = null;
}

function markSessionRunning(session: TerminalSessionRecord) {
  session.status = "running";
  session.updatedAt = nowIso();
  clearIdleTimer(session);
  session.idleTimer = setTimeout(() => {
    if (session.status === "error" || session.status === "exited") return;
    session.status = "idle";
    session.updatedAt = nowIso();
    emitSessionState(session);
  }, 250);
}

function appendOutput(session: TerminalSessionRecord, chunk: string) {
  session.output = trimOutput(`${session.output}${chunk}`);

  const nextWorkingDirectory = inferWorkingDirectoryFromPrompt(
    session.promptMarker,
    session.output,
  );
  if (nextWorkingDirectory) {
    session.workingDirectory = nextWorkingDirectory;
  }

  if (hasPromptMarker(chunk, session.promptMarker)) {
    clearIdleTimer(session);
    session.status = "idle";
  } else {
    markSessionRunning(session);
  }

  session.updatedAt = nowIso();
}

function resolveWorkingDirectory(input?: string) {
  const configuredWorkspaceDir =
    process.env.FLOW_MERGE_WORKSPACE_DIR?.trim() || process.env.LYNX_WORKSPACE_DIR?.trim();

  if (!input?.trim()) {
    if (configuredWorkspaceDir) {
      return resolve(configuredWorkspaceDir);
    }

    return resolve(process.cwd());
  }

  const desired = resolve(input.trim());
  if (existsSync(desired)) {
    return desired;
  }

  if (configuredWorkspaceDir) {
    return resolve(configuredWorkspaceDir);
  }

  return resolve(homedir());
}

function resolveShellRuntime(shell?: TerminalSessionShell) {
  const nextShell = shell ?? (process.platform === "win32" ? "cmd" : "bash");

  if (nextShell === "cmd") {
    return {
      shell: "cmd" as const,
      command: process.platform === "win32" ? "cmd.exe" : "sh",
      args: process.platform === "win32"
        ? ["/Q", "/K", "prompt", `${TERMINAL_PROMPT_MARKER}$P$G`]
        : ["-i"],
      env: {} as Record<string, string>,
    };
  }

  if (nextShell === "powershell") {
    return {
      shell: "powershell" as const,
      command: process.platform === "win32" ? "powershell.exe" : "pwsh",
      args: process.platform === "win32"
        ? [
            "-NoLogo",
            "-NoProfile",
            "-NoExit",
            "-Command",
            `function global:prompt { "${TERMINAL_PROMPT_MARKER}$($executionContext.SessionState.Path.CurrentLocation)> " }`,
          ]
        : ["-NoLogo", "-NoProfile"],
      env: {} as Record<string, string>,
    };
  }

  if (nextShell === "zsh") {
    const env: Record<string, string> = {
      PROMPT: `${TERMINAL_PROMPT_MARKER}%~$ `,
    };

    return {
      shell: "zsh" as const,
      command: "zsh",
      args: ["-f", "-i"],
      env,
    };
  }

  const env: Record<string, string> = {
    PS1: `${TERMINAL_PROMPT_MARKER}\\w$ `,
  };

  return {
    shell: "bash" as const,
    command: "bash",
    args: ["--noprofile", "--norc", "-i"],
    env,
  };
}

async function loadPtyModule() {
  try {
    return (await import("node-pty")) as PtyModule;
  } catch {
    return null;
  }
}

function createChildProcessRuntime(child: ChildProcessWithoutNullStreams): PtyRuntime {
  const dataListeners = new Set<(chunk: string) => void>();
  const exitListeners = new Set<(event: { exitCode?: number; signal?: number }) => void>();

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    dataListeners.forEach((listener) => {
      listener(text);
    });
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    dataListeners.forEach((listener) => {
      listener(text);
    });
  });

  child.on("close", (exitCode, signal) => {
    exitListeners.forEach((listener) => {
      listener({
        exitCode: exitCode ?? undefined,
        signal: typeof signal === "number" ? signal : undefined,
      });
    });
  });

  return {
    onData: (callback) => {
      dataListeners.add(callback);
    },
    onExit: (callback) => {
      exitListeners.add(callback);
    },
    write: (input) => {
      child.stdin.write(input);
    },
    kill: () => {
      child.kill();
    },
  };
}

function createFallbackRuntime(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    windowsHide: true,
    stdio: "pipe",
  });

  return createChildProcessRuntime(child);
}

function resolveNodeHostCommand() {
  return process.platform === "win32" ? "node.exe" : "node";
}

async function createNodeHostRuntime(
  command: string,
  args: string[],
  cwd: string,
  cols: number,
  rows: number,
  env: Record<string, string>,
) {
  return await new Promise<PtyRuntime>((resolveRuntime, rejectRuntime) => {
    const child = spawn(resolveNodeHostCommand(), [NODE_PTY_HOST_PATH], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      stdio: "pipe",
    });
    const stdoutListeners = new Set<(chunk: string) => void>();
    const exitListeners = new Set<(event: { exitCode?: number; signal?: number }) => void>();
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let ready = false;
    let settled = false;
    let exitEmitted = false;

    const emitExit = (event: { exitCode?: number; signal?: number }) => {
      if (exitEmitted) return;
      exitEmitted = true;
      exitListeners.forEach((listener) => {
        listener(event);
      });
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      rejectRuntime(new Error(message));
    };

    const runtime: PtyRuntime = {
      onData: (callback) => {
        stdoutListeners.add(callback);
      },
      onExit: (callback) => {
        exitListeners.add(callback);
      },
      write: (input) => {
        child.stdin.write(
          `${JSON.stringify({
            type: "input",
            data: Buffer.from(input, "utf8").toString("base64"),
          })}\n`,
        );
      },
      resize: (nextCols, nextRows) => {
        child.stdin.write(
          `${JSON.stringify({
            type: "resize",
            cols: nextCols,
            rows: nextRows,
          })}\n`,
        );
      },
      kill: () => {
        child.stdin.write(`${JSON.stringify({ type: "kill" })}\n`);
        setTimeout(() => {
          if (!child.killed) {
            child.kill();
          }
        }, 50);
      },
    };

    const handleHostMessage = (line: string) => {
      if (!line.trim()) return;

      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }

      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }

      const typedMessage = message as
        | { type: "ready" }
        | { type: "data"; chunk: string }
        | { type: "exit"; exitCode?: number | null; signal?: number | null }
        | { type: "error"; message: string };

      if (typedMessage.type === "ready") {
        if (settled) return;
        settled = true;
        ready = true;
        resolveRuntime(runtime);
        return;
      }

      if (typedMessage.type === "data") {
        const chunk = Buffer.from(typedMessage.chunk, "base64").toString("utf8");
        stdoutListeners.forEach((listener) => {
          listener(chunk);
        });
        return;
      }

      if (typedMessage.type === "exit") {
        emitExit({
          exitCode: typedMessage.exitCode ?? undefined,
          signal: typedMessage.signal ?? undefined,
        });
        return;
      }

      if (!ready) {
        fail(typedMessage.message || "Falha ao iniciar o terminal PTY.");
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();

      while (true) {
        const newlineIndex = stdoutBuffer.indexOf("\n");
        if (newlineIndex === -1) break;

        const line = stdoutBuffer.slice(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        handleHostMessage(line);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
    });

    child.on("error", (error) => {
      fail(error.message || "Falha ao iniciar o processo host do terminal.");
    });

    child.on("close", (exitCode, signal) => {
      if (!ready) {
        const failureMessage =
          stderrBuffer.trim() ||
          `Falha ao iniciar o terminal PTY (codigo ${exitCode ?? "desconhecido"}).`;
        fail(failureMessage);
        return;
      }

      emitExit({
        exitCode: exitCode ?? undefined,
        signal: typeof signal === "number" ? signal : undefined,
      });
    });

    child.stdin.write(
      `${JSON.stringify({
        type: "init",
        command,
        args,
        cwd,
        cols,
        rows,
        env,
      })}\n`,
    );
  });
}

async function createRuntime(shell: TerminalSessionShell, cwd: string, cols: number, rows: number) {
  const resolved = resolveShellRuntime(shell);
  const safeEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const env = {
    ...safeEnv,
    ...resolved.env,
  };
  const isBunRuntime =
    typeof globalThis === "object" &&
    "Bun" in globalThis &&
    Boolean((globalThis as { Bun?: unknown }).Bun);

  if (isBunRuntime) {
    return {
      runtime: await createNodeHostRuntime(
        resolved.command,
        resolved.args,
        cwd,
        cols,
        rows,
        env,
      ),
      shell: resolved.shell,
    };
  }

  const ptyModule = await loadPtyModule();

  if (ptyModule?.spawn) {
    const processHandle = ptyModule.spawn(resolved.command, resolved.args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env,
    });

    return {
      runtime: {
        onData: (callback) => {
          processHandle.onData(callback);
        },
        onExit: (callback) => {
          processHandle.onExit(callback);
        },
        write: (input) => {
          processHandle.write(input);
        },
        resize: (nextCols, nextRows) => {
          processHandle.resize(nextCols, nextRows);
        },
        kill: () => {
          processHandle.kill();
        },
      } satisfies PtyRuntime,
      shell: resolved.shell,
    };
  }

  return {
    runtime: createFallbackRuntime(resolved.command, resolved.args, cwd, env),
    shell: resolved.shell,
  };
}

function getSession(projectId: string, sessionId: string) {
  const session = getTerminalRegistry().sessions.get(sessionId);
  if (!session || session.projectId !== projectId) {
    throw new Error("Sessao de terminal nao encontrada.");
  }
  return session;
}

export async function openSession(input: {
  projectId: string;
  sessionId?: string;
  shell?: TerminalSessionShell;
  workingDirectory?: string;
  cols?: number;
  rows?: number;
  initialOutput?: string;
}) {
  const registry = getTerminalRegistry();
  const createdAt = nowIso();
  const workingDirectory = resolveWorkingDirectory(input.workingDirectory);
  const cols = Math.max(input.cols ?? 120, 40);
  const rows = Math.max(input.rows ?? 30, 12);
  const sessionId =
    input.sessionId?.trim() || `terminal_${Math.random().toString(36).slice(2, 10)}`;

  const existing = registry.sessions.get(sessionId);
  if (existing) {
    if (existing.projectId !== input.projectId) {
      throw new Error("Sessao de terminal ja pertence a outro projeto.");
    }
    return snapshotSession(existing);
  }

  const { runtime, shell } = await createRuntime(
    input.shell ?? (process.platform === "win32" ? "cmd" : "bash"),
    workingDirectory,
    cols,
    rows,
  );

  const session: TerminalSessionRecord = {
    id: sessionId,
    projectId: input.projectId,
    shell,
    workingDirectory,
    status: "idle",
    output: trimOutput(input.initialOutput ?? ""),
    promptMarker: TERMINAL_PROMPT_MARKER,
    createdAt,
    updatedAt: createdAt,
    exitCode: null,
    cols,
    rows,
    runtime,
    subscribers: new Set(),
    idleTimer: null,
  };

  runtime.onData((chunk) => {
    appendOutput(session, chunk);
    emitOutput(session, "terminal.output", chunk);
  });

  runtime.onExit((event) => {
    clearIdleTimer(session);
    session.status = "exited";
    session.exitCode = event.exitCode ?? null;
    session.updatedAt = nowIso();
    emitOutput(session, "terminal.exit", "");
  });

  registry.sessions.set(session.id, session);
  return snapshotSession(session);
}

export function attachSession(projectId: string, sessionId: string) {
  return snapshotSession(getSession(projectId, sessionId));
}

export function listSessions(projectId?: string) {
  return [...getTerminalRegistry().sessions.values()]
    .filter((session) => (projectId ? session.projectId === projectId : true))
    .map((session) => snapshotSession(session));
}

export function writeInput(input: { projectId: string; sessionId: string; data: string }) {
  const session = getSession(input.projectId, input.sessionId);
  session.runtime.write(input.data);
  markSessionRunning(session);
  return snapshotSession(session);
}

export function resizeSession(input: {
  projectId: string;
  sessionId: string;
  cols: number;
  rows: number;
}) {
  const session = getSession(input.projectId, input.sessionId);
  session.cols = Math.max(input.cols, 40);
  session.rows = Math.max(input.rows, 12);
  session.runtime.resize?.(session.cols, session.rows);
  session.updatedAt = nowIso();
  return snapshotSession(session);
}

export function sendSignal(input: {
  projectId: string;
  sessionId: string;
  signal: TerminalSignal;
}) {
  const session = getSession(input.projectId, input.sessionId);

  if (input.signal === "SIGINT") {
    session.runtime.write("\u0003");
  } else if (input.signal === "EOF") {
    session.runtime.write("\u0004");
  } else {
    session.runtime.kill?.();
  }

  session.updatedAt = nowIso();
  return snapshotSession(session);
}

export function subscribeOutput(
  input: { projectId: string; sessionId: string },
  subscriber: (event: TerminalOutputEvent) => void,
) {
  const session = getSession(input.projectId, input.sessionId);
  session.subscribers.add(subscriber);

  return () => {
    session.subscribers.delete(subscriber);
  };
}

export function closeSession(projectId: string, sessionId: string) {
  const session = getSession(projectId, sessionId);
  session.runtime.kill?.();
  clearIdleTimer(session);
  session.status = "exited";
  session.updatedAt = nowIso();
  getTerminalRegistry().sessions.delete(sessionId);
  return snapshotSession(session);
}
