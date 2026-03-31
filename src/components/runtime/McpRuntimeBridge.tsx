"use client";

import { useEffect, useEffectEvent } from "react";
import { v4 as uuidv4 } from "uuid";
import type { XYPosition } from "@xyflow/react";
import {
  getDefaultNodeConfig,
  getNodeConfigFields,
  getNodeSchema,
} from "@/lib/node-config";
import { getNodeMeta, nodeCategories, type NodeTypeId } from "@/lib/node-catalog";
import type {
  AppNode,
  Project,
  ToolMode,
  Workflow,
  WorkflowNodeData,
} from "@/lib/flow-types";
import type {
  McpBridgeRequest,
  McpBridgeResponse,
  McpCreateEdgeOperation,
  McpCreateNodeOperation,
  McpCreateShapeOperation,
  McpDeleteEdgeOperation,
  McpDeleteNodeOperation,
  McpDuplicateNodeOperation,
  McpDuplicateProjectOperation,
  McpDuplicateWorkflowOperation,
  McpMoveNodeOperation,
  McpNodeReference,
  McpProjectDraft,
  McpProjectPatch,
  McpResizeNodeOperation,
  McpUpdateNodeOperation,
  McpWorkspaceChangeOperation,
  McpWorkspaceChangeSet,
  McpWorkflowChangeOperation,
  McpWorkflowChangeSet,
  McpWorkflowDraft,
  McpWorkflowPatch,
} from "@/lib/mcp";
import {
  completeDesktopMcpRequest,
  listenDesktopMcpRequests,
} from "@/lib/tauri-mcp";
import { applyWorkflowIntelligence } from "@/lib/workflow-intelligence";
import { useAuthStore } from "@/store/useAuthStore";
import { findFreePosition, useFlowStore } from "@/store/useFlowStore";
import { useMcpStore } from "@/store/useMcpStore";

const MCP_DRAWING_TOOLS: ToolMode[] = [
  "select",
  "hand",
  "rect",
  "ellipse",
  "diamond",
  "arrow",
  "text",
  "eraser",
];

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function coerceSurface(value: unknown): Project["surface"] | Workflow["surface"] | undefined {
  if (value === "app" || value === "landing") return value;
  return undefined;
}

function coercePosition(value: unknown): XYPosition | undefined {
  const record = coerceRecord(value);
  if (!record) return undefined;
  const x = typeof record.x === "number" ? record.x : null;
  const y = typeof record.y === "number" ? record.y : null;
  if (x === null || y === null) return undefined;
  return { x, y };
}

function stringifyParameterValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => stringifyParameterValue(entry))
      .filter(Boolean)
      .join(",");
  }

  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function sanitizeNodeDataPatch(value: unknown) {
  const record = coerceRecord(value);
  if (!record) return {};

  const next: Partial<WorkflowNodeData> = { ...record };
  delete next.id;
  delete next.nodeType;
  delete next.icon;
  delete next.badge;
  delete next.accent;
  delete next.subtle;
  delete next.schema;
  delete next.runtime;

  if (record.parameters && typeof record.parameters === "object" && !Array.isArray(record.parameters)) {
    next.parameters = Object.fromEntries(
      Object.entries(record.parameters).map(([key, entry]) => [
        key,
        stringifyParameterValue(entry),
      ]),
    );
  }

  if (record.config && typeof record.config === "object" && !Array.isArray(record.config)) {
    next.config = record.config as Record<string, unknown>;
  }

  if (
    record.programmable &&
    typeof record.programmable === "object" &&
    !Array.isArray(record.programmable)
  ) {
    next.programmable = {
      ...(record.programmable as Record<string, unknown>),
    } as unknown as WorkflowNodeData["programmable"];
  }

  return next;
}

function mergeNodeData(
  current: WorkflowNodeData,
  patch: Partial<WorkflowNodeData>,
): Partial<WorkflowNodeData> {
  return {
    ...patch,
    ...(patch.parameters
      ? {
          parameters: {
            ...(current.parameters ?? {}),
            ...patch.parameters,
          },
        }
      : {}),
    ...(patch.config
      ? {
          config: {
            ...(current.config ?? {}),
            ...patch.config,
          },
        }
      : {}),
    ...(patch.programmable
      ? {
          programmable: {
            ...(current.programmable ?? {}),
            ...patch.programmable,
          },
        }
      : {}),
  };
}

function buildWorkspaceSnapshot() {
  const flowState = useFlowStore.getState();
  const authState = useAuthStore.getState();
  const mcpState = useMcpStore.getState();

  return {
    activeProjectId: flowState.activeProjectId,
    activeWorkflowId: flowState.activeWorkflowId,
    selectedNodeId: flowState.selectedNodeId,
    contextNodeIds: flowState.contextNodeIds,
    activeTool: flowState.activeTool,
    drawingTools: MCP_DRAWING_TOOLS,
    projects: flowState.projects.map((project) => ({
      id: project.id,
      name: project.name,
      active: project.active,
      accent: project.accent,
      surface: project.surface ?? "app",
      description: project.description,
    })),
    workflows: flowState.workflows.map((workflow) => ({
      id: workflow.id,
      projectId: workflow.projectId,
      name: workflow.name,
      surface: workflow.surface ?? "app",
      active: workflow.active,
      tags: workflow.tags,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      description: workflow.description,
      updatedAt: workflow.updatedAt,
    })),
    license: authState.license,
    mcp: {
      enabled: mcpState.config.enabled,
      status: mcpState.desktopStatus,
    },
  };
}

