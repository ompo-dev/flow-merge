import type { NodeTypeId } from "@/lib/node-catalog";
import type { AppNode, Project, Workflow, WorkflowNodeData } from "@/lib/flow-types";

export type WorkflowTriggerSource = "manual" | "schedule" | "webhook";

export interface RuntimeItem {
  json: Record<string, unknown>;
}

export type RuntimeArtifactKind =
  | "records"
  | "table"
  | "metric"
  | "series"
  | "comparison"
  | "funnel"
  | "report"
  | "ai_summary"
  | "alert";

export interface RuntimeReportItem {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}

interface RuntimeArtifactBase {
  kind: RuntimeArtifactKind;
  label?: string;
}

export interface RuntimeRecordsArtifact extends RuntimeArtifactBase {
  kind: "records";
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface RuntimeTableArtifact extends RuntimeArtifactBase {
  kind: "table";
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface RuntimeMetricArtifact extends RuntimeArtifactBase {
  kind: "metric";
  value: string;
  rawValue?: number | string;
  trend?: string;
  compareLabel?: string;
}

export interface RuntimeSeriesArtifact extends RuntimeArtifactBase {
  kind: "series";
  chartType: "line" | "bar" | "area";
  series: Array<{
    label: string;
    value: number;
  }>;
}

export interface RuntimeComparisonArtifact extends RuntimeArtifactBase {
  kind: "comparison";
  metric: string;
  total: number;
  delta: number;
  sourceCount: number;
  leader?: string;
  leaderValue?: number;
  sources: Array<{
    key: string;
    label: string;
    storeName?: string;
    value: number;
    count: number;
    share: number;
  }>;
}

export interface RuntimeFunnelArtifact extends RuntimeArtifactBase {
  kind: "funnel";
  stages: Array<{
    label: string;
    value: number;
  }>;
}

export interface RuntimeReportArtifact extends RuntimeArtifactBase {
  kind: "report";
  insight?: string;
  reportItems: RuntimeReportItem[];
}

export interface RuntimeAiSummaryArtifact extends RuntimeArtifactBase {
  kind: "ai_summary";
  summary: string;
  model: string;
  status: number;
  sourceRows?: Record<string, unknown>[];
  columns?: string[];
  reportItems?: RuntimeReportItem[];
}

export interface RuntimeAlertArtifact extends RuntimeArtifactBase {
  kind: "alert";
  triggered: boolean;
  threshold: number;
  matches: number;
  channel: string;
}

export type RuntimeArtifact =
  | RuntimeRecordsArtifact
  | RuntimeTableArtifact
  | RuntimeMetricArtifact
  | RuntimeSeriesArtifact
  | RuntimeComparisonArtifact
  | RuntimeFunnelArtifact
  | RuntimeReportArtifact
  | RuntimeAiSummaryArtifact
  | RuntimeAlertArtifact;

export interface RuntimeEnvelope {
  items: RuntimeItem[];
  meta: Record<string, unknown>;
  artifacts: RuntimeArtifact[];
}

export interface RuntimeCollectionRecord {
  id: string;
  timestamp: number;
  sourceNodeId: string;
  payload: Record<string, unknown>;
}

export interface ProjectRuntimeStore {
  collections: Record<string, RuntimeCollectionRecord[]>;
  lastUpdatedAt: number | null;
}

export interface WorkflowExecutionRequest {
  triggerNodeId?: string;
  source: WorkflowTriggerSource;
  payload?: Record<string, unknown>;
  webhookDeliveryId?: string | null;
}

export interface RuntimeWebhookRoute {
  path: string;
  workflowId: string;
  nodeId: string;
  method: string;
  secretToken?: string;
}

export interface RuntimeWebhookDelivery {
  deliveryId: string;
  workflowId: string;
  nodeId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson?: Record<string, unknown> | null;
  query?: Record<string, string> | null;
}

export interface RuntimeWebhookResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export interface RuntimeNodeSnapshot {
  nodeId: string;
  nodeType: NodeTypeId;
  status: "idle" | "running" | "success" | "error" | "skipped";
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  itemCount?: number;
  summary?: string;
  error?: string;
  inputPreview?: unknown;
  outputPreview?: unknown;
}

export interface RuntimeNodePatch {
  nodeId: string;
  data: Partial<WorkflowNodeData>;
}

export interface WorkflowRunResult {
  executionStatus: "success" | "error";
  itemsProcessed: number;
  response?: RuntimeWebhookResponse;
  nodeSnapshots: Record<string, RuntimeNodeSnapshot>;
  nodePatches: RuntimeNodePatch[];
  updatedStore: ProjectRuntimeStore;
  logs: string[];
}

export interface RuntimeEvaluationContext {
  project: Project;
  workflow: Workflow;
  nodesById: Record<string, AppNode>;
  incomingCounts: Record<string, number>;
  store: ProjectRuntimeStore;
  request: WorkflowExecutionRequest;
  logs: string[];
}
