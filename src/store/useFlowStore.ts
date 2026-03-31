"use client";

import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import {
  checkDesktopUpdater,
  downloadDesktopUpdater,
  installDesktopUpdater,
  isDesktopUpdaterAvailable,
  relaunchDesktopApp,
} from "@/lib/desktop-updater";
import { createMockExecutions, createMockProjects, createMockWorkflows } from "@/lib/mock-data";
import { getNodeMeta, type NodeTypeId } from "@/lib/node-catalog";
import { getDefaultNodeConfig, getNodeSchema } from "@/lib/node-config";
import { getDefaultProgrammableConfig } from "@/lib/node-programming";
import { executeWorkflowRun } from "@/lib/runtime-engine";
import { applyWorkflowIntelligence } from "@/lib/workflow-intelligence";
import {
  deleteProjectStore,
  getEmptyProjectStore,
  getProjectRuntimeStore,
  persistRuntimeStores,
  readPersistedRuntimeStores,
} from "@/lib/runtime-storage";
import { clearFlowMergeStorage } from "@/lib/local-workspace";
import { migrateFromLocalStorageIfNeeded } from "@/lib/storage/migrate-from-localstorage";
import {
  deleteProject as dbDeleteProject,
  saveAllProjects,
} from "@/lib/storage/projects-store";
import {
  clearAllThreads,
  getAllThreads,
  deleteThread as dbDeleteThread,
  saveAllThreads,
  saveThread,
} from "@/lib/storage/chat-store";
import { getSetting, setSetting } from "@/lib/storage/settings-store";
import { getAllProjects } from "@/lib/storage/projects-store";
import {
  deleteWorkflow as dbDeleteWorkflow,
  deleteWorkflowsByProject,
  getAllWorkflows,
  saveAllWorkflows,
} from "@/lib/storage/workflows-store";
import type {
  AppUpdateEvent,
  AppUpdateSnapshot,
  AiNodeSpec,
  AppNode,
  ChatMessage,
  ChatThread,
  DesktopUpdaterCheckResult,
  DesktopUpdaterConfig,
  Execution,
  Project,
  GenerativeComponent,
  NodeRuntimeInfo,
  ReleaseChannel,
  RightClickContext,
  ToolMode,
  Workflow,
  WorkflowNodeData,
} from "@/lib/flow-types";
import {
  clampReleaseChannel,
  normalizeReleaseChannels,
  RELEASE_CHANNELS,
} from "@/lib/release-access";
import type {
  ProjectRuntimeStore,
  RuntimeNodeSnapshot,
  RuntimeWebhookDelivery,
  RuntimeWebhookResponse,
  WorkflowExecutionRequest,
  WorkflowRunResult,
} from "@/lib/runtime-types";
const CHAT_WELCOME_MESSAGE =
  "Eu posso montar workflows, criar dashboards e editar nos do canvas. Use Ctrl+click para mandar nos como contexto para a IA.";
const DEFAULT_UPDATER_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function toNodeRuntimeInfo(snapshot: RuntimeNodeSnapshot): NodeRuntimeInfo {
  return {
    status: snapshot.status,
    summary: snapshot.summary,
    error: snapshot.error,
    lastRunAt: snapshot.completedAt,
    itemCount: snapshot.itemCount,
    inputPreview: snapshot.inputPreview,
    outputPreview: snapshot.outputPreview,
  };
}

interface FlowState {
  isHydrated: boolean;
  projects: Project[];
  workflows: Workflow[];
  executions: Execution[];
  runtimeStores: Record<string, ProjectRuntimeStore>;
  nodeRuntimeByWorkflow: Record<string, Record<string, RuntimeNodeSnapshot>>;
  runtimeBaseUrl: string | null;
  activeProjectId: string;
  activeWorkflowId: string;
  selectedNodeId: string | null;
  contextNodeIds: string[];
  isAddNodePanelOpen: boolean;
  rightClickCtx: RightClickContext | null;
  activeTool: ToolMode;
  showSettings: boolean;
  chatExpanded: boolean;
  chatThreads: ChatThread[];
  activeChatId: string;
  deepseekKey: string;
  updater: AppUpdateSnapshot;

  hydrateFromStorage: () => Promise<void>;
  setRuntimeBaseUrl: (url: string | null) => void;
  setActiveProject: (id: string) => void;
  createProject: (name?: string) => Project;
  deleteProject: (id: string) => void;
  toggleProjectActive: (id: string) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  setActiveWorkflow: (id: string) => void;
  renameWorkflow: (id: string, name: string) => void;
  updateWorkflow: (id: string, data: Partial<Workflow>) => void;
  createWorkflow: (name?: string) => Workflow;
  duplicateWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  toggleWorkflowActive: (id: string) => void;
  saveWorkflow: () => void;
  runWorkflow: (
    request?: Partial<WorkflowExecutionRequest>,
  ) => Promise<WorkflowRunResult | null>;
  runWorkflowFromWebhook: (
    delivery: RuntimeWebhookDelivery,
  ) => Promise<RuntimeWebhookResponse | null>;
  exportWorkflowJson: () => string | null;
  importWorkflowJson: (raw: string) => { success: boolean; error?: string };

  setSelectedNodeId: (id: string | null) => void;
  toggleContextNode: (id: string) => void;
  clearContextNodes: () => void;
  setAddNodePanel: (open: boolean) => void;
  setRightClickCtx: (ctx: RightClickContext | null) => void;
  setActiveTool: (tool: ToolMode) => void;
  setShowSettings: (show: boolean) => void;
  setChatExpanded: (expanded: boolean) => void;
  setActiveChat: (id: string) => void;
  createChat: () => string;
  deleteChat: (id: string) => void;
  setDeepseekKey: (key: string) => void;
  resetLocalWorkspace: () => Promise<void>;
  hydrateUpdaterConfig: (config: DesktopUpdaterConfig | null) => void;
  syncUpdaterAccess: (allowedChannels: ReleaseChannel[]) => void;
  handleUpdaterEvent: (event: AppUpdateEvent) => void;
  setReleaseChannel: (channel: ReleaseChannel) => void;
  setAutoUpdateEnabled: (enabled: boolean) => void;
  checkForUpdates: (options?: {
    autoDownload?: boolean;
  }) => Promise<DesktopUpdaterCheckResult | null>;
  downloadAvailableUpdate: () => Promise<DesktopUpdaterCheckResult | null>;
  installReadyUpdate: (options?: {
    relaunch?: boolean;
  }) => Promise<boolean>;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: AppNode) => void;
  addCatalogNode: (
    nodeType: NodeTypeId,
    position?: XYPosition,
    overrides?: Partial<WorkflowNodeData>,
    preservePosition?: boolean,
  ) => AppNode;
  addAiNodes: (nodes: AiNodeSpec[]) => AppNode[];
  duplicateNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNodeData>) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  updateNodeParameters: (id: string, field: string, value: string) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;

  addUserMessage: (content: string, threadId?: string) => string;
  appendStreamChunk: (threadId: string, chunk: string) => void;
  resolveAssistantMessage: (
    threadId: string,
    content: string,
    ui?: GenerativeComponent[],
  ) => void;
  failAssistantMessage: (threadId: string, error: string) => void;
}

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function createWelcomeMessage(timestamp = Date.now()): ChatMessage {
  return {
    id: uuidv4(),
    role: "assistant",
    content: CHAT_WELCOME_MESSAGE,
    timestamp,
  };
}