function buildNodeCatalogSnapshot() {
  return {
    drawingTools: MCP_DRAWING_TOOLS,
    categories: nodeCategories.map((category) => ({
      id: category.id,
      label: category.label,
      items: category.items.map((item) => ({
        ...item,
        schema: getNodeSchema(item.type),
        configFields: getNodeConfigFields(item.type),
        defaultConfig: getDefaultNodeConfig(item.type, {
          label: item.label,
          chartType: item.chartType,
          vizVariant: item.vizVariant,
        }),
      })),
    })),
  };
}

function buildCanvasToolsSnapshot() {
  return {
    activeTool: useFlowStore.getState().activeTool,
    tools: [
      { id: "select", title: "Select", description: "Seleciona e conecta nodes no canvas." },
      { id: "hand", title: "Hand", description: "Pan livre pelo canvas." },
      { id: "rect", title: "Rectangle", description: "Desenha um retangulo como shape node." },
      { id: "ellipse", title: "Ellipse", description: "Desenha uma elipse como shape node." },
      { id: "diamond", title: "Diamond", description: "Desenha um losango como shape node." },
      { id: "arrow", title: "Arrow", description: "Desenha uma seta como shape node." },
      { id: "text", title: "Text", description: "Cria um texto editavel no canvas." },
      { id: "eraser", title: "Eraser", description: "Apaga nodes selecionados ou clicados." },
    ],
  };
}

function buildTextResource(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function resolveWorkflowResource(uri: string) {
  const flowState = useFlowStore.getState();
  const prefix = "flowmerge://workflow/";

  if (uri === "flowmerge://workflow/active") {
    const activeWorkflow =
      flowState.workflows.find(
        (workflow) => workflow.id === flowState.activeWorkflowId,
      ) ?? null;
    return buildTextResource(uri, activeWorkflow);
  }

  if (uri.startsWith(prefix)) {
    const workflowId = decodeURIComponent(uri.slice(prefix.length));
    const workflow =
      flowState.workflows.find((item) => item.id === workflowId) ?? null;
    return buildTextResource(uri, workflow);
  }

  return null;
}

async function handleReadResource(uri: string) {
  if (uri === "flowmerge://workspace/snapshot") {
    return buildTextResource(uri, buildWorkspaceSnapshot());
  }

  if (uri === "flowmerge://license/status") {
    return buildTextResource(uri, useAuthStore.getState().license);
  }

  if (uri === "flowmerge://catalog/nodes") {
    return buildTextResource(uri, buildNodeCatalogSnapshot());
  }

  if (uri === "flowmerge://canvas/tools") {
    return buildTextResource(uri, buildCanvasToolsSnapshot());
  }

  return resolveWorkflowResource(uri);
}

function requireWorkspaceAccess() {
  const license = useAuthStore.getState().license;
  if (!license.authenticated || !license.canAccessWorkspace) {
    throw new Error("Conta sem acesso ao workspace local.");
  }
}

function getWorkflowById(workflowId?: string) {
  const flowState = useFlowStore.getState();
  if (workflowId) {
    return flowState.workflows.find((item) => item.id === workflowId) ?? null;
  }

  return (
    flowState.workflows.find((item) => item.id === flowState.activeWorkflowId) ??
    flowState.workflows[0] ??
    null
  );
}

function getWorkflowByIdOrThrow(workflowId?: string) {
  const workflow = getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error("Workflow nao encontrado.");
  }
  return workflow;
}

function activateWorkflow(workflow: Workflow) {
  const flowState = useFlowStore.getState();
  flowState.setActiveProject(workflow.projectId);
  flowState.setActiveWorkflow(workflow.id);
}

function restoreWorkflowSelection(projectId: string, workflowId: string) {
  const flowState = useFlowStore.getState();
  const projectExists = flowState.projects.some((project) => project.id === projectId);
  const workflowExists = flowState.workflows.some((workflow) => workflow.id === workflowId);

  if (projectExists) {
    flowState.setActiveProject(projectId);
  }
  if (workflowExists) {
    flowState.setActiveWorkflow(workflowId);
  }
}

function buildNodeLookup(workflow: Workflow, aliases: Map<string, string>) {
  const lookup = new Map<string, string>();

  for (const node of workflow.nodes) {
    lookup.set(node.id, node.id);
    lookup.set(normalizeLookup(node.id), node.id);
    lookup.set(normalizeLookup(String(node.data.label)), node.id);
  }

  for (const [alias, nodeId] of aliases.entries()) {
    lookup.set(normalizeLookup(alias), nodeId);
  }

  return lookup;
}

