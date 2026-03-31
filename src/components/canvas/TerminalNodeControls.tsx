"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import type { IDisposable, Terminal as XTermType } from "xterm";
import {
  attachLocalTerminalSession,
  buildLocalTerminalSessionId,
  getLocalTerminalAvailability,
  listenLocalTerminalSessionEvents,
  openLocalTerminalSession,
  resizeLocalTerminalSession,
  writeLocalTerminalInput,
} from "@/lib/local-terminal";
import type { TerminalSessionSnapshot } from "@/lib/runtime-types";
import { useFlowStore } from "@/store/useFlowStore";

interface TerminalNodeControlsProps {
  nodeId: string;
  shell: TerminalViewState["shell"];
  workingDirectory: string;
  onActivate?: () => void;
}

type TerminalSessionStatus = TerminalSessionSnapshot["status"] | "disconnected";

type TerminalViewState = {
  workingDirectory: string;
  sessionStatus: TerminalSessionStatus;
  lastExitCode: number | null;
  shell: "cmd" | "powershell" | "bash" | "zsh";
};

type XTermPrivateCore = {
  _renderService?: {
    hasRenderer?: () => boolean;
  };
  viewport?: {
    __flowMergeViewportGuardPatched?: boolean;
    syncScrollArea?: (immediate?: boolean) => void;
    _innerRefresh?: () => void;
  };
};

const TERMINAL_RESIZE_DEBOUNCE_MS = 120;
const TERMINAL_STATUS_ACTIVITY_HOLD_MS = 900;

function getShellEnterKey(shell: TerminalViewState["shell"]) {
  return shell === "bash" || shell === "zsh" ? "\n" : "\r\n";
}

function formatShellLabel(shell: string) {
  if (shell === "powershell") return "PowerShell";
  if (shell === "cmd") return "Command Prompt";
  if (shell === "zsh") return "zsh";
  return "bash";
}

function mapViewState(
  shell: TerminalViewState["shell"],
  workingDirectory: string,
): TerminalViewState {
  return {
    shell,
    workingDirectory: workingDirectory || ".",
    sessionStatus: "disconnected",
    lastExitCode: null,
  };
}

function updateViewState(
  setViewState: Dispatch<SetStateAction<TerminalViewState>>,
  nextState: TerminalViewState,
) {
  setViewState((current) => {
    if (
      current.workingDirectory === nextState.workingDirectory &&
      current.sessionStatus === nextState.sessionStatus &&
      current.lastExitCode === nextState.lastExitCode &&
      current.shell === nextState.shell
    ) {
      return current;
    }

    return nextState;
  });
}

function getTerminalWindowTitle(shell: string, workingDirectory: string) {
  return `${formatShellLabel(shell)}  ${workingDirectory}`;
}

function createTerminalTheme() {
  return {
    background: "#0c0c0c",
    foreground: "#f2f2f2",
    cursor: "#f2f2f2",
    cursorAccent: "#0c0c0c",
    selectionBackground: "rgba(255,255,255,0.16)",
    black: "#0c0c0c",
    red: "#ff7b72",
    green: "#9fd28f",
    yellow: "#f2cc60",
    blue: "#73b8ff",
    magenta: "#c792ea",
    cyan: "#7bdff2",
    white: "#f2f2f2",
    brightBlack: "#6b7280",
    brightRed: "#ff9b93",
    brightGreen: "#c5f29b",
    brightYellow: "#ffe08a",
    brightBlue: "#9dcdff",
    brightMagenta: "#ddb7ff",
    brightCyan: "#a5f0ff",
    brightWhite: "#ffffff",
  };
}

function sanitizeTerminalOutput(output: string, promptMarker: string) {
  if (!promptMarker) return output;
  return output
    .replaceAll(`${promptMarker}\r\n`, "")
    .replaceAll(`${promptMarker}\n`, "")
    .replaceAll(`${promptMarker}\r`, "")
    .replaceAll(promptMarker, "");
}

function getXTermPrivateCore(xterm: XTermType | null | undefined): XTermPrivateCore | null {
  if (!xterm) return null;
  return (xterm as { _core?: XTermPrivateCore })._core ?? null;
}

function hasXTermRenderer(xterm: XTermType | null | undefined) {
  const core = getXTermPrivateCore(xterm);
  return Boolean(core?._renderService?.hasRenderer?.());
}

