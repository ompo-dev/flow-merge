import type { NodeTypeId } from "@/lib/node-catalog";
import type { AppNode, Project, Workflow, WorkflowNodeData } from "@/lib/flow-types";

export type WorkflowTriggerSource = "manual" | "schedule" | "webhook";

export interface RuntimeItem {
  json: Record<string, unknown>;
}

export interface RuntimeEnvelope {
  items: RuntimeItem[];
  meta: Record<string, unknown>;
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