function createChatTitleFromContent(content: string, fallback: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return fallback;
  return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact;
}

function createChatThread(index: number, title = `Conversa ${index}`): ChatThread {
  const timestamp = Date.now();
  return {
    id: uuidv4(),
    title,
    messages: [createWelcomeMessage(timestamp)],
    isStreaming: false,
    streamingMessageId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createDefaultChatState() {
  const initialThread = createChatThread(1);
  return {
    chatThreads: [initialThread],
    activeChatId: initialThread.id,
  };
}

function sanitizeChatThread(thread: Partial<ChatThread>, index: number): ChatThread {
  const createdAt = typeof thread.createdAt === "number" ? thread.createdAt : Date.now();
  const safeMessages =
    Array.isArray(thread.messages) && thread.messages.length
      ? thread.messages.map(
          (message, messageIndex): ChatMessage => ({
            id:
              typeof message.id === "string" && message.id
                ? message.id
                : `${thread.id ?? "thread"}-${messageIndex}`,
            role: message.role === "user" ? "user" : "assistant",
            content: typeof message.content === "string" ? message.content : "",
            timestamp:
              typeof message.timestamp === "number" ? message.timestamp : createdAt + messageIndex,
            generativeUI: Array.isArray(message.generativeUI) ? message.generativeUI : undefined,
            streaming: false,
          }),
        )
      : [createWelcomeMessage(createdAt)];

  return {
    id: typeof thread.id === "string" && thread.id ? thread.id : uuidv4(),
    title:
      typeof thread.title === "string" && thread.title.trim()
        ? thread.title
        : `Conversa ${index + 1}`,
    messages: safeMessages,
    isStreaming: false,
    streamingMessageId: null,
    createdAt,
    updatedAt: typeof thread.updatedAt === "number" ? thread.updatedAt : createdAt,
  };
}

function getInitialChatState() {
  return createDefaultChatState();
}

function persistChatState(chatThreads: ChatThread[], activeChatId: string) {
  if (typeof window === "undefined") return;
  void saveAllThreads(chatThreads).catch(() => {});
  void setSetting("active-chat-id", activeChatId).catch(() => {});
}

function getInitialDeepseekKey() {
  return "";
}

function getVisibleUpdaterChannels(
  supportedChannels: readonly ReleaseChannel[],
  allowedChannels: readonly ReleaseChannel[],
) {
  const normalizedSupported = normalizeReleaseChannels(supportedChannels, RELEASE_CHANNELS);
  const normalizedAllowed = normalizeReleaseChannels(allowedChannels, ["stable"]);
  const visibleChannels = normalizedSupported.filter((channel) => normalizedAllowed.includes(channel));
  return visibleChannels.length ? visibleChannels : ["stable"];
}

function resetUpdaterTransientState(updater: AppUpdateSnapshot): AppUpdateSnapshot {
  return {
    ...updater,
    updateState: updater.enabled ? "idle" : "disabled",
    pendingVersion: null,
    availableVersion: null,
    downloadedBytes: null,
    totalBytes: null,
    releaseNotes: null,
    publishedAt: null,
    lastUpdateError: null,
  };
}

function createDefaultUpdaterState(): AppUpdateSnapshot {
  return {
    enabled: false,
    repository: null,
    currentVersion: "",
    releaseChannel: "stable",
    supportedChannels: [...RELEASE_CHANNELS],
    allowedChannels: ["stable"],
    autoUpdateEnabled: true,
    updateState: isDesktopUpdaterAvailable() ? "idle" : "disabled",
    lastCheckedAt: null,
    pendingVersion: null,
    availableVersion: null,
    lastUpdateError: null,
    downloadedBytes: null,
    totalBytes: null,
    releaseNotes: null,
    publishedAt: null,
    checkIntervalMs: DEFAULT_UPDATER_CHECK_INTERVAL_MS,
    feedUrls: {},
  };
}

function getInitialUpdaterState(): AppUpdateSnapshot {
  return createDefaultUpdaterState();
}

function persistUpdaterState(updater: AppUpdateSnapshot) {
  if (typeof window === "undefined") return;
  void setSetting("updater", updater).catch(() => {});
}

function getActiveWorkflowFromState(state: Pick<FlowState, "workflows" | "activeWorkflowId">) {
  return (
    state.workflows.find((workflow) => workflow.id === state.activeWorkflowId) ?? state.workflows[0]
  );
}

function getActiveProjectFromState(state: Pick<FlowState, "projects" | "activeProjectId">) {
  return state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
}

function getActiveChatThreadFromState(state: Pick<FlowState, "chatThreads" | "activeChatId">) {
  return state.chatThreads.find((thread) => thread.id === state.activeChatId) ?? state.chatThreads[0];
}

const PROJECT_ACCENTS = ["#1f6feb", "#3fb950", "#d29922", "#a371f7", "#f85149"];

function updateChatThreads(
  chatThreads: ChatThread[],
  threadId: string,
  updater: (thread: ChatThread) => ChatThread,
) {
  let changed = false;
  const nextThreads = chatThreads.map((thread) => {
    if (thread.id !== threadId) return thread;
    changed = true;
    return updater(thread);
  });

  return changed ? nextThreads : chatThreads;
}

function stringifyAiValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === "string" || typeof entry === "number")) {
      return value.join(",");
    }
    return JSON.stringify(value);
  }
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function describeStoreError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Workflow execution failed unexpectedly.";
    }
  }
  return "Workflow execution failed unexpectedly.";
}

function syncWorkflow(workflow: Workflow) {
  return applyWorkflowIntelligence(workflow);
}

function updateWorkflowById(
  workflows: Workflow[],
  workflowId: string,
  updater: (workflow: Workflow) => Workflow,
) {
  return workflows.map((workflow) =>
    workflow.id === workflowId ? syncWorkflow(updater(workflow)) : workflow,
  );
}