function coerceNodeReference(value: unknown): McpNodeReference | null {
  if (typeof value === "string" && value.trim()) {
    return { nodeId: value.trim() };
  }

  const record = coerceRecord(value);
  if (!record) return null;

  const nodeId = coerceString(record.nodeId);
  const alias = coerceString(record.alias);
  const label = coerceString(record.label);
  if (!nodeId && !alias && !label) return null;

  return {
    ...(nodeId ? { nodeId } : {}),
    ...(alias ? { alias } : {}),
    ...(label ? { label } : {}),
  };
}

function resolveNodeReference(
  workflow: Workflow,
  aliases: Map<string, string>,
  reference: McpNodeReference | null,
) {
  if (!reference) return null;

  const lookup = buildNodeLookup(workflow, aliases);
  const candidates = [reference.nodeId, reference.alias, reference.label]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  for (const candidate of candidates) {
    const direct = lookup.get(candidate) ?? lookup.get(normalizeLookup(candidate));
    if (direct) return direct;
  }

  return null;
}

function sanitizeWorkflowPatch(value: unknown): McpWorkflowPatch | undefined {
  const record = coerceRecord(value);
  if (!record) return undefined;

  const name = coerceString(record.name);
  const description = coerceString(record.description);
  const accent = coerceString(record.accent);
  const surface = coerceSurface(record.surface);
  const tags = coerceStringArray(record.tags);
  const active =
    typeof record.active === "boolean" ? record.active : undefined;

  const patch: McpWorkflowPatch = {};
  if (name) patch.name = name;
  if (description) patch.description = description;
  if (accent) patch.accent = accent;
  if (surface) patch.surface = surface;
  if (tags.length) patch.tags = tags;
  if (active !== undefined) patch.active = active;
  return Object.keys(patch).length ? patch : undefined;
}

function sanitizeProjectPatch(value: unknown): McpProjectPatch | undefined {
  const record = coerceRecord(value);
  if (!record) return undefined;

  const name = coerceString(record.name);
  const description = coerceString(record.description);
  const accent = coerceString(record.accent);
  const surface = coerceSurface(record.surface);
  const active =
    typeof record.active === "boolean" ? record.active : undefined;

  const patch: McpProjectPatch = {};
  if (name) patch.name = name;
  if (description) patch.description = description;
  if (accent) patch.accent = accent;
  if (surface) patch.surface = surface;
  if (active !== undefined) patch.active = active;
  return Object.keys(patch).length ? patch : undefined;
}

function sanitizeProjectDraft(value: unknown): McpProjectDraft {
  const record = coerceRecord(value) ?? {};
  const name = coerceString(record.name);
  if (!name) {
    throw new Error("name obrigatorio para criar projeto.");
  }

  return {
    name,
    description: coerceString(record.description) || undefined,
    accent: coerceString(record.accent) || undefined,
    surface: coerceSurface(record.surface),
    activate: record.activate !== false,
  };
}

function sanitizeWorkflowDraft(value: unknown): McpWorkflowDraft {
  const record = coerceRecord(value) ?? {};
  const name = coerceString(record.name);
  if (!name) {
    throw new Error("name obrigatorio para criar workflow.");
  }

  return {
    name,
    projectId: coerceString(record.projectId) || undefined,
    description: coerceString(record.description) || undefined,
    accent: coerceString(record.accent) || undefined,
    surface: coerceSurface(record.surface),
    tags: coerceStringArray(record.tags),
    activate: record.activate !== false,
  };
}

function sanitizeChangeSet(value: unknown): McpWorkflowChangeSet {
  const record = coerceRecord(value) ?? {};
  const operations = Array.isArray(record.operations)
    ? (record.operations as McpWorkflowChangeOperation[])
    : [];

  if (!operations.length) {
    throw new Error("operations obrigatorias no workflow change set.");
  }

  return {
    workflowId: coerceString(record.workflowId) || undefined,
    activate: record.activate !== false,
    workflowPatch: sanitizeWorkflowPatch(record.workflowPatch),
    operations,
  };
}

function sanitizeWorkspaceChangeSet(value: unknown): McpWorkspaceChangeSet {
  const record = coerceRecord(value) ?? {};
  const operations = Array.isArray(record.operations)
    ? (record.operations as McpWorkspaceChangeOperation[])
    : [];

  if (!operations.length) {
    throw new Error("operations obrigatorias no workspace change set.");
  }

  return { operations };
}

function getLatestWorkflow(workflowId: string) {
  return useFlowStore.getState().workflows.find((item) => item.id === workflowId) ?? null;
}

function getLatestProject(projectId: string) {
  return useFlowStore.getState().projects.find((item) => item.id === projectId) ?? null;
}

function getProjectByIdOrThrow(projectId: string) {
  const project = getLatestProject(projectId);
  if (!project) {
    throw new Error("Projeto nao encontrado.");
  }
  return project;
}

