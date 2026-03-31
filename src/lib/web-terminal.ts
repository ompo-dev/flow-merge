import type { TerminalOutputEvent, TerminalSessionSnapshot } from "@/lib/runtime-types";

export interface WebTerminalStreamTarget {
  projectId: string;
  sessionId: string;
}

function readErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Falha ao acessar o terminal local.";
}

async function readWebTerminalError(response: Response) {
  try {
    return readErrorMessage(await response.json());
  } catch {
    return "Falha ao acessar o terminal local.";
  }
}

export function buildWebTerminalStreamUrl(target: WebTerminalStreamTarget) {
  return `/api/projects/${encodeURIComponent(target.projectId)}/terminal/sessions/${encodeURIComponent(
    target.sessionId,
  )}/stream`;
}

export async function openWebTerminalSession(
  projectId: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/terminal/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await readWebTerminalError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function attachWebTerminalSession(projectId: string, sessionId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/terminal/sessions/${encodeURIComponent(
      sessionId,
    )}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await readWebTerminalError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function writeWebTerminalInput(
  projectId: string,
  sessionId: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/terminal/sessions/${encodeURIComponent(
      sessionId,
    )}/input`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(await readWebTerminalError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function resizeWebTerminalSession(
  projectId: string,
  sessionId: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/terminal/sessions/${encodeURIComponent(
      sessionId,
    )}/resize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(await readWebTerminalError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function signalWebTerminalSession(
  projectId: string,
  sessionId: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/terminal/sessions/${encodeURIComponent(
      sessionId,
    )}/signal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(await readWebTerminalError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function closeWebTerminalSession(projectId: string, sessionId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/terminal/sessions/${encodeURIComponent(
      sessionId,
    )}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(await readWebTerminalError(response));
  }

  return (await response.json()) as TerminalSessionSnapshot;
}

export async function listenWebTerminalEvents(
  target: WebTerminalStreamTarget,
  handler: (
    payload: TerminalSessionSnapshot | TerminalOutputEvent,
    type: "snapshot" | TerminalOutputEvent["channel"],
  ) => void | Promise<void>,
) {
  const stream = new EventSource(buildWebTerminalStreamUrl(target));

  stream.addEventListener("snapshot", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as TerminalSessionSnapshot;
      void handler(payload, "snapshot");
    } catch {
      // ignore malformed payloads
    }
  });

  stream.addEventListener("terminal.output", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as TerminalOutputEvent;
      void handler(payload, "terminal.output");
    } catch {
      // ignore malformed payloads
    }
  });

  stream.addEventListener("terminal.exit", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as TerminalOutputEvent;
      void handler(payload, "terminal.exit");
    } catch {
      // ignore malformed payloads
    }
  });

  stream.onerror = () => {
    if (stream.readyState === EventSource.CLOSED) {
      stream.close();
    }
  };

  return () => {
    stream.close();
  };
}
