import type { XYPosition } from "@xyflow/react";
import type { Project, ToolMode, Workflow, WorkflowNodeData } from "@/lib/flow-types";
import type { NodeTypeId } from "@/lib/node-catalog";

export const MCP_PROTOCOL_VERSION = "2025-11-25";
export const MCP_STORAGE_KEY = "flow-merge-mcp-config";
export const MCP_ENDPOINT_PATH = "/mcp";
export const MCP_SERVER_NAME = "flow-merge-local";
export const DEFAULT_MCP_ENDPOINT_URL = "http://127.0.0.1:45431/mcp";

export type McpPresetId = "codex" | "cursor" | "claude_code" | "vscode";

export type McpBridgeRequestKind =
  | "get_workspace_snapshot"
  | "get_node_catalog"
  | "get_workflow"
  | "create_project"
  | "create_workflow"
  | "set_active_workflow"
  | "apply_workspace_change_set"
  | "apply_workflow_change_set"
  | "read_resource";

export interface McpNodeReference {
  nodeId?: string;
  alias?: string;
  label?: string;
}

export interface McpCreateNodeOperation {
  type: "create_node";
  alias?: string;
  nodeType: NodeTypeId;
  position?: XYPosition;
  data?: Partial<WorkflowNodeData>;
}

export interface McpCreateShapeOperation {
  type: "create_shape";
  alias?: string;
  shapeType: NonNullable<WorkflowNodeData["shapeType"]>;
  position?: XYPosition;
  width?: number;
  height?: number;
  label?: string;
  text?: string;
  fill?: string;
  strokeColor?: string;
}

export interface McpUpdateNodeOperation {
  type: "update_node";
  node: McpNodeReference;
  data?: Partial<WorkflowNodeData>;
}

export interface McpMoveNodeOperation {
  type: "move_node";
  node: McpNodeReference;
  position: XYPosition;
}

export interface McpResizeNodeOperation {
  type: "resize_node";
  node: McpNodeReference;
  width: number;
  height: number;
}

export interface McpDuplicateNodeOperation {
  type: "duplicate_node";
  node: McpNodeReference;
  alias?: string;
}

export interface McpDeleteNodeOperation {
  type: "delete_node";
  node: McpNodeReference;
}

export interface McpCreateEdgeOperation {
  type: "create_edge";
  source: McpNodeReference;
  target: McpNodeReference;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface McpDeleteEdgeOperation {
  type: "delete_edge";
  edgeId?: string;
  source?: McpNodeReference;
  target?: McpNodeReference;
}

export type McpWorkflowChangeOperation =
  | McpCreateNodeOperation
  | McpCreateShapeOperation
  | McpUpdateNodeOperation
  | McpMoveNodeOperation
  | McpResizeNodeOperation
  | McpDuplicateNodeOperation
  | McpDeleteNodeOperation
  | McpCreateEdgeOperation
  | McpDeleteEdgeOperation;

export interface McpProjectDraft {
  name: string;
  description?: string;
  accent?: string;
  surface?: "app" | "landing";
  activate?: boolean;
}

export interface McpWorkflowDraft {
  name: string;
  projectId?: string;
  description?: string;
  accent?: string;
  surface?: Workflow["surface"];
  tags?: string[];
  activate?: boolean;
}

export interface McpWorkflowPatch {
  name?: string;
  description?: string;
  accent?: string;
  surface?: Workflow["surface"];
  tags?: string[];
  active?: boolean;
}

export interface McpWorkflowChangeSet {
  workflowId?: string;
  activate?: boolean;
  workflowPatch?: McpWorkflowPatch;
  operations: McpWorkflowChangeOperation[];
}

export interface McpProjectPatch {
  name?: string;
  description?: string;
  accent?: string;
  surface?: Project["surface"];
  active?: boolean;
}

export interface McpUpdateProjectOperation {
  type: "update_project";
  projectId: string;
  patch: McpProjectPatch;
}

export interface McpToggleProjectActiveOperation {
  type: "toggle_project_active";
  projectId: string;
}

export interface McpDeleteProjectOperation {
  type: "delete_project";
  projectId: string;
}

export interface McpDuplicateProjectOperation {
  type: "duplicate_project";
  projectId: string;
  name?: string;
  activate?: boolean;
}

export interface McpUpdateWorkflowOperation {
  type: "update_workflow";
  workflowId: string;
  patch: McpWorkflowPatch;
}

export interface McpToggleWorkflowActiveOperation {
  type: "toggle_workflow_active";
  workflowId: string;
}

export interface McpDeleteWorkflowOperation {
  type: "delete_workflow";
  workflowId: string;
}

export interface McpDuplicateWorkflowOperation {
  type: "duplicate_workflow";
  workflowId: string;
  name?: string;
  targetProjectId?: string;
  activate?: boolean;
}

export interface McpSetActiveProjectOperation {
  type: "set_active_project";
  projectId: string;
}

export interface McpSetActiveToolOperation {
  type: "set_active_tool";
  tool: ToolMode;
}

export type McpWorkspaceChangeOperation =
  | McpUpdateProjectOperation
  | McpToggleProjectActiveOperation
  | McpDeleteProjectOperation
  | McpDuplicateProjectOperation
  | McpUpdateWorkflowOperation
  | McpToggleWorkflowActiveOperation
  | McpDeleteWorkflowOperation
  | McpDuplicateWorkflowOperation
  | McpSetActiveProjectOperation
  | McpSetActiveToolOperation;

export interface McpWorkspaceChangeSet {
  operations: McpWorkspaceChangeOperation[];
}

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

/** Base MCP URL (no query) + token, for presets where clients omit ?token= on POST (e.g. Cursor Streamable HTTP). */
function splitConnectionUrlForPresets(connectionUrl: string): {
  baseUrl: string;
  token: string;
} {
  try {
    const u = new URL(connectionUrl);
    const token = u.searchParams.get("token")?.trim() ?? "";
    u.search = "";
    return { baseUrl: u.toString(), token };
  } catch {
    return { baseUrl: connectionUrl, token: "" };
  }
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
  const { baseUrl, token } = splitConnectionUrlForPresets(connectionUrl);

  const cursorSnippet =
    token.length > 0
      ? JSON.stringify(
          {
            mcpServers: {
              "flow-merge": {
                url: baseUrl,
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            },
          },
          null,
          2,
        )
      : `{\n  "mcpServers": {\n    "flow-merge": {\n      "url": "${connectionUrl}"\n    }\n  }\n}`;

  const vscodeSnippet =
    token.length > 0
      ? JSON.stringify(
          {
            servers: {
              "flow-merge": {
                type: "http",
                url: baseUrl,
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            },
          },
          null,
          2,
        )
      : `{\n  "servers": {\n    "flow-merge": {\n      "type": "http",\n      "url": "${connectionUrl}"\n    }\n  }\n}`;

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
      subtitle:
        "mcp.json com URL sem query e token em Authorization (o Streamable HTTP do Cursor costuma nao repassar ?token= no POST).",
      formatLabel: "JSON",
      filePath: "~/.cursor/mcp.json",
      snippet: cursorSnippet,
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
      snippet: vscodeSnippet,
    },
  ];
}