function mutateWorkflowInStore(
  workflowId: string,
  updater: (workflow: Workflow) => Workflow,
) {
  useFlowStore.setState((state) => ({
    workflows: state.workflows.map((workflow) =>
      workflow.id === workflowId
        ? applyWorkflowIntelligence(updater(workflow))
        : workflow,
    ),
  }));
}

function applyProjectPatch(projectId: string, patch: McpProjectPatch | undefined) {
  if (!patch) return;
  useFlowStore.getState().updateProject(projectId, patch);
}

function setProjectActiveState(projectId: string, active: boolean) {
  const project = getProjectByIdOrThrow(projectId);
  if (project.active !== active) {
    useFlowStore.getState().toggleProjectActive(projectId);
  }
}

function setWorkflowActiveState(workflowId: string, active: boolean) {
  const workflow = getWorkflowByIdOrThrow(workflowId);
  if (workflow.active !== active) {
    useFlowStore.getState().toggleWorkflowActive(workflowId);
  }
}

function createProjectFromDraft(draft: McpProjectDraft) {
  requireWorkspaceAccess();

  const flowState = useFlowStore.getState();
  const previousProjectId = flowState.activeProjectId;
  const previousWorkflowId = flowState.activeWorkflowId;

  const project = flowState.createProject(draft.name);
  const patch: Partial<Project> = {};
  if (draft.description) patch.description = draft.description;
  if (draft.accent) patch.accent = draft.accent;
  if (draft.surface) patch.surface = draft.surface;
  if (Object.keys(patch).length) {
    flowState.updateProject(project.id, patch);
  }

  const createdProject = getLatestProject(project.id) ?? project;
  const defaultWorkflow =
    useFlowStore
      .getState()
      .workflows.find((workflow) => workflow.projectId === project.id) ?? null;

  if (draft.activate === false) {
    restoreWorkflowSelection(previousProjectId, previousWorkflowId);
  }

  return {
    project: createdProject,
    defaultWorkflow,
  };
}

function createWorkflowFromDraft(draft: McpWorkflowDraft) {
  requireWorkspaceAccess();

  const flowState = useFlowStore.getState();
  const previousProjectId = flowState.activeProjectId;
  const previousWorkflowId = flowState.activeWorkflowId;
  const targetProjectId = draft.projectId || flowState.activeProjectId;
  const targetProject = flowState.projects.find((project) => project.id === targetProjectId);

  if (!targetProject) {
    throw new Error("Projeto alvo nao encontrado.");
  }

  flowState.setActiveProject(targetProject.id);
  const workflow = flowState.createWorkflow(draft.name);
  const patch: McpWorkflowPatch = {};
  if (draft.description) patch.description = draft.description;
  if (draft.accent) patch.accent = draft.accent;
  if (draft.surface) patch.surface = draft.surface;
  if (draft.tags?.length) patch.tags = draft.tags;
  if (Object.keys(patch).length) {
    flowState.updateWorkflow(workflow.id, patch);
  }

  if (draft.activate) {
    flowState.setActiveWorkflow(workflow.id);
  } else {
    restoreWorkflowSelection(previousProjectId, previousWorkflowId);
  }

  return getLatestWorkflow(workflow.id) ?? workflow;
}

function updateWorkflowMeta(workflowId: string, patch: McpWorkflowPatch | undefined) {
  if (!patch) return;
  useFlowStore.getState().updateWorkflow(workflowId, patch);
  if (typeof patch.active === "boolean") {
    setWorkflowActiveState(workflowId, patch.active);
  }
}

function duplicateWorkflowInWorkspace(operation: McpDuplicateWorkflowOperation) {
  requireWorkspaceAccess();

  const flowState = useFlowStore.getState();
  const previousProjectId = flowState.activeProjectId;
  const previousWorkflowId = flowState.activeWorkflowId;
  const workflow = getWorkflowByIdOrThrow(operation.workflowId);
  const beforeIds = new Set(flowState.workflows.map((item) => item.id));

  flowState.duplicateWorkflow(workflow.id);

  const duplicated =
    useFlowStore
      .getState()
      .workflows.find((item) => !beforeIds.has(item.id)) ?? null;
  if (!duplicated) {
    throw new Error("Falha ao duplicar workflow.");
  }

  const patch: McpWorkflowPatch = {
    name: coerceString(operation.name) || workflow.name,
    description: workflow.description,
    accent: workflow.accent,
    surface: workflow.surface,
    tags: workflow.tags,
    active: workflow.active,
  };

  const targetProjectId = coerceString(operation.targetProjectId) || workflow.projectId;
  if (targetProjectId !== workflow.projectId) {
    const targetProject = getProjectByIdOrThrow(targetProjectId);
    patch.accent = patch.accent ?? targetProject.accent;
    useFlowStore.getState().updateWorkflow(duplicated.id, {
      projectId: targetProject.id,
    });
  }

  updateWorkflowMeta(duplicated.id, patch);

  if (operation.activate !== false) {
    const latest = getLatestWorkflow(duplicated.id);
    if (latest) {
      activateWorkflow(latest);
    }
  } else {
    restoreWorkflowSelection(previousProjectId, previousWorkflowId);
  }

  return getLatestWorkflow(duplicated.id);
}

