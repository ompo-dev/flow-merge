import type { Edge, Node, XYPosition } from "@xyflow/react";
import type { NodeTypeId } from "@/lib/node-catalog";

export interface DashboardWidget {
  id: string;
  type: "metric" | "linechart" | "barchart" | "piechart" | "table" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: string[];
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
}

export interface NodeIOSchema {
  input?: JSONSchema;
  output?: JSONSchema;
}

export interface NodeRuntimeInfo {
  status: "idle" | "running" | "success" | "error" | "skipped";
  summary?: string;
  error?: string;
  lastRunAt?: number;
  itemCount?: number;
  inputPreview?: unknown;
  outputPreview?: unknown;
}

export type NodeProgrammingMode = "builtin" | "code";

export interface NodeProgrammingConfig {
  mode: NodeProgrammingMode;
  code: string;
  outputTemplate: string;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeTypeId;
  description?: string;
  icon?: string;
  badge?: string;
  accent?: string;
  subtle?: string;
  disabled?: boolean;
  notes?: string;
  parameters?: Record<string, string>;
  config?: Record<string, unknown>;
  schema?: NodeIOSchema;
  chartType?: "line" | "bar" | "area";
  vizVariant?: "revenue" | "conversion" | "users" | "errors" | "aov" | "custom";
  shapeType?: "rect" | "ellipse" | "diamond" | "arrow" | "text";
  width?: number;
  height?: number;
  fill?: string;
  strokeColor?: string;
  text?: string;
  widgets?: DashboardWidget[];
  runtime?: NodeRuntimeInfo;
  programmable?: NodeProgrammingConfig;
}

export type AppNode = Node<WorkflowNodeData>;

export interface Project {
  id: string;
  name: string;
  description?: string;
  accent?: string;
  active: boolean;
}

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  accent?: string;
  active: boolean;
  nodes: AppNode[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
  description?: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "success" | "error" | "running";
  startedAt: string;
  duration?: number;
  itemsProcessed?: number;
}

export type ToolMode =
  | "select"
  | "hand"
  | "rect"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "text"
  | "eraser";

export interface GenerativeComponent {
  component: "metric" | "chart" | "table" | "text";
  props: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  generativeUI?: GenerativeComponent[];
  streaming?: boolean;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AiNodeSpec {
  alias?: string;
  nodeType: NodeTypeId;
  label?: string;
  description?: string;
  notes?: string;
  parameters?: Record<string, unknown>;
  config?: Record<string, unknown>;
  programmable?: Partial<NodeProgrammingConfig>;
  position?: XYPosition;
  chartType?: "line" | "bar" | "area";
  vizVariant?: "revenue" | "conversion" | "users" | "errors" | "aov" | "custom";
}

export interface AiWorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface RightClickContext {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
}

export type ReleaseChannel = "stable" | "beta" | "internal";

export type AppUpdateState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready_to_install"
  | "installing"
  | "error"
  | "disabled";

export interface AppUpdateSnapshot {
  enabled: boolean;
  repository: string | null;
  currentVersion: string;
  releaseChannel: ReleaseChannel;
  autoUpdateEnabled: boolean;
  updateState: AppUpdateState;
  lastCheckedAt: number | null;
  pendingVersion: string | null;
  availableVersion: string | null;
  lastUpdateError: string | null;
  downloadedBytes: number | null;
  totalBytes: number | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  checkIntervalMs: number;
  feedUrls: Partial<Record<ReleaseChannel, string>>;
}

export interface AppUpdateEvent {
  state: Exclude<AppUpdateState, "disabled">;
  channel: ReleaseChannel;
  currentVersion: string;
  version?: string | null;
  body?: string | null;
  date?: string | null;
  downloadedBytes?: number | null;
  totalBytes?: number | null;
  error?: string | null;
}

export interface DesktopUpdaterConfig {
  enabled: boolean;
  repository: string | null;
  currentVersion: string;
  defaultChannel: ReleaseChannel;
  channels: ReleaseChannel[];
  checkIntervalMs: number;
  feedUrls: Partial<Record<ReleaseChannel, string>>;
}

export interface DesktopUpdaterCheckResult {
  enabled: boolean;
  currentVersion: string;
  channel: ReleaseChannel;
  feedUrl: string | null;
  available: boolean;
  version: string | null;
  body: string | null;
  date: string | null;
}