function guardXTermViewport(xterm: XTermType) {
  const viewport = getXTermPrivateCore(xterm)?.viewport;
  if (!viewport || viewport.__flowMergeViewportGuardPatched) return;

  const originalSyncScrollArea = viewport.syncScrollArea?.bind(viewport);
  const originalInnerRefresh = viewport._innerRefresh?.bind(viewport);

  if (originalSyncScrollArea) {
    viewport.syncScrollArea = (immediate?: boolean) => {
      if (!hasXTermRenderer(xterm)) return;
      return originalSyncScrollArea(immediate);
    };
  }

  if (originalInnerRefresh) {
    viewport._innerRefresh = () => {
      if (!hasXTermRenderer(xterm)) return;
      return originalInnerRefresh();
    };
  }

  viewport.__flowMergeViewportGuardPatched = true;
}

export function TerminalNodeControls({
  nodeId,
  shell,
  workingDirectory,
  onActivate,
}: TerminalNodeControlsProps) {
  const activeProjectId = useFlowStore((state) => state.activeProjectId);
  const activeWorkflowId = useFlowStore((state) => state.activeWorkflowId);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const dataDisposableRef = useRef<IDisposable | null>(null);
  const renderDisposableRef = useRef<IDisposable | null>(null);
  const outputRef = useRef("");
  const latestSnapshotRef = useRef<TerminalSessionSnapshot | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const ensureSessionPromiseRef = useRef<Promise<TerminalSessionSnapshot> | null>(null);
  const inputActivityUntilRef = useRef(0);
  const focusWithinRef = useRef(false);
  const ignoreNextSyntheticFocusRef = useRef(false);
  const pointerActivationRef = useRef(false);
  const statusHoldTimeoutRef = useRef<number | null>(null);

  const sessionId = useMemo(() => {
    if (!activeProjectId || !activeWorkflowId) return null;
    return buildLocalTerminalSessionId(activeProjectId, activeWorkflowId, nodeId);
  }, [activeProjectId, activeWorkflowId, nodeId]);
  const availability = useMemo(() => getLocalTerminalAvailability(), []);
  const canUseTerminal = Boolean(activeProjectId && activeWorkflowId && sessionId && availability.available);

  const [viewState, setViewState] = useState<TerminalViewState>(() =>
    mapViewState(shell, workingDirectory),
  );
  const [displayStatus, setDisplayStatus] = useState<TerminalSessionStatus>("disconnected");
  const [infoMessage, setInfoMessage] = useState("");

  const focusTerminal = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  const focusTerminalShell = useCallback(() => {
    window.requestAnimationFrame(() => {
      focusTerminal();
    });
  }, [focusTerminal]);

  const clearStatusHoldTimeout = useCallback(() => {
    if (statusHoldTimeoutRef.current !== null) {
      window.clearTimeout(statusHoldTimeoutRef.current);
      statusHoldTimeoutRef.current = null;
    }
  }, []);

  const syncDisplayStatus = useCallback(() => {
    clearStatusHoldTimeout();
    const delay = inputActivityUntilRef.current - Date.now();
    if (delay > 0) {
      statusHoldTimeoutRef.current = window.setTimeout(() => {
        statusHoldTimeoutRef.current = null;
        setDisplayStatus(viewState.sessionStatus);
      }, delay);
      return;
    }
    setDisplayStatus(viewState.sessionStatus);
  }, [clearStatusHoldTimeout, viewState.sessionStatus]);

  const renderOutput = useCallback((output: string) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    const previousOutput = outputRef.current;
    if (!previousOutput.length) {
      if (output.length) xterm.write(output);
      outputRef.current = output;
      return;
    }

    if (output.startsWith(previousOutput)) {
      const delta = output.slice(previousOutput.length);
      if (delta.length) xterm.write(delta);
      outputRef.current = output;
      return;
    }

    xterm.reset();
    if (output.length) xterm.write(output);
    outputRef.current = output;
  }, []);

  const applySnapshot = useCallback(
    (snapshot: TerminalSessionSnapshot, options?: { syncOutput?: boolean }) => {
      latestSnapshotRef.current = snapshot;
      sessionIdRef.current = snapshot.id;
      if (options?.syncOutput ?? true) {
        renderOutput(sanitizeTerminalOutput(snapshot.output, snapshot.promptMarker));
      }
      updateViewState(setViewState, {
        workingDirectory: snapshot.workingDirectory || ".",
        sessionStatus: snapshot.status,
        lastExitCode: snapshot.exitCode,
        shell: snapshot.shell,
      });
    },
    [renderOutput],
  );

  const closeEventStream = useCallback(() => {
    unlistenRef.current?.();
    unlistenRef.current = null;
  }, []);

  const connectEventStream = useCallback(
    async (projectId: string, currentSessionId: string) => {
      closeEventStream();
      unlistenRef.current = await listenLocalTerminalSessionEvents(
        projectId,
        currentSessionId,
        (event) => {
          if (event.type === "snapshot") {
            applySnapshot(event.snapshot, { syncOutput: true });
            return;
          }
          applySnapshot(event.event, { syncOutput: true });
        },
      );
    },
    [applySnapshot, closeEventStream],
  );

  const ensureSession = useCallback(async () => {
    if (!activeProjectId || !sessionId) {
      throw new Error("Selecione um projeto e workflow para abrir o terminal.");
    }

    if (!availability.available) {
      throw new Error(
        availability.reason || "Permita o terminal local para usar o shell no navegador.",
      );
    }

    if (ensureSessionPromiseRef.current) {
      return await ensureSessionPromiseRef.current;
    }

    if (
      sessionIdRef.current === sessionId &&
      latestSnapshotRef.current?.id === sessionId &&
      unlistenRef.current
    ) {
      return latestSnapshotRef.current;
    }

    ensureSessionPromiseRef.current = (async () => {
      const xterm = xtermRef.current;
      const cols = Math.max(xterm?.cols ?? 120, 40);
      const rows = Math.max(xterm?.rows ?? 18, 12);

      try {
        const attached = await attachLocalTerminalSession(activeProjectId, sessionId);
        applySnapshot(attached, { syncOutput: true });
        await connectEventStream(activeProjectId, attached.id);
        return attached;
      } catch {
        let opened = await openLocalTerminalSession({
          projectId: activeProjectId,
          sessionId,
          shell,
          workingDirectory,
          cols,
          rows,
        });
        if (!opened.output.trim()) {
          opened = await writeLocalTerminalInput({
            projectId: opened.projectId,
            sessionId: opened.id,
            data: getShellEnterKey(opened.shell),
          });
        }
        applySnapshot(opened, { syncOutput: true });
        await connectEventStream(activeProjectId, opened.id);
        return opened;
      }
    })().finally(() => {
      ensureSessionPromiseRef.current = null;
    });

    return await ensureSessionPromiseRef.current;
  }, [
    activeProjectId,
    applySnapshot,
    availability.available,
    availability.reason,
    connectEventStream,
    sessionId,
    shell,
    workingDirectory,
  ]);

  const syncResize = useCallback(async () => {
    const xterm = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    const currentSessionId = sessionIdRef.current;
    if (!xterm || !fitAddon || !activeProjectId || !currentSessionId) return;
    if (!hasXTermRenderer(xterm)) return;

    try {
      const proposed = fitAddon.proposeDimensions();
      if (!proposed) return;
      fitAddon.fit();
    } catch {
      return;
    }

    const nextCols = Math.max(xterm.cols, 40);
    const nextRows = Math.max(xterm.rows, 12);
    try {
      const snapshot = await resizeLocalTerminalSession({
        projectId: activeProjectId,
        sessionId: currentSessionId,
        cols: nextCols,
        rows: nextRows,
      });
      applySnapshot(snapshot, { syncOutput: false });
    } catch {
      // Ignore transient resize errors while the user drags the canvas.
    }
  }, [activeProjectId, applySnapshot]);

  useEffect(() => {
    const markSyntheticFocusGuard = () => {
      ignoreNextSyntheticFocusRef.current = true;
      pointerActivationRef.current = false;
      focusWithinRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markSyntheticFocusGuard();
      }
    };

    window.addEventListener("blur", markSyntheticFocusGuard);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", markSyntheticFocusGuard);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    updateViewState(setViewState, mapViewState(shell, workingDirectory));
    setDisplayStatus(canUseTerminal ? "idle" : "disconnected");
  }, [canUseTerminal, shell, workingDirectory]);

  useEffect(() => {
    let disposed = false;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const setupTerminal = async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) return;

      const xterm = new Terminal({
        cursorBlink: true,
        fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.18,
        allowTransparency: false,
        convertEol: false,
        scrollback: 8000,
        theme: createTerminalTheme(),
      });
      const fitAddon = new FitAddon();

      xterm.loadAddon(fitAddon);
      xterm.open(viewport);
      guardXTermViewport(xterm);
      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      dataDisposableRef.current = xterm.onData((data) => {
        inputActivityUntilRef.current = Date.now() + TERMINAL_STATUS_ACTIVITY_HOLD_MS;
        setDisplayStatus("running");
        void ensureSession()
          .then((snapshot) =>
            writeLocalTerminalInput({
              projectId: snapshot.projectId,
              sessionId: snapshot.id,
              data,
            }),
          )
          .then((nextSnapshot) => {
            applySnapshot(nextSnapshot, { syncOutput: true });
          })
          .catch((error) => {
            setInfoMessage(
              error instanceof Error ? error.message : "Falha ao enviar input ao terminal.",
            );
          });
      });

      let hasAppliedInitialFit = false;
      renderDisposableRef.current = xterm.onRender(() => {
        if (hasAppliedInitialFit) return;
        hasAppliedInitialFit = true;
        void syncResize();
      });

      resizeObserverRef.current = new ResizeObserver(() => {
        if (resizeTimeoutRef.current !== null) {
          window.clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = window.setTimeout(() => {
          void syncResize();
        }, TERMINAL_RESIZE_DEBOUNCE_MS);
      });
      resizeObserverRef.current.observe(viewport);

      if (canUseTerminal) {
        void ensureSession().catch((error) => {
          setInfoMessage(
            error instanceof Error ? error.message : "Falha ao iniciar a sessao do terminal.",
          );
        });
      }
    };

    void setupTerminal();

    return () => {
      disposed = true;
      clearStatusHoldTimeout();
      closeEventStream();
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      renderDisposableRef.current?.dispose();
      renderDisposableRef.current = null;
      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = null;
      fitAddonRef.current = null;
      latestSnapshotRef.current = null;
      xtermRef.current?.dispose();
      xtermRef.current = null;
    };
  }, [canUseTerminal, clearStatusHoldTimeout, closeEventStream, ensureSession, syncResize]);

  useEffect(() => {
    if (viewState.sessionStatus === "idle") {
      syncDisplayStatus();
      return;
    }
    clearStatusHoldTimeout();
    setDisplayStatus(viewState.sessionStatus);
  }, [clearStatusHoldTimeout, syncDisplayStatus, viewState.sessionStatus]);

  return (
    <div
      data-workspace-surface="true"
      data-workspace-terminal="true"
      data-testid="terminal-node-surface"
      className="flex h-[560px] w-[860px] min-h-0 max-w-[860px] min-w-[860px] flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0c0c0c] text-[#f2f2f2]"
      onPointerDownCapture={() => {
        onActivate?.();
      }}
      onFocusCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
        if (focusWithinRef.current) return;
        focusWithinRef.current = true;
        if (ignoreNextSyntheticFocusRef.current && !pointerActivationRef.current) {
          ignoreNextSyntheticFocusRef.current = false;
          return;
        }
        ignoreNextSyntheticFocusRef.current = false;
        pointerActivationRef.current = false;
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
        focusWithinRef.current = false;
      }}
    >
      <div className="terminal-node-drag-handle flex items-center justify-between gap-3 border-b border-white/8 bg-[#1f1f1f] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/18" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/18" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/18" />
          </div>
          <p className="truncate text-[11px] uppercase tracking-[0.16em] text-white/72">
            {getTerminalWindowTitle(viewState.shell, viewState.workingDirectory)}
          </p>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/62">
          {displayStatus}
        </span>
      </div>

      <div
        data-workspace-control="true"
        className="nodrag nopan relative min-h-0 flex-1"
        onPointerDownCapture={() => {
          pointerActivationRef.current = true;
          ignoreNextSyntheticFocusRef.current = false;
          focusTerminalShell();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div
          ref={viewportRef}
          data-workspace-control="true"
          className="flow-merge-terminal-host nodrag nopan h-full min-h-0 w-full overflow-hidden px-4 py-4 font-mono"
        />
      </div>

      <div className="flex items-center justify-between border-t border-white/8 bg-[#111111] px-4 py-2.5 font-mono text-[11px] text-white/54">
        <span className="truncate">{viewState.workingDirectory}</span>
        <span>
          {viewState.lastExitCode === null ? displayStatus : `exit ${viewState.lastExitCode}`}
        </span>
      </div>

      {infoMessage ? (
        <div className="border-t border-white/8 bg-[#111111] px-3 py-2 text-[11px] text-[#d29922]">
          {infoMessage}
        </div>
      ) : null}
    </div>
  );
}