function duplicateProjectInWorkspace(operation: McpDuplicateProjectOperation) {
  requireWorkspaceAccess();

  const sourceProject = getProjectByIdOrThrow(operation.projectId);
  const sourceWorkflows = useFlowStore
    .getState()
    .workflows.filter((workflow) => workflow.projectId === sourceProject.id);
  const created = createProjectFromDraft({
    name: coerceString(operation.name) || `${sourceProject.name} (copy)`,
    description: sourceProject.description,
    accent: sourceProject.accent,
    surface: sourceProject.surface,
    activate: operation.activate !== false,
  });

  const duplicatedProject = created.project;
  if (!duplicatedProject) {
    throw new Error("Falha ao duplicar projeto.");
  }

  if (created.defaultWorkflow) {
    useFlowStore.getState().deleteWorkflow(created.defaultWorkflow.id);
  }

  const duplicatedWorkflows: Workflow[] = [];
  for (const workflow of sourceWorkflows) {
    const copy = duplicateWorkflowInWorkspace({
      type: "duplicate_workflow",
      workflowId: workflow.id,
      targetProjectId: duplicatedProject.id,
      name: workflow.name,
      activate: false,
    });
    if (copy) {
      duplicatedWorkflows.push(copy);
    }
  }

  setProjectActiveState(duplicatedProject.id, sourceProject.active);

  if (operation.activate !== false) {
    useFlowStore.getState().setActiveProject(duplicatedProject.id);
    if (duplicatedWorkflows[0]) {
      useFlowStore.getState().setActiveWorkflow(duplicatedWorkflows[0].id);
    }
  }

  return {
    project: getLatestProject(duplicatedProject.id),
    workflows: duplicatedWorkflows
      .map((workflow) => getLatestWorkflow(workflow.id))
      .filter(Boolean),
  };
}

function resolveCurrentWorkflowNode(
  workflow: Workflow,
  aliases: Map<string, string>,
  reference: unknown,
) {
  const nodeId = resolveNodeReference(workflow, aliases, coerceNodeReference(reference));
  if (!nodeId) {
    throw new Error("Node de referencia nao encontrado.");
  }

  const node = workflow.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error("Node alvo nao encontrado no workflow.");
  }

  return node;
}

function applyCreateNode(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpCreateNodeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const nodeType = coerceString(operation.nodeType) as NodeTypeId;
  if (!getNodeMeta(nodeType)) {
    throw new Error(`nodeType invalido: ${operation.nodeType}`);
  }

  const position =
    coercePosition(operation.position) ??
    findFreePosition(latestWorkflow.nodes, 240, 180);
  const node = useFlowStore.getState().addCatalogNode(
    nodeType,
    position,
    sanitizeNodeDataPatch(operation.data),
    true,
  );

  if (operation.alias) {
    aliases.set(operation.alias, node.id);
  }

  return node;
}

function applyCreateShape(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpCreateShapeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const shapeType = operation.shapeType;
  if (!["rect", "ellipse", "diamond", "arrow", "text"].includes(shapeType)) {
    throw new Error(`shapeType invalido: ${shapeType}`);
  }

  const position =
    coercePosition(operation.position) ??
    findFreePosition(latestWorkflow.nodes, 240, 180, 220, 140);
  const width = typeof operation.width === "number" ? Math.max(operation.width, 40) : 220;
  const height = typeof operation.height === "number" ? Math.max(operation.height, 30) : 140;
  const node: AppNode = {
    id: uuidv4(),
    type: "shapeNode",
    position,
    zIndex: -1,
    data: {
      label: coerceString(operation.label) || shapeType,
      nodeType: "viz_report",
      shapeType,
      width,
      height,
      ...(coerceString(operation.text) ? { text: coerceString(operation.text) } : {}),
      ...(coerceString(operation.fill) ? { fill: coerceString(operation.fill) } : {}),
      ...(coerceString(operation.strokeColor)
        ? { strokeColor: coerceString(operation.strokeColor) }
        : {}),
    },
  };

  useFlowStore.getState().addNode(node);
  if (operation.alias) {
    aliases.set(operation.alias, node.id);
  }

  return node;
}

function applyUpdateNode(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpUpdateNodeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const node = resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.node);
  const patch = sanitizeNodeDataPatch(operation.data);
  if (!Object.keys(patch).length) {
    throw new Error("update_node exige um patch de data.");
  }

  useFlowStore.getState().updateNodeData(node.id, mergeNodeData(node.data, patch));
  return node.id;
}

function applyDeleteNode(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpDeleteNodeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const node = resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.node);
  useFlowStore.getState().deleteNode(node.id);

  for (const [alias, nodeId] of [...aliases.entries()]) {
    if (nodeId === node.id) {
      aliases.delete(alias);
    }
  }

  return node.id;
}