function normalizeAiParameters(
  nodeType: NodeTypeId,
  rawParameters?: Record<string, unknown>,
) {
  const parameters = rawParameters ?? {};
  const entries = Object.entries(parameters);
  const normalizedLookup = new Map(
    entries.map(([key, value]) => [key.trim().toLowerCase(), value]),
  );
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = normalizedLookup.get(key.trim().toLowerCase());
      if (value !== undefined) return stringifyAiValue(value);
    }
    return "";
  };

  switch (nodeType) {
    case "trigger_webhook": {
      return Object.fromEntries(
        [
          ["Path", read("path", "webhook path", "route")],
          ["HTTP Method", read("http method", "method")],
          ["Authentication", read("authentication", "auth")],
          ["Secret Token", read("secret token", "secret")],
          ["Tag Field", read("tag field", "tagfield")],
          ["Tag Value", read("tag value", "tagvalue", "variant tag")],
        ].filter(([, value]) => value !== ""),
      );
    }
    case "action_set": {
      const fieldName = read("field name", "field", "name");
      const fieldValue = read("field value", "value");
      if (fieldName || fieldValue) {
        return Object.fromEntries(
          [
            ["Field Name", fieldName],
            ["Field Value", fieldValue],
          ].filter(([, value]) => value !== ""),
        );
      }

      if (entries.length === 1) {
        const [firstKey, firstValue] = entries[0];
        return {
          "Field Name": firstKey.trim().replace(/\s+/g, "_").toLowerCase(),
          "Field Value": stringifyAiValue(firstValue),
        };
      }

      return {};
    }
    case "analytics_store": {
      return Object.fromEntries(
        [["Store Name", read("store name", "store", "collection")]].filter(
          ([, value]) => value !== "",
        ),
      );
    }
    case "analytics_ab": {
      return Object.fromEntries(
        [
          ["Store Names", read("store names", "stores", "store name")],
          ["Variant Field", read("variant field", "variantfield", "variant")],
          ["Conversion Field", read("conversion field", "conversionfield", "converted field")],
          ["Revenue Field", read("revenue field", "revenuefield", "amount field")],
          ["Minimum Sample", read("minimum sample", "minimumsample", "sample")],
          ["Significance", read("significance")],
        ].filter(([, value]) => value !== ""),
      );
    }
    case "analytics_compare": {
      return Object.fromEntries(
        [
          ["Input A Label", read("input a label", "inputa label", "label a", "source a")],
          ["Input B Label", read("input b label", "inputb label", "label b", "source b")],
          ["Metric", read("metric", "compare metric", "measurement")],
        ].filter(([, value]) => value !== ""),
      );
    }
    case "action_if": {
      return Object.fromEntries(
        [
          ["Value 1", read("value 1", "value1", "left", "field")],
          ["Operation", read("operation", "rule", "operator")],
          ["Value 2", read("value 2", "value2", "right", "expected")],
        ].filter(([, value]) => value !== ""),
      );
    }
    case "action_terminal": {
      return Object.fromEntries(
        [
          ["Shell", read("shell")],
          ["Working Directory", read("working directory", "cwd", "directory")],
          ["Session Key", read("session key", "session", "sessionkey")],
          ["Command", read("command", "prompt", "instruction")],
          ["Timeout Seconds", read("timeout seconds", "timeout", "timeoutseconds")],
          ["Success Pattern Mode", read("success pattern mode", "pattern mode", "patternmode")],
          ["Success Pattern", read("success pattern", "done pattern", "pattern")],
          ["Reuse Session", read("reuse session", "reuse", "keepsession")],
          ["Close Session After Run", read("close session after run", "close session", "autoclose")],
        ].filter(([, value]) => value !== ""),
      );
    }
    case "monitor_alert": {
      return Object.fromEntries(
        [
          ["Threshold", read("threshold", "limit")],
          ["Field", read("field", "metric field", "value field")],
          ["Channel", read("channel", "destination")],
        ].filter(([, value]) => value !== ""),
      );
    }
    default: {
      return Object.fromEntries(
        entries.map(([key, value]) => [key, stringifyAiValue(value)]),
      );
    }
  }
}

function normalizeAiConfig(
  nodeType: NodeTypeId,
  rawConfig?: Record<string, unknown>,
  rawParameters?: Record<string, unknown>,
) {
  const config = { ...(rawConfig ?? {}) };

  if (nodeType === "viz_table") {
    const parameterColumns = rawParameters?.Columns ?? rawParameters?.columns;
    if (config.columns === undefined && parameterColumns !== undefined) {
      config.columns = Array.isArray(parameterColumns)
        ? parameterColumns.map((value) => stringifyAiValue(value)).join(",")
        : stringifyAiValue(parameterColumns);
    }
    const maxRows = rawParameters?.["Max Rows"] ?? rawParameters?.maxRows;
    if (config.maxRows === undefined && maxRows !== undefined) {
      config.maxRows = stringifyAiValue(maxRows);
    }
  }

  if (nodeType === "viz_funnel") {
    const steps = rawParameters?.Steps ?? rawParameters?.steps;
    if (Array.isArray(steps)) {
      const labels = steps.map((step) => stringifyAiValue(step)).filter(Boolean);
      if (labels[0]) config.stage1Label = labels[0];
      if (labels[1]) config.stage2Label = labels[1];
      if (labels[2]) config.stage3Label = labels[2];
      if (labels[3]) config.stage4Label = labels[3];
    }
  }

  return config;
}

function normalizeAiNodeOverrides(spec: AiNodeSpec): Partial<WorkflowNodeData> {
  const parameters = normalizeAiParameters(spec.nodeType, spec.parameters);
  const config = normalizeAiConfig(spec.nodeType, spec.config, spec.parameters);
  const programmable = spec.programmable
    ? {
        ...getDefaultProgrammableConfig(spec.nodeType),
        ...(spec.programmable.mode ? { mode: spec.programmable.mode } : {}),
        ...(typeof spec.programmable.code === "string"
          ? { code: spec.programmable.code }
          : {}),
        ...(typeof spec.programmable.outputTemplate === "string"
          ? { outputTemplate: spec.programmable.outputTemplate }
          : {}),
      }
    : undefined;

  return {
    label: spec.label,
    description: spec.description,
    notes: spec.notes,
    chartType: spec.chartType,
    vizVariant: spec.vizVariant,
    programmable,
    parameters,
    config,
  };
}

function buildCatalogNode(
  nodeType: NodeTypeId,
  position: XYPosition,
  overrides: Partial<WorkflowNodeData> = {},
): AppNode {
  const meta = getNodeMeta(nodeType);
  const vizVariant = overrides.vizVariant ?? meta.vizVariant;
  const chartType = overrides.chartType ?? meta.chartType;
  const defaultConfig = getDefaultNodeConfig(nodeType, {
    ...overrides,
    label: overrides.label ?? meta.label,
    vizVariant,
    chartType,
  });

  const defaultParameters: Record<string, string> =
    nodeType === "action_terminal"
      ? {
          Shell:
            typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent)
              ? "cmd"
              : "bash",
        }
      : {};

  return {
    id: uuidv4(),
    type: meta.shellType,
    position,
    data: {
      label: overrides.label ?? meta.label,
      nodeType,
      description: overrides.description ?? meta.description,
      icon: meta.icon,
      badge: meta.badge,
      accent: meta.accent,
      subtle: meta.subtle,
      disabled: false,
      notes: "",
      schema: getNodeSchema(nodeType),
      chartType,
      vizVariant,
      widgets:
        nodeType === "viz_dashboard"
          ? [
              { id: "w1", type: "metric", x: 0, y: 0, w: 2, h: 2 },
              { id: "w2", type: "linechart", x: 2, y: 0, w: 4, h: 3 },
              { id: "w3", type: "table", x: 0, y: 2, w: 3, h: 3 },
            ]
          : undefined,
      programmable: overrides.programmable ?? getDefaultProgrammableConfig(nodeType),
      ...overrides,
      parameters: { ...defaultParameters, ...overrides.parameters },
      config: { ...defaultConfig, ...overrides.config },
    },
  };
}

