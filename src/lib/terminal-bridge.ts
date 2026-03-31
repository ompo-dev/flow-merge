import type { TerminalOutputEvent, TerminalSessionSnapshot } from "@/lib/runtime-types";

export const TERMINAL_BRIDGE_STORAGE_KEY = "flow-merge-terminal-bridge-config";
export const DEFAULT_TERMINAL_BRIDGE_ENDPOINT_URL = "http://127.0.0.1:45431/terminal";

export interface TerminalBridgeLocalConfig {
  enabled: boolean;
  endpointUrl: string;
  authToken: string;
}

export interface DesktopTerminalBridgeStatus {
  available: boolean;
  running: boolean;
  port: number;
  baseUrl: string;
  endpointUrl: string;
  enabled: boolean;
}

export interface TerminalBridgeStreamTarget {
  endpointUrl: string;
  projectId: string;
  sessionId: string;
  authToken: string;
}

function createLocalToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function normalizeTerminalBridgeEndpointUrl(value: string | null | undefined) {
  const raw = value?.trim() || DEFAULT_TERMINAL_BRIDGE_ENDPOINT_URL;
  return raw.replace(/\/+$/, "");
}

export function createDefaultTerminalBridgeConfig(): TerminalBridgeLocalConfig {
  return {
    enabled: false,
    endpointUrl: DEFAULT_TERMINAL_BRIDGE_ENDPOINT_URL,
    authToken: createLocalToken(),
  };
}

export function readStoredTerminalBridgeConfig(): TerminalBridgeLocalConfig {
  if (typeof window === "undefined") {
    return createDefaultTerminalBridgeConfig();
  }

  try {
    const raw = window.localStorage.getItem(TERMINAL_BRIDGE_STORAGE_KEY);
    if (!raw) {
      return createDefaultTerminalBridgeConfig();
    }

    const parsed = JSON.parse(raw) as Partial<TerminalBridgeLocalConfig>;
    const fallback = createDefaultTerminalBridgeConfig();
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : fallback.enabled,
      endpointUrl: normalizeTerminalBridgeEndpointUrl(parsed.endpointUrl),
      authToken:
        typeof parsed.authToken === "string" && parsed.authToken.trim()
          ? parsed.authToken.trim()
          : fallback.authToken,
    };
  } catch {
    return createDefaultTerminalBridgeConfig();
  }
}

export function persistTerminalBridgeConfig(config: TerminalBridgeLocalConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    TERMINAL_BRIDGE_STORAGE_KEY,
    JSON.stringify({
      ...config,
      endpointUrl: normalizeTerminalBridgeEndpointUrl(config.endpointUrl),
      authToken: config.authToken.trim(),
    }),
  );
}

export function buildTerminalBridgeHeaders(
  config: Pick<TerminalBridgeLocalConfig, "authToken">,
) {
  return {
    Authorization: `Bearer ${config.authToken.trim()}`,
  };
}

export function buildTerminalBridgeStreamUrl(target: TerminalBridgeStreamTarget) {
  const url = new URL(
    `${normalizeTerminalBridgeEndpointUrl(target.endpointUrl)}/sessions/${encodeURIComponent(
      target.sessionId,
    )}/stream`,
  );
  url.searchParams.set("projectId", target.projectId);
  url.searchParams.set("token", target.authToken.trim());
  return url.toString();
}