function applyDuplicateNode(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpDuplicateNodeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const node = resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.node);
  const beforeIds = new Set(latestWorkflow.nodes.map((item) => item.id));
  useFlowStore.getState().duplicateNode(node.id);
  const duplicated =
    getLatestWorkflow(workflowId)?.nodes.find((item) => !beforeIds.has(item.id)) ?? null;

  if (!duplicated) {
    throw new Error("Falha ao duplicar node.");
  }

  if (operation.alias) {
    aliases.set(operation.alias, duplicated.id);
  }

  return duplicated;
}

function applyMoveNode(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpMoveNodeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const node = resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.node);
  const position = coercePosition(operation.position);
  if (!position) {
    throw new Error("position obrigatoria para move_node.");
  }

  mutateWorkflowInStore(workflowId, (workflow) => ({
    ...workflow,
    updatedAt: new Date().toISOString(),
    nodes: workflow.nodes.map((item) =>
      item.id === node.id ? { ...item, position } : item,
    ),
  }));

  return { nodeId: node.id, position };
}

function applyResizeNode(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpResizeNodeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const node = resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.node);
  const width = Math.max(operation.width, 40);
  const height = Math.max(operation.height, 30);

  mutateWorkflowInStore(workflowId, (workflow) => ({
    ...workflow,
    updatedAt: new Date().toISOString(),
    nodes: workflow.nodes.map((item) =>
      item.id === node.id
        ? {
            ...item,
            width,
            height,
            data: {
              ...item.data,
              width,
              height,
            },
          }
        : item,
    ),
  }));

  return { nodeId: node.id, width, height };
}

function applyCreateEdge(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpCreateEdgeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const source = resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.source);
  const target = resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.target);
  if (source.id === target.id) {
    throw new Error("Nao e permitido conectar um node nele mesmo.");
  }

  const edgeExists = latestWorkflow.edges.some(
    (edge) =>
      edge.source === source.id &&
      edge.target === target.id &&
      (edge.sourceHandle ?? null) === (operation.sourceHandle ?? null) &&
      (edge.targetHandle ?? null) === (operation.targetHandle ?? null),
  );

  if (!edgeExists) {
    useFlowStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: operation.sourceHandle ?? null,
      targetHandle: operation.targetHandle ?? null,
    });
  }

  return {
    sourceId: source.id,
    targetId: target.id,
    created: !edgeExists,
  };
}

function applyDeleteEdge(
  workflowId: string,
  aliases: Map<string, string>,
  operation: McpDeleteEdgeOperation,
) {
  const latestWorkflow = getLatestWorkflow(workflowId);
  if (!latestWorkflow) {
    throw new Error("Workflow alvo nao encontrado.");
  }

  const edgeId = coerceString(operation.edgeId);
  let edge =
    (edgeId
      ? latestWorkflow.edges.find((item) => item.id === edgeId)
      : null) ?? null;

  if (!edge) {
    const source = operation.source
      ? resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.source)
      : null;
    const target = operation.target
      ? resolveCurrentWorkflowNode(latestWorkflow, aliases, operation.target)
      : null;

    if (source && target) {
      edge =
        latestWorkflow.edges.find(
          (item) => item.source === source.id && item.target === target.id,
        ) ?? null;
    }
  }

  if (!edge) {
    throw new Error("Edge alvo nao encontrado.");
  }

  useFlowStore.getState().onEdgesChange([{ id: edge.id, type: "remove" }]);
  return edge.id;
}

