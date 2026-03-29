import type { Edge, Node } from "@xyflow/react";
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
  nodeType: NodeTypeId;
  label?: string;
  description?: string;
  notes?: string;
  parameters?: Record<string, string>;
  chartType?: "line" | "bar" | "area";
  vizVariant?: "revenue" | "conversion" | "users" | "errors" | "aov" | "custom";
}

export interface RightClickContext {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
}