export async function probeTerminalBridgeStatus(
  endpointUrl: string,
): Promise<DesktopTerminalBridgeStatus | null> {
  try {
    const response = await fetch(
      `${normalizeTerminalBridgeEndpointUrl(endpointUrl)}/status`,
      {
        method: "GET",
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as DesktopTerminalBridgeStatus;
    return {
      ...payload,
      endpointUrl: normalizeTerminalBridgeEndpointUrl(payload.endpointUrl),
    };
  } catch {
    return null;
  }
}

export async function openBridgeTerminalSession(
  config: Pick<TerminalBridgeLocalConfig, "endpointUrl" | "authToken">,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${normalizeTerminalBridgeEndpointUrl(config.endpointUrl)}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildTerminalBridgeHeaders(config),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readTerminalBridgeError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function attachBridgeTerminalSession(
  config: Pick<TerminalBridgeLocalConfig, "endpointUrl" | "authToken">,
  projectId: string,
  sessionId: string,
) {
  const url = new URL(
    `${normalizeTerminalBridgeEndpointUrl(config.endpointUrl)}/sessions/${encodeURIComponent(
      sessionId,
    )}`,
  );
  url.searchParams.set("projectId", projectId);

  const response = await fetch(url, {
    method: "GET",
    headers: buildTerminalBridgeHeaders(config),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readTerminalBridgeError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function writeBridgeTerminalInput(
  config: Pick<TerminalBridgeLocalConfig, "endpointUrl" | "authToken">,
  body: Record<string, unknown> & { sessionId: string },
) {
  const response = await fetch(
    `${normalizeTerminalBridgeEndpointUrl(config.endpointUrl)}/sessions/${encodeURIComponent(
      body.sessionId,
    )}/input`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildTerminalBridgeHeaders(config),
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(await readTerminalBridgeError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function resizeBridgeTerminalSession(
  config: Pick<TerminalBridgeLocalConfig, "endpointUrl" | "authToken">,
  body: Record<string, unknown> & { sessionId: string },
) {
  const response = await fetch(
    `${normalizeTerminalBridgeEndpointUrl(config.endpointUrl)}/sessions/${encodeURIComponent(
      body.sessionId,
    )}/resize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildTerminalBridgeHeaders(config),
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(await readTerminalBridgeError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function signalBridgeTerminalSession(
  config: Pick<TerminalBridgeLocalConfig, "endpointUrl" | "authToken">,
  body: Record<string, unknown> & { sessionId: string },
) {
  const response = await fetch(
    `${normalizeTerminalBridgeEndpointUrl(config.endpointUrl)}/sessions/${encodeURIComponent(
      body.sessionId,
    )}/signal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildTerminalBridgeHeaders(config),
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(await readTerminalBridgeError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function closeBridgeTerminalSession(
  config: Pick<TerminalBridgeLocalConfig, "endpointUrl" | "authToken">,
  projectId: string,
  sessionId: string,
) {
  const url = new URL(
    `${normalizeTerminalBridgeEndpointUrl(config.endpointUrl)}/sessions/${encodeURIComponent(
      sessionId,
    )}`,
  );
  url.searchParams.set("projectId", projectId);

  const response = await fetch(url, {
    method: "DELETE",
    headers: buildTerminalBridgeHeaders(config),
  });

  if (!response.ok) {
    throw new Error(await readTerminalBridgeError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function listenBridgeTerminalEvents(
  target: TerminalBridgeStreamTarget,
  handler: (event: TerminalOutputEvent | TerminalSessionSnapshot, type: string) => void,
) {
  const stream = new EventSource(buildTerminalBridgeStreamUrl(target));

  const onSnapshot = (raw: Event) => {
    try {
      handler(JSON.parse((raw as MessageEvent<string>).data) as TerminalSessionSnapshot, "snapshot");
    } catch {
      // Ignore malformed stream payloads.
    }
  };

  const onOutput = (raw: Event) => {
    try {
      const payload = JSON.parse((raw as MessageEvent<string>).data) as TerminalOutputEvent;
      handler(payload, payload.channel);
    } catch {
      // Ignore malformed stream payloads.
    }
  };

  stream.addEventListener("snapshot", onSnapshot);
  stream.addEventListener("terminal.output", onOutput);
  stream.addEventListener("terminal.exit", onOutput);

  return () => {
    stream.removeEventListener("snapshot", onSnapshot);
    stream.removeEventListener("terminal.output", onOutput);
    stream.removeEventListener("terminal.exit", onOutput);
    stream.close();
  };
}

async function readTerminalBridgeError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return payload.message || payload.error || `Terminal bridge request failed (${response.status}).`;
  } catch {
    return `Terminal bridge request failed (${response.status}).`;
  }
}