function applyWorkspaceChangeSet(changeSet: McpWorkspaceChangeSet) {
  requireWorkspaceAccess();

  const result = {
    appliedOperations: 0,
    updatedProjectIds: [] as string[],
    deletedProjectIds: [] as string[],
    duplicatedProjectIds: [] as string[],
    updatedWorkflowIds: [] as string[],
    deletedWorkflowIds: [] as string[],
    duplicatedWorkflowIds: [] as string[],
    activeProjectId: useFlowStore.getState().activeProjectId,
    activeWorkflowId: useFlowStore.getState().activeWorkflowId,
    activeTool: useFlowStore.getState().activeTool,
  };

  for (const rawOperation of changeSet.operations) {
    const operation = rawOperation as McpWorkspaceChangeOperation;
    switch (operation.type) {
      case "update_project": {
        const patch = sanitizeProjectPatch(operation.patch);
        if (!patch) {
          throw new Error("update_project exige um patch.");
        }
        applyProjectPatch(operation.projectId, patch);
        if (typeof patch.active === "boolean") {
          setProjectActiveState(operation.projectId, patch.active);
        }
        result.updatedProjectIds.push(operation.projectId);
        result.appliedOperations += 1;
        break;
      }
      case "toggle_project_active": {
        useFlowStore.getState().toggleProjectActive(operation.projectId);
        result.updatedProjectIds.push(operation.projectId);
        result.appliedOperations += 1;
        break;
      }
      case "delete_project": {
        useFlowStore.getState().deleteProject(operation.projectId);
        result.deletedProjectIds.push(operation.projectId);
        result.appliedOperations += 1;
        break;
      }
      case "duplicate_project": {
        const duplicated = duplicateProjectInWorkspace(operation);
        if (duplicated.project?.id) {
          result.duplicatedProjectIds.push(duplicated.project.id);
        }
        result.appliedOperations += 1;
        break;
      }
      case "update_workflow": {
        const patch = sanitizeWorkflowPatch(operation.patch);
        if (!patch) {
          throw new Error("update_workflow exige um patch.");
        }
        updateWorkflowMeta(operation.workflowId, patch);
        result.updatedWorkflowIds.push(operation.workflowId);
        result.appliedOperations += 1;
        break;
      }
      case "toggle_workflow_active": {
        useFlowStore.getState().toggleWorkflowActive(operation.workflowId);
        result.updatedWorkflowIds.push(operation.workflowId);
        result.appliedOperations += 1;
        break;
      }
      case "delete_workflow": {
        useFlowStore.getState().deleteWorkflow(operation.workflowId);
        result.deletedWorkflowIds.push(operation.workflowId);
        result.appliedOperations += 1;
        break;
      }
      case "duplicate_workflow": {
        const duplicated = duplicateWorkflowInWorkspace(operation);
        if (duplicated?.id) {
          result.duplicatedWorkflowIds.push(duplicated.id);
        }
        result.appliedOperations += 1;
        break;
      }
      case "set_active_project": {
        const projectId = coerceString(operation.projectId);
        if (!projectId) {
          throw new Error("projectId obrigatorio.");
        }
        getProjectByIdOrThrow(projectId);
        useFlowStore.getState().setActiveProject(projectId);
        result.appliedOperations += 1;
        break;
      }
      case "set_active_tool": {
        const tool = operation.tool;
        if (!MCP_DRAWING_TOOLS.includes(tool)) {
          throw new Error(`Tool MCP nao suportada: ${tool}`);
        }
        useFlowStore.getState().setActiveTool(tool);
        result.appliedOperations += 1;
        break;
      }
      default:
        throw new Error("Operacao de workspace MCP nao suportada.");
    }
  }

  const latestState = useFlowStore.getState();
  return {
    ...result,
    activeProjectId: latestState.activeProjectId,
    activeWorkflowId: latestState.activeWorkflowId,
    activeTool: latestState.activeTool,
  };
}

function applyWorkflowChangeSet(changeSet: McpWorkflowChangeSet) {
  requireWorkspaceAccess();

  const flowState = useFlowStore.getState();
  const originalProjectId = flowState.activeProjectId;
  const originalWorkflowId = flowState.activeWorkflowId;
  const workflow = getWorkflowByIdOrThrow(changeSet.workflowId);
  activateWorkflow(workflow);
  updateWorkflowMeta(workflow.id, changeSet.workflowPatch);

  const aliases = new Map<string, string>();
  const result = {
    workflowId: workflow.id,
    workflowName: workflow.name,
    appliedOperations: 0,
    createdNodes: [] as Array<{
      nodeId: string;
      label: string;
      nodeType: NodeTypeId;
      alias: string | null;
    }>,
    updatedNodeIds: [] as string[],
    deletedNodeIds: [] as string[],
    createdEdgeCount: 0,
    deletedEdgeIds: [] as string[],
    activated: changeSet.activate !== false,
  };

  for (const rawOperation of changeSet.operations) {
    const operation = rawOperation as McpWorkflowChangeOperation;
    switch (operation.type) {
      case "create_node": {
        const node = applyCreateNode(workflow.id, aliases, operation);
        result.createdNodes.push({
          nodeId: node.id,
          label: String(node.data.label),
          nodeType: node.data.nodeType,
          alias: operation.alias ?? null,
        });
        result.appliedOperations += 1;
        break;
      }
      case "create_shape": {
        const node = applyCreateShape(workflow.id, aliases, operation);
        result.createdNodes.push({
          nodeId: node.id,
          label: String(node.data.label),
          nodeType: node.data.nodeType,
          alias: operation.alias ?? null,
        });
        result.appliedOperations += 1;
        break;
      }
      case "update_node": {
        const nodeId = applyUpdateNode(workflow.id, aliases, operation);
        result.updatedNodeIds.push(nodeId);
        result.appliedOperations += 1;
        break;
      }
      case "move_node": {
        applyMoveNode(workflow.id, aliases, operation);
        result.appliedOperations += 1;
        break;
      }
      case "resize_node": {
        applyResizeNode(workflow.id, aliases, operation);
        result.appliedOperations += 1;
        break;
      }
      case "duplicate_node": {
        const node = applyDuplicateNode(workflow.id, aliases, operation);
        result.createdNodes.push({
          nodeId: node.id,
          label: String(node.data.label),
          nodeType: node.data.nodeType,
          alias: operation.alias ?? null,
        });
        result.appliedOperations += 1;
        break;
      }
      case "delete_node": {
        const nodeId = applyDeleteNode(workflow.id, aliases, operation);
        result.deletedNodeIds.push(nodeId);
        result.appliedOperations += 1;
        break;
      }
      case "create_edge": {
        const payload = applyCreateEdge(workflow.id, aliases, operation);
        if (payload.created) {
          result.createdEdgeCount += 1;
        }
        result.appliedOperations += 1;
        break;
      }
      case "delete_edge": {
        const edgeId = applyDeleteEdge(workflow.id, aliases, operation);
        result.deletedEdgeIds.push(edgeId);
        result.appliedOperations += 1;
        break;
      }
      default:
        throw new Error("Operacao MCP nao suportada.");
    }
  }

  const latestWorkflow = getLatestWorkflow(workflow.id);
  if (!changeSet.activate) {
    restoreWorkflowSelection(originalProjectId, originalWorkflowId);
  }

  return {
    ...result,
    workflowName: latestWorkflow?.name ?? result.workflowName,
    workflow: latestWorkflow,
  };
}