function buildDefaultWorkflow(projectId: string, name: string, accent?: string): Workflow {
  return {
    id: uuidv4(),
    projectId,
    name,
    accent: accent ?? PROJECT_ACCENTS[0],
    active: false,
    description: "Workflow criado no projeto consolidado.",
    tags: ["new"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    nodes: [buildCatalogNode("trigger_manual", { x: 220, y: 220 })],
    edges: [],
  };
}

export function findFreePosition(
  nodes: AppNode[],
  x: number,
  y: number,
  width = 240,
  height = 120,
): XYPosition {
  const collides = (px: number, py: number) =>
    nodes.some(
      (node) =>
        Math.abs(node.position.x - px) < width + 24 &&
        Math.abs(node.position.y - py) < height + 24,
    );

  if (!collides(x, y)) return { x, y };

  for (let col = 0; col < 8; col += 1) {
    for (let row = 0; row < 6; row += 1) {
      const nx = x + col * (width + 28);
      const ny = y + row * (height + 24);
      if (!collides(nx, ny)) return { x: nx, y: ny };
    }
  }

  return { x: x + nodes.length * 28, y: y + nodes.length * 20 };
}

function createInitialProjects() {
  return createMockProjects();
}

function createInitialWorkflows() {
  return createMockWorkflows().map(syncWorkflow);
}

function createInitialExecutions(workflows: Workflow[]) {
  return createMockExecutions(workflows);
}

function createInitialFlowSnapshot() {
  const projects = createInitialProjects();
  const workflows = createInitialWorkflows();
  const chatState = getInitialChatState();

  return {
    isHydrated: false,
    projects,
    workflows,
    executions: createInitialExecutions(workflows),
    runtimeStores: {} as Record<string, ProjectRuntimeStore>,
    nodeRuntimeByWorkflow: {} as Record<string, Record<string, RuntimeNodeSnapshot>>,
    runtimeBaseUrl: null,
    activeProjectId: workflows[0]?.projectId ?? projects[0]?.id ?? "",
    activeWorkflowId: workflows[0]?.id ?? "",
    selectedNodeId: null,
    contextNodeIds: [] as string[],
    isAddNodePanelOpen: false,
    rightClickCtx: null,
    activeTool: "select" as ToolMode,
    showSettings: false,
    chatExpanded: false,
    chatThreads: chatState.chatThreads,
    activeChatId: chatState.activeChatId,
    deepseekKey: getInitialDeepseekKey(),
    updater: getInitialUpdaterState(),
  };
}

const initialFlowSnapshot = createInitialFlowSnapshot();

export const useFlowStore = create<FlowState>((set, get) => ({
  ...initialFlowSnapshot,

  hydrateFromStorage: async () => {
    if (get().isHydrated) return;

    const seedProjects = createInitialProjects();
    const seedWorkflows = createInitialWorkflows();
    await migrateFromLocalStorageIfNeeded(seedProjects, seedWorkflows);

    const [
      persistedProjects,
      persistedWorkflows,
      persistedRuntimeStores,
      persistedThreads,
      persistedActiveChatId,
      persistedDeepseekKey,
      persistedUpdater,
    ] = await Promise.all([
      getAllProjects(),
      getAllWorkflows(),
      readPersistedRuntimeStores(),
      getAllThreads(),
      getSetting("active-chat-id"),
      getSetting("deepseek-key"),
      getSetting("updater"),
    ]);

    const projects = persistedProjects.length ? persistedProjects : seedProjects;
    const workflows = (persistedWorkflows.length ? persistedWorkflows : seedWorkflows).map(syncWorkflow);
    const chatThreads = persistedThreads.length
      ? persistedThreads.map((thread, index) => sanitizeChatThread(thread, index))
      : createDefaultChatState().chatThreads;
    const activeChatId =
      persistedActiveChatId && chatThreads.some((thread) => thread.id === persistedActiveChatId)
        ? persistedActiveChatId
        : chatThreads[0]?.id ?? "";
    const updaterDefaults = createDefaultUpdaterState();
    const supportedChannels = normalizeReleaseChannels(
      persistedUpdater?.supportedChannels,
      updaterDefaults.supportedChannels,
    );
    const allowedChannels = normalizeReleaseChannels(
      persistedUpdater?.allowedChannels,
      updaterDefaults.allowedChannels,
    );
    const updater: AppUpdateSnapshot = persistedUpdater
      ? {
          ...updaterDefaults,
          ...persistedUpdater,
          supportedChannels,
          allowedChannels,
          releaseChannel: clampReleaseChannel(
            persistedUpdater.releaseChannel,
            allowedChannels,
            supportedChannels,
          ),
          updateState: updaterDefaults.updateState,
          pendingVersion: null,
          availableVersion: null,
          downloadedBytes: null,
          totalBytes: null,
          releaseNotes: null,
          publishedAt: null,
        }
      : updaterDefaults;

    set({
      isHydrated: true,
      projects,
      workflows,
      executions: createInitialExecutions(workflows),
      runtimeStores: persistedRuntimeStores,
      nodeRuntimeByWorkflow: {},
      runtimeBaseUrl: null,
      activeProjectId: workflows[0]?.projectId ?? projects[0]?.id ?? "",
      activeWorkflowId: workflows[0]?.id ?? "",
      selectedNodeId: null,
      contextNodeIds: [],
      isAddNodePanelOpen: false,
      rightClickCtx: null,
      activeTool: "select",
      showSettings: false,
      chatExpanded: false,
      chatThreads,
      activeChatId,
      deepseekKey: persistedDeepseekKey ?? "",
      updater,
    });
  },

  setRuntimeBaseUrl: (url) => set({ runtimeBaseUrl: url }),

  setActiveProject: (id) =>
    set((state) => {
      const projectWorkflows = state.workflows.filter((workflow) => workflow.projectId === id);
      const currentWorkflowInProject = projectWorkflows.some(
        (workflow) => workflow.id === state.activeWorkflowId,
      );

      return {
        activeProjectId: id,
        activeWorkflowId: currentWorkflowInProject
          ? state.activeWorkflowId
          : projectWorkflows[0]?.id ?? "",
        selectedNodeId: null,
        contextNodeIds: [],
        isAddNodePanelOpen: false,
        rightClickCtx: null,
      };
    }),

  createProject: (name) => {
    const projectCount = get().projects.length + 1;
    const project: Project = {
      id: uuidv4(),
      name: name || `Project ${projectCount}`,
      description: "Projeto criado no canvas consolidado.",
      accent: PROJECT_ACCENTS[(projectCount - 1) % PROJECT_ACCENTS.length],
      active: true,
    };
    const workflow = syncWorkflow(
      buildDefaultWorkflow(project.id, `${project.name} Flow`, project.accent),
    );
    const nextRuntimeStores = {
      ...get().runtimeStores,
      [project.id]: getEmptyProjectStore(),
    };

    set((state) => ({
      projects: [...state.projects, project],
      workflows: [...state.workflows, workflow],
      runtimeStores: nextRuntimeStores,
      activeProjectId: project.id,
      activeWorkflowId: workflow.id,
      selectedNodeId: null,
      contextNodeIds: [],
      isAddNodePanelOpen: false,
      rightClickCtx: null,
    }));
    persistRuntimeStores(nextRuntimeStores);

    return project;
  },

  deleteProject: (id) => {
    let deleted = false;

    set((state) => {
      if (state.projects.length <= 1) return state;
      deleted = true;

      const removedWorkflowIds = new Set(
        state.workflows
          .filter((workflow) => workflow.projectId === id)
          .map((workflow) => workflow.id),
      );
      const remainingProjects = state.projects.filter((project) => project.id !== id);
      let remainingWorkflows = state.workflows.filter((workflow) => workflow.projectId !== id);

      if (!remainingWorkflows.length && remainingProjects[0]) {
        remainingWorkflows = [
          syncWorkflow(
            buildDefaultWorkflow(
              remainingProjects[0].id,
              `${remainingProjects[0].name} Flow`,
              remainingProjects[0].accent,
            ),
          ),
        ];
      }

      const nextProject =
        state.activeProjectId === id
          ? remainingProjects[0]
          : remainingProjects.find((project) => project.id === state.activeProjectId) ??
            remainingProjects[0];
      const nextProjectId = nextProject?.id ?? "";
      const nextProjectWorkflows = remainingWorkflows.filter(
        (workflow) => workflow.projectId === nextProjectId,
      );
      const nextWorkflowId =
        nextProjectWorkflows.find((workflow) => workflow.id === state.activeWorkflowId)?.id ??
        nextProjectWorkflows[0]?.id ??
        remainingWorkflows[0]?.id ??
        "";
      const nextRuntimeStores = { ...state.runtimeStores };
      delete nextRuntimeStores[id];
      persistRuntimeStores(nextRuntimeStores);

      return {
        projects: remainingProjects,
        workflows: remainingWorkflows,
        runtimeStores: nextRuntimeStores,
        executions: state.executions.filter(
          (execution) => !removedWorkflowIds.has(execution.workflowId),
        ),
        activeProjectId: nextProjectId,
        activeWorkflowId: nextWorkflowId,
        selectedNodeId: null,
        contextNodeIds: [],
        isAddNodePanelOpen: false,
        rightClickCtx: null,
      };
    });

    if (deleted) {
      deleteProjectStore(id);
      void dbDeleteProject(id).catch(() => {});
      void deleteWorkflowsByProject(id).catch(() => {});
    }
  },

  toggleProjectActive: (id) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id
          ? { ...project, active: !project.active }
          : project,
      ),
    })),

  updateProject: (id, data) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, ...data } : project,
      ),
    })),

  setActiveWorkflow: (id) =>
    set((state) => {
      const workflow = state.workflows.find((item) => item.id === id);
      return {
        activeProjectId: workflow?.projectId ?? state.activeProjectId,
        activeWorkflowId: id,
        selectedNodeId: null,
        contextNodeIds: [],
        isAddNodePanelOpen: false,
        rightClickCtx: null,
      };
    }),

  renameWorkflow: (id, name) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === id ? { ...workflow, name, updatedAt: nowIso() } : workflow,
      ),
    })),

  updateWorkflow: (id, data) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, id, (workflow) => ({
        ...workflow,
        ...data,
        updatedAt: nowIso(),
      })),
    })),

  createWorkflow: (name) => {
    const activeProject = getActiveProjectFromState(get());
    const workflow = syncWorkflow(
      buildDefaultWorkflow(
        get().activeProjectId,
        name || "New Workflow",
        activeProject?.accent,
      ),
    );
    set((state) => ({ workflows: [...state.workflows, workflow] }));
    return workflow;
  },

  duplicateWorkflow: (id) =>
    set((state) => {
      const workflow = state.workflows.find((item) => item.id === id);
      if (!workflow) return state;

      const idMap = new Map<string, string>();
      const nodes = workflow.nodes.map((node) => {
        const nextId = uuidv4();
        idMap.set(node.id, nextId);
        return {
          ...node,
          id: nextId,
          position: { x: node.position.x + 60, y: node.position.y + 60 },
        };
      });

      const edges = workflow.edges.map((edge) => ({
        ...edge,
        id: uuidv4(),
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
      }));

      const copy: Workflow = {
        ...workflow,
        id: uuidv4(),
        name: `${workflow.name} (copy)`,
        active: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        nodes,
        edges,
      };

      return { workflows: [...state.workflows, syncWorkflow(copy)] };
    }),

  deleteWorkflow: (id) => {
    let deleted = false;

    set((state) => {
      const remaining = state.workflows.filter((workflow) => workflow.id !== id);
      deleted = remaining.length !== state.workflows.length;
      const nextNodeRuntimeByWorkflow = { ...state.nodeRuntimeByWorkflow };
      delete nextNodeRuntimeByWorkflow[id];
      return {
        workflows: remaining,
        nodeRuntimeByWorkflow: nextNodeRuntimeByWorkflow,
        activeWorkflowId:
          state.activeWorkflowId === id ? remaining[0]?.id ?? "" : state.activeWorkflowId,
        activeProjectId:
          remaining.find((workflow) => workflow.id === state.activeWorkflowId)?.projectId ??
          remaining[0]?.projectId ??
          state.activeProjectId,
        selectedNodeId: null,
        contextNodeIds: [],
      };
    });

    if (deleted) {
      void dbDeleteWorkflow(id).catch(() => {});
    }
  },

  toggleWorkflowActive: (id) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === id
          ? { ...workflow, active: !workflow.active, updatedAt: nowIso() }
          : workflow,
      ),
    })),

  saveWorkflow: () =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId ? { ...workflow, updatedAt: nowIso() } : workflow,
      ),
    })),

  runWorkflow: async (request = {}) => {
    const state = get();
    const requestedWorkflowId =
      request.workflowId ??
      (typeof request.payload?.workflowId === "string" ? request.payload.workflowId : null);
    const rawWorkflow = requestedWorkflowId
      ? state.workflows.find((item) => item.id === requestedWorkflowId)
      : getActiveWorkflowFromState(state);
    const workflow = rawWorkflow ? syncWorkflow(rawWorkflow) : null;
    const project = workflow
      ? state.projects.find((item) => item.id === workflow.projectId)
      : getActiveProjectFromState(state);
    if (!workflow || !project?.active) return null;

    const executionId = uuidv4();
    const startedAt = Date.now();
    const executionRequest: WorkflowExecutionRequest = {
      workflowId: workflow.id,
      source: request.source ?? "manual",
      triggerNodeId: request.triggerNodeId,
      payload: request.payload,
      webhookDeliveryId: request.webhookDeliveryId ?? null,
    };

    set((current) => ({
      executions: [
        {
          id: executionId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: "running",
          startedAt: new Date(startedAt).toISOString(),
          itemsProcessed: 0,
        },
        ...current.executions,
      ],
      nodeRuntimeByWorkflow: {
        ...current.nodeRuntimeByWorkflow,
        [workflow.id]: workflow.nodes.reduce<Record<string, RuntimeNodeSnapshot>>(
          (accumulator, node) => {
            accumulator[node.id] = {
              nodeId: node.id,
              nodeType: node.data.nodeType,
              status: "idle",
            };
            return accumulator;
          },
          {},
        ),
      },
    }));

    try {
      const result = await executeWorkflowRun({
        project,
        workflow,
        request: executionRequest,
        store: getProjectRuntimeStore(get().runtimeStores, project.id),
        defaultAiApiKey: get().deepseekKey,
        defaultAiBaseUrl: "https://api.deepseek.com/v1/chat/completions",
      });

      const nextRuntimeStores = {
        ...get().runtimeStores,
        [project.id]: result.updatedStore,
      };
      persistRuntimeStores(nextRuntimeStores);

      set((current) => ({
        runtimeStores: nextRuntimeStores,
        nodeRuntimeByWorkflow: {
          ...current.nodeRuntimeByWorkflow,
          [workflow.id]: result.nodeSnapshots,
        },
        workflows: updateWorkflowById(current.workflows, workflow.id, (item) => ({
          ...item,
          updatedAt: nowIso(),
          nodes: item.nodes.map((node) => {
            const patch = result.nodePatches.find((entry) => entry.nodeId === node.id)?.data;
            const runtime = result.nodeSnapshots[node.id]
              ? toNodeRuntimeInfo(result.nodeSnapshots[node.id])
              : node.data.runtime;
            const mergedData = patch
              ? {
                  ...node.data,
                  ...patch,
                  config: {
                    ...(node.data.config ?? {}),
                    ...(patch.config ?? {}),
                  },
                }
              : node.data;

            return {
              ...node,
              data: {
                ...mergedData,
                runtime,
              },
            };
          }),
        })),
        executions: current.executions.map((execution) =>
          execution.id === executionId
            ? {
                ...execution,
                status: result.executionStatus,
                duration: Date.now() - startedAt,
                itemsProcessed: result.itemsProcessed,
              }
            : execution,
        ),
      }));

      return result;
    } catch (error) {
      const message = describeStoreError(error);
      set((current) => ({
        executions: current.executions.map((execution) =>
          execution.id === executionId
            ? {
                ...execution,
                status: "error",
                duration: Date.now() - startedAt,
                itemsProcessed: 0,
              }
            : execution,
        ),
      }));
      console.error("Workflow execution failed", message);
      return null;
    }
  },

  runWorkflowFromWebhook: async (delivery) => {
    const rawWorkflow = get().workflows.find((item) => item.id === delivery.workflowId);
    const workflow = rawWorkflow ? syncWorkflow(rawWorkflow) : undefined;
    const project = get().projects.find((item) => item.id === workflow?.projectId);

    if (!workflow || !project) {
      return {
        status: 404,
        body: JSON.stringify({ error: "workflow_not_found" }),
        headers: { "content-type": "application/json" },
      };
    }

    const result = await get().runWorkflow({
      workflowId: delivery.workflowId,
      source: "webhook",
      triggerNodeId: delivery.nodeId,
      payload:
        delivery.bodyJson ??
        ({
          body: delivery.bodyText,
          headers: delivery.headers,
          query: delivery.query ?? {},
          path: delivery.path,
          method: delivery.method,
        } satisfies Record<string, unknown>),
      webhookDeliveryId: delivery.deliveryId,
    });

    return (
      result?.response ?? {
        status: 200,
        body: JSON.stringify({
          ok: true,
          workflowId: workflow.id,
          processed: result?.itemsProcessed ?? 0,
        }),
        headers: { "content-type": "application/json" },
      }
    );
  },

  exportWorkflowJson: () => {
    const workflow = syncWorkflow(getActiveWorkflowFromState(get()));
    return workflow ? JSON.stringify(workflow, null, 2) : null;
  },

  importWorkflowJson: (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return { success: false, error: "Cole um JSON antes de importar." };

    try {
      const parsed = JSON.parse(trimmed) as Partial<Workflow>;

      set((state) => ({
        workflows: updateWorkflowById(
          state.workflows,
          state.activeWorkflowId,
          (workflow) => ({
            ...workflow,
            name: parsed.name ?? workflow.name,
            accent: parsed.accent ?? workflow.accent,
            description: parsed.description ?? workflow.description,
            tags: Array.isArray(parsed.tags) ? parsed.tags : workflow.tags,
            nodes: Array.isArray(parsed.nodes) ? parsed.nodes : workflow.nodes,
            edges: Array.isArray(parsed.edges) ? parsed.edges : workflow.edges,
            updatedAt: nowIso(),
          }),
        ),
      }));

      return { success: true };
    } catch {
      return { success: false, error: "JSON invalido. Revise o conteudo colado." };
    }
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  toggleContextNode: (id) =>
    set((state) => {
      const isActive = state.contextNodeIds.includes(id);
      return {
        contextNodeIds: isActive
          ? state.contextNodeIds.filter((item) => item !== id)
          : [...state.contextNodeIds, id],
        selectedNodeId: isActive && state.selectedNodeId === id ? null : state.selectedNodeId,
      };
    }),
  clearContextNodes: () => set({ contextNodeIds: [], selectedNodeId: null }),
  setAddNodePanel: (open) => set({ isAddNodePanelOpen: open }),
  setRightClickCtx: (ctx) => set({ rightClickCtx: ctx }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setShowSettings: (show) => set({ showSettings: show }),
  setChatExpanded: (expanded) => set({ chatExpanded: expanded }),

  setActiveChat: (id) =>
    set((state) => {
      if (!state.chatThreads.some((thread) => thread.id === id)) return state;
      persistChatState(state.chatThreads, id);
      return { activeChatId: id };
    }),

  createChat: () => {
    const thread = createChatThread(get().chatThreads.length + 1);
    void saveThread(thread).catch(() => {});

    set((state) => {
      const nextThreads = [...state.chatThreads, thread];
      persistChatState(nextThreads, thread.id);
      return {
        chatThreads: nextThreads,
        activeChatId: thread.id,
        chatExpanded: true,
      };
    });

    return thread.id;
  },

  deleteChat: (id) =>
    set((state) => {
      const deletedIndex = state.chatThreads.findIndex((thread) => thread.id === id);
      if (deletedIndex === -1) return state;
      void dbDeleteThread(id).catch(() => {});

      let nextThreads = state.chatThreads.filter((thread) => thread.id !== id);
      if (!nextThreads.length) {
        void clearAllThreads().catch(() => {});
        nextThreads = [createChatThread(1)];
      }

      let nextActiveId = state.activeChatId;
      if (!nextThreads.some((thread) => thread.id === nextActiveId)) {
        const fallbackIndex = Math.max(0, Math.min(deletedIndex, nextThreads.length - 1));
        nextActiveId = nextThreads[fallbackIndex].id;
      }

      persistChatState(nextThreads, nextActiveId);
      return {
        chatThreads: nextThreads,
        activeChatId: nextActiveId,
      };
    }),

  setDeepseekKey: (key) => {
    void setSetting("deepseek-key", key).catch(() => {});
    set({ deepseekKey: key });
  },

  resetLocalWorkspace: async () => {
    await clearFlowMergeStorage();
    const snapshot = createInitialFlowSnapshot();
    set({
      ...snapshot,
      isHydrated: true,
    });
  },

  hydrateUpdaterConfig: (config) =>
    set((state) => {
      const nextUpdater: AppUpdateSnapshot = config
        ? resetUpdaterTransientState({
            ...state.updater,
            enabled: config.enabled,
            repository: config.repository,
            currentVersion: config.currentVersion,
            supportedChannels: normalizeReleaseChannels(
              config.channels,
              state.updater.supportedChannels,
            ),
            releaseChannel: clampReleaseChannel(
              state.updater.releaseChannel ?? config.defaultChannel,
              state.updater.allowedChannels,
              normalizeReleaseChannels(config.channels, state.updater.supportedChannels),
            ),
            checkIntervalMs: config.checkIntervalMs,
            feedUrls: config.feedUrls,
          })
        : resetUpdaterTransientState({
            ...state.updater,
            enabled: false,
          });

      persistUpdaterState(nextUpdater);
      return { updater: nextUpdater };
    }),

  syncUpdaterAccess: (allowedChannels) =>
    set((state) => {
      const normalizedAllowedChannels = normalizeReleaseChannels(allowedChannels, ["stable"]);
      const visibleChannels = getVisibleUpdaterChannels(
        state.updater.supportedChannels,
        normalizedAllowedChannels,
      );
      const nextUpdater = resetUpdaterTransientState({
        ...state.updater,
        allowedChannels: normalizedAllowedChannels,
        releaseChannel: clampReleaseChannel(
          state.updater.releaseChannel,
          normalizedAllowedChannels,
          state.updater.supportedChannels,
        ),
        feedUrls: Object.fromEntries(
          Object.entries(state.updater.feedUrls).filter(([channel]) =>
            visibleChannels.includes(channel as ReleaseChannel),
          ),
        ) as Partial<Record<ReleaseChannel, string>>,
      });

      persistUpdaterState(nextUpdater);
      return { updater: nextUpdater };
    }),

  handleUpdaterEvent: (event) =>
    set((state) => {
      if (event.channel !== state.updater.releaseChannel) return state;

      const nextUpdater: AppUpdateSnapshot = {
        ...state.updater,
        currentVersion: event.currentVersion || state.updater.currentVersion,
        updateState: event.state,
        availableVersion:
          event.state === "idle" ? null : (event.version ?? state.updater.availableVersion),
        pendingVersion:
          event.state === "ready_to_install"
            ? event.version ?? state.updater.pendingVersion
            : event.state === "idle"
              ? state.updater.pendingVersion
              : state.updater.pendingVersion,
        downloadedBytes:
          typeof event.downloadedBytes === "number"
            ? event.downloadedBytes
            : event.state === "idle"
              ? null
              : state.updater.downloadedBytes,
        totalBytes:
          typeof event.totalBytes === "number"
            ? event.totalBytes
            : event.state === "idle"
              ? null
              : state.updater.totalBytes,
        releaseNotes:
          typeof event.body === "string" ? event.body : state.updater.releaseNotes,
        publishedAt: typeof event.date === "string" ? event.date : state.updater.publishedAt,
        lastUpdateError:
          event.state === "error"
            ? event.error ?? "Nao foi possivel concluir a atualizacao."
            : null,
      };

      persistUpdaterState(nextUpdater);
      return { updater: nextUpdater };
    }),

  setReleaseChannel: (channel) =>
    set((state) => {
      const nextUpdater: AppUpdateSnapshot = resetUpdaterTransientState({
        ...state.updater,
        releaseChannel: clampReleaseChannel(
          channel,
          state.updater.allowedChannels,
          state.updater.supportedChannels,
        ),
      });

      persistUpdaterState(nextUpdater);
      return { updater: nextUpdater };
    }),

  setAutoUpdateEnabled: (enabled) =>
    set((state) => {
      const nextUpdater = {
        ...state.updater,
        autoUpdateEnabled: enabled,
      };
      persistUpdaterState(nextUpdater);
      return { updater: nextUpdater };
    }),

  checkForUpdates: async (options = {}) => {
    const updater = get().updater;
    if (!isDesktopUpdaterAvailable()) return null;

    const checkingState: AppUpdateSnapshot = {
      ...updater,
      updateState: updater.enabled ? "checking" : "disabled",
      lastUpdateError: null,
    };
    set({ updater: checkingState });
    persistUpdaterState(checkingState);

    try {
      const result = await checkDesktopUpdater(updater.releaseChannel);
      if (!result) return null;

      const nextUpdater: AppUpdateSnapshot = {
        ...get().updater,
        enabled: result.enabled,
        currentVersion: result.currentVersion,
        updateState: result.enabled ? (result.available ? "available" : "idle") : "disabled",
        lastCheckedAt: Date.now(),
        availableVersion: result.available ? result.version : null,
        lastUpdateError: null,
        releaseNotes: result.body,
        publishedAt: result.date,
        feedUrls: result.feedUrl
          ? {
              ...get().updater.feedUrls,
              [result.channel]: result.feedUrl,
            }
          : get().updater.feedUrls,
      };

      set({ updater: nextUpdater });
      persistUpdaterState(nextUpdater);

      if (result.enabled && result.available && options.autoDownload !== false && nextUpdater.autoUpdateEnabled) {
        await get().downloadAvailableUpdate();
      }

      return result;
    } catch (error) {
      const message = describeStoreError(error);
      const errorUpdater: AppUpdateSnapshot = {
        ...get().updater,
        updateState: "error",
        lastCheckedAt: Date.now(),
        lastUpdateError: message,
      };
      set({ updater: errorUpdater });
      persistUpdaterState(errorUpdater);
      return null;
    }
  },

  downloadAvailableUpdate: async () => {
    const updater = get().updater;
    if (!isDesktopUpdaterAvailable() || !updater.enabled) return null;

    try {
      const result = await downloadDesktopUpdater(updater.releaseChannel);
      if (!result) return null;

      const nextUpdater: AppUpdateSnapshot = {
        ...get().updater,
        enabled: result.enabled,
        currentVersion: result.currentVersion,
        lastCheckedAt: Date.now(),
        availableVersion: result.version,
        pendingVersion: result.version,
        releaseNotes: result.body,
        publishedAt: result.date,
        feedUrls: result.feedUrl
          ? {
              ...get().updater.feedUrls,
              [result.channel]: result.feedUrl,
            }
          : get().updater.feedUrls,
      };

      set({ updater: nextUpdater });
      persistUpdaterState(nextUpdater);
      return result;
    } catch (error) {
      const message = describeStoreError(error);
      const errorUpdater: AppUpdateSnapshot = {
        ...get().updater,
        updateState: "error",
        lastCheckedAt: Date.now(),
        lastUpdateError: message,
      };
      set({ updater: errorUpdater });
      persistUpdaterState(errorUpdater);
      return null;
    }
  },

  installReadyUpdate: async (options = {}) => {
    if (!isDesktopUpdaterAvailable()) return false;

    const installingUpdater: AppUpdateSnapshot = {
      ...get().updater,
      updateState: "installing",
      lastUpdateError: null,
    };
    set({ updater: installingUpdater });
    persistUpdaterState(installingUpdater);

    try {
      const installed = await installDesktopUpdater();
      if (!installed) return false;
      if (options.relaunch !== false) {
        await relaunchDesktopApp();
      }
      return true;
    } catch (error) {
      const message = describeStoreError(error);
      const errorUpdater: AppUpdateSnapshot = {
        ...get().updater,
        updateState: "error",
        lastUpdateError: message,
      };
      set({ updater: errorUpdater });
      persistUpdaterState(errorUpdater);
      return false;
    }
  },

  onNodesChange: (changes) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => ({
        ...workflow,
        nodes: applyNodeChanges(changes, workflow.nodes) as AppNode[],
        updatedAt: nowIso(),
      })),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => ({
        ...workflow,
        edges: applyEdgeChanges(changes, workflow.edges),
        updatedAt: nowIso(),
      })),
    })),

  onConnect: (connection) =>
    set((state) => {
      const workflow = getActiveWorkflowFromState(state);
      if (!workflow) return state;

      const nextEdges = addEdge(
        {
          ...connection,
          id: uuidv4(),
          animated: workflow.active,
          style: { stroke: "#30363d", strokeWidth: 1.5 },
        },
        workflow.edges,
      );

      return {
        workflows: updateWorkflowById(state.workflows, workflow.id, (item) => ({
          ...item,
          edges: nextEdges,
          updatedAt: nowIso(),
        })),
      };
    }),

  addNode: (node) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => ({
        ...workflow,
        nodes: [...workflow.nodes, node],
        updatedAt: nowIso(),
      })),
    })),

  addCatalogNode: (nodeType, position, overrides = {}, preservePosition = false) => {
    const workflow = getActiveWorkflowFromState(get());
    const nextPosition = position
      ? preservePosition
        ? position
        : findFreePosition(workflow.nodes, position.x, position.y)
      : findFreePosition(workflow.nodes, 360, 220);

    const node = buildCatalogNode(nodeType, nextPosition, overrides);

    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (item) => ({
        ...item,
        nodes: [...item.nodes, node],
        updatedAt: nowIso(),
      })),
      isAddNodePanelOpen: false,
      rightClickCtx: null,
    }));

    return node;
  },

  addAiNodes: (nodes) =>
    nodes.map((spec, index) =>
      get().addCatalogNode(
        spec.nodeType,
        spec.position ?? { x: 260 + index * 280, y: 220 + (index % 2) * 140 },
        normalizeAiNodeOverrides(spec),
        Boolean(spec.position),
      ),
    ),

  duplicateNode: (id) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => {
        if (workflow.id !== state.activeWorkflowId) return workflow;
        const node = workflow.nodes.find((item) => item.id === id);
        if (!node) return workflow;

        const copy: AppNode = {
          ...node,
          id: uuidv4(),
          position: { x: node.position.x + 48, y: node.position.y + 48 },
        };

        return { ...workflow, nodes: [...workflow.nodes, copy], updatedAt: nowIso() };
      }),
    })),

  updateNodeData: (id, data) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => {
        let changed = false;
        const nodes = workflow.nodes.map((node) => {
          if (node.id !== id) return node;
          const hasChanges = Object.entries(data).some(
            ([key, value]) => node.data[key as keyof WorkflowNodeData] !== value,
          );
          if (!hasChanges) return node;
          changed = true;
          return { ...node, data: { ...node.data, ...data } };
        });

        return changed
          ? {
              ...workflow,
              nodes,
              updatedAt: nowIso(),
            }
          : workflow;
      }),
    })),

  updateNodeConfig: (id, config) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => {
        let changed = false;
        const nodes = workflow.nodes.map((node) => {
          if (node.id !== id) return node;
          const currentConfig = node.data.config ?? {};
          const hasChanges = Object.entries(config).some(
            ([key, value]) => currentConfig[key] !== value,
          );
          if (!hasChanges) return node;
          changed = true;
          return {
            ...node,
            data: {
              ...node.data,
              config: {
                ...currentConfig,
                ...config,
              },
            },
          };
        });

        return changed
          ? {
              ...workflow,
              nodes,
              updatedAt: nowIso(),
            }
          : workflow;
      }),
    })),

  updateNodeParameters: (id, field, value) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  parameters: {
                    ...(node.data.parameters ?? {}),
                    [field]: value,
                  },
                },
              }
            : node,
        ),
        updatedAt: nowIso(),
      })),
    })),

  deleteNode: (id) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.filter((node) => node.id !== id),
        edges: workflow.edges.filter((edge) => edge.source !== id && edge.target !== id),
        updatedAt: nowIso(),
      })),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      contextNodeIds: state.contextNodeIds.filter((item) => item !== id),
    })),

  deleteNodes: (ids) =>
    set((state) => ({
      workflows: updateWorkflowById(state.workflows, state.activeWorkflowId, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.filter((node) => !ids.includes(node.id)),
        edges: workflow.edges.filter(
          (edge) => !ids.includes(edge.source) && !ids.includes(edge.target),
        ),
        updatedAt: nowIso(),
      })),
      selectedNodeId:
        state.selectedNodeId && ids.includes(state.selectedNodeId) ? null : state.selectedNodeId,
      contextNodeIds: state.contextNodeIds.filter((item) => !ids.includes(item)),
    })),

  addUserMessage: (content, threadId) => {
    const targetThreadId = threadId ?? get().activeChatId;

    set((state) => {
      const timestamp = Date.now();
      const streamingMessageId = uuidv4();
      const nextThreads = updateChatThreads(state.chatThreads, targetThreadId, (thread) => ({
        ...thread,
        title: thread.messages.some((message) => message.role === "user")
          ? thread.title
          : createChatTitleFromContent(content, thread.title),
        messages: [
          ...thread.messages,
          { id: uuidv4(), role: "user", content, timestamp },
          {
            id: streamingMessageId,
            role: "assistant",
            content: "",
            timestamp: timestamp + 1,
            streaming: true,
          },
        ],
        isStreaming: true,
        streamingMessageId,
        updatedAt: timestamp,
      }));

      persistChatState(nextThreads, state.activeChatId);
      return {
        chatThreads: nextThreads,
        chatExpanded: true,
      };
    });

    return targetThreadId;
  },

  appendStreamChunk: (threadId, chunk) =>
    set((state) => {
      const nextThreads = updateChatThreads(state.chatThreads, threadId, (thread) => {
        if (!thread.streamingMessageId) return thread;

        return {
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === thread.streamingMessageId
              ? { ...message, content: `${message.content}${chunk}` }
              : message,
          ),
          updatedAt: Date.now(),
        };
      });

      if (nextThreads === state.chatThreads) return state;

      persistChatState(nextThreads, state.activeChatId);
      return { chatThreads: nextThreads };
    }),

  resolveAssistantMessage: (threadId, content, ui) =>
    set((state) => {
      const nextThreads = updateChatThreads(state.chatThreads, threadId, (thread) => {
        if (!thread.streamingMessageId) return thread;

        return {
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === thread.streamingMessageId
              ? {
                  ...message,
                  content,
                  generativeUI: ui,
                  streaming: false,
                }
              : message,
          ),
          isStreaming: false,
          streamingMessageId: null,
          updatedAt: Date.now(),
        };
      });

      if (nextThreads === state.chatThreads) return state;

      persistChatState(nextThreads, state.activeChatId);
      return { chatThreads: nextThreads };
    }),

  failAssistantMessage: (threadId, error) =>
    set((state) => {
      const nextThreads = updateChatThreads(state.chatThreads, threadId, (thread) => {
        if (!thread.streamingMessageId) return thread;

        return {
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === thread.streamingMessageId
              ? { ...message, content: error, streaming: false }
              : message,
          ),
          isStreaming: false,
          streamingMessageId: null,
          updatedAt: Date.now(),
        };
      });

      if (nextThreads === state.chatThreads) return state;

      persistChatState(nextThreads, state.activeChatId);
      return { chatThreads: nextThreads };
    }),
}));

let persistProjectsTimer: ReturnType<typeof setTimeout> | null = null;
let persistWorkflowsTimer: ReturnType<typeof setTimeout> | null = null;

useFlowStore.subscribe((state, previousState) => {
  if (!state.isHydrated) return;

  if (state.projects !== previousState.projects) {
    if (persistProjectsTimer) {
      clearTimeout(persistProjectsTimer);
    }

    persistProjectsTimer = setTimeout(() => {
      void saveAllProjects(state.projects).catch(() => {});
    }, 400);
  }

  if (state.workflows !== previousState.workflows) {
    if (persistWorkflowsTimer) {
      clearTimeout(persistWorkflowsTimer);
    }

    persistWorkflowsTimer = setTimeout(() => {
      void saveAllWorkflows(state.workflows).catch(() => {});
    }, 400);
  }
});

export function useActiveWorkflow() {
  return useFlowStore((state) => getActiveWorkflowFromState(state));
}

export function useActiveProject() {
  return useFlowStore((state) => getActiveProjectFromState(state));
}

export function useActiveChatThread() {
  return useFlowStore((state) => getActiveChatThreadFromState(state));
}
