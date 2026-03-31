export const MCP_PROTOCOL_VERSION = "2025-11-25";
export const MCP_STORAGE_KEY = "flow-merge-mcp-config";
export const MCP_ENDPOINT_PATH = "/mcp";
export const MCP_SERVER_NAME = "flow-merge-local";
export const DEFAULT_MCP_ENDPOINT_URL = "http://127.0.0.1:45431/mcp";

export type McpPresetId = "codex" | "cursor" | "claude_code" | "vscode";

export type McpBridgeRequestKind =
  | "get_workspace_snapshot"
  | "get_workflow"
  | "set_active_workflow"
  | "run_assistant"
  | "read_resource";

export interface McpLocalConfig {
  enabled: boolean;
  authToken: string;
  serverName: string;
}

export interface DesktopMcpStatus {
  available: boolean;
  running: boolean;
  port: number;
  baseUrl: string;
  endpointUrl: string;
  enabled: boolean;
  serverName: string;
}

export interface McpBridgeRequest {
  requestId: string;
  kind: McpBridgeRequestKind;
  payload?: Record<string, unknown> | null;
}

export interface McpBridgeResponse {
  requestId: string;
  ok: boolean;
  payload?: unknown;
  error?: string | null;
}

export interface McpPresetSnippet {
  id: McpPresetId;
  title: string;
  subtitle: string;
  formatLabel: string;
  filePath: string;
  snippet: string;
  commandHint?: string;
}

function appendTokenToUrl(url: string, token: string) {
  const target = new URL(url);
  target.searchParams.set("token", token);
  return target.toString();
}

export function createMcpAuthToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function createDefaultMcpConfig(): McpLocalConfig {
  return {
    enabled: true,
    authToken: createMcpAuthToken(),
    serverName: MCP_SERVER_NAME,
  };
}

export function buildMcpConnectionUrl(
  status: Pick<DesktopMcpStatus, "endpointUrl"> | null,
  config: Pick<McpLocalConfig, "authToken">,
) {
  return appendTokenToUrl(
    status?.endpointUrl ?? DEFAULT_MCP_ENDPOINT_URL,
    config.authToken,
  );
}

export function buildMcpPresetSnippets(connectionUrl: string): McpPresetSnippet[] {
  return [
    {
      id: "codex",
      title: "Codex",
      subtitle: "Config global em TOML para CLI e extensao.",
      formatLabel: "TOML",
      filePath: "~/.codex/config.toml",
      snippet: `[mcp_servers.flow_merge]\nurl = "${connectionUrl}"`,
      commandHint: `codex mcp add flow_merge --url "${connectionUrl}"`,
    },
    {
      id: "cursor",
      title: "Cursor",
      subtitle: "MCP remoto via URL no mcp.json.",
      formatLabel: "JSON",
      filePath: "~/.cursor/mcp.json",
      snippet: `{\n  "mcpServers": {\n    "flow-merge": {\n      "url": "${connectionUrl}"\n    }\n  }\n}`,
    },
    {
      id: "claude_code",
      title: "Claude Code",
      subtitle: "Servidor HTTP em ~/.claude.json ou .mcp.json.",
      formatLabel: "JSON",
      filePath: "~/.claude.json ou .mcp.json",
      snippet: `{\n  "mcpServers": {\n    "flow-merge": {\n      "type": "http",\n      "url": "${connectionUrl}"\n    }\n  }\n}`,
      commandHint: `claude mcp add --transport http flow-merge "${connectionUrl}"`,
    },
    {
      id: "vscode",
      title: "VS Code / Copilot",
      subtitle: "Config local do workspace ou global.",
      formatLabel: "JSON",
      filePath: ".vscode/mcp.json",
      snippet: `{\n  "servers": {\n    "flow-merge": {\n      "type": "http",\n      "url": "${connectionUrl}"\n    }\n  }\n}`,
    },
  ];
}