export function McpRuntimeBridge() {
  const hydrate = useMcpStore((state) => state.hydrate);
  const hydrated = useMcpStore((state) => state.hydrated);
  const config = useMcpStore((state) => state.config);
  const refreshDesktopStatus = useMcpStore((state) => state.refreshDesktopStatus);
  const syncDesktopConfig = useMcpStore((state) => state.syncDesktopConfig);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshDesktopStatus();
    void syncDesktopConfig();
  }, [hydrated, refreshDesktopStatus, syncDesktopConfig]);

  useEffect(() => {
    if (!hydrated) return;
    void syncDesktopConfig();
  }, [
    config.authToken,
    config.enabled,
    config.serverName,
    hydrated,
    syncDesktopConfig,
  ]);

  useEffect(() => {
    if (!hydrated) return;

    const intervalId = window.setInterval(() => {
      void refreshDesktopStatus();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hydrated, refreshDesktopStatus]);

  const onMcpRequest = useEffectEvent(async (request: McpBridgeRequest) => {
    const complete = async (response: McpBridgeResponse) => {
      await completeDesktopMcpRequest(response);
    };

    try {
      switch (request.kind) {
        case "get_workspace_snapshot": {
          await complete({
            requestId: request.requestId,
            ok: true,
            payload: buildWorkspaceSnapshot(),
          });
          return;
        }

        case "get_node_catalog": {
          await complete({
            requestId: request.requestId,
            ok: true,
            payload: buildNodeCatalogSnapshot(),
          });
          return;
        }

        case "get_workflow": {
          const workflowId = coerceString(request.payload?.workflowId);
          const workflow = getWorkflowById(workflowId) ?? null;

          await complete({
            requestId: request.requestId,
            ok: true,
            payload: workflow,
          });
          return;
        }

        case "create_project": {
          const result = createProjectFromDraft(sanitizeProjectDraft(request.payload));
          await complete({
            requestId: request.requestId,
            ok: true,
            payload: result,
          });
          return;
        }

        case "create_workflow": {
          const workflow = createWorkflowFromDraft(
            sanitizeWorkflowDraft(request.payload),
          );
          await complete({
            requestId: request.requestId,
            ok: true,
            payload: workflow,
          });
          return;
        }

        case "apply_workspace_change_set": {
          const result = applyWorkspaceChangeSet(
            sanitizeWorkspaceChangeSet(request.payload),
          );
          await complete({
            requestId: request.requestId,
            ok: true,
            payload: result,
          });
          return;
        }

        case "set_active_workflow": {
          requireWorkspaceAccess();
          const workflowId = coerceString(request.payload?.workflowId);
          if (!workflowId) {
            throw new Error("workflowId obrigatorio.");
          }

          const workflow = getWorkflowByIdOrThrow(workflowId);
          activateWorkflow(workflow);

          await complete({
            requestId: request.requestId,
            ok: true,
            payload: {
              workflowId: workflow.id,
              projectId: workflow.projectId,
              name: workflow.name,
            },
          });
          return;
        }

        case "apply_workflow_change_set": {
          const result = applyWorkflowChangeSet(
            sanitizeChangeSet(request.payload),
          );
          await complete({
            requestId: request.requestId,
            ok: true,
            payload: result,
          });
          return;
        }

        case "read_resource": {
          const uri = coerceString(request.payload?.uri);
          if (!uri) {
            throw new Error("uri obrigatoria.");
          }

          const resource = await handleReadResource(uri);
          if (!resource) {
            throw new Error("Recurso MCP nao encontrado.");
          }

          await complete({
            requestId: request.requestId,
            ok: true,
            payload: resource,
          });
          return;
        }

        default:
          throw new Error("Tipo de request MCP nao suportado.");
      }
    } catch (error) {
      await complete({
        requestId: request.requestId,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao processar request MCP.",
      });
    }
  });

  useEffect(() => {
    let dispose = () => {};

    const setup = async () => {
      dispose = await listenDesktopMcpRequests(async (request) => {
        await onMcpRequest(request);
      });
    };

    void setup();

    return () => {
      dispose();
    };
  }, [onMcpRequest]);

  return null;
}
