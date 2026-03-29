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
import { createMockExecutions, createMockProjects, createMockWorkflows } from "@/lib/mock-data";
import { getNodeMeta, type NodeTypeId } from "@/lib/node-catalog";
import { getDefaultNodeConfig, getNodeSchema } from "@/lib/node-config";
import type {
  AiNodeSpec,
  AppNode,
  ChatMessage,
  ChatThread,
  Execution,
  Project,
  GenerativeComponent,
  RightClickContext,
  ToolMode,
  Workflow,
  WorkflowNodeData,
} from "@/lib/flow-types";

const DEEPSEEK_STORAGE_KEY = "flow-merge-deepseek-key";
const CHAT_THREADS_STORAGE_KEY = "flow-merge-chat-threads";
const CHAT_ACTIVE_ID_STORAGE_KEY = "flow-merge-active-chat-id";
const CHAT_WELCOME_MESSAGE =
  "Eu posso montar workflows, criar dashboards e editar nos do canvas. Use Ctrl+click para mandar nos como contexto para a IA.";

interface FlowState {
  projects: Project[];
  workflows: Workflow[];
  executions: Execution[];
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
  runWorkflow: () => void;
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

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: AppNode) => void;
  addCatalogNode: (
    nodeType: NodeTypeId,
    position?: XYPosition,
    overrides?: Partial<WorkflowNodeData>,
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
  if (typeof window === "undefined") return createDefaultChatState();

  try {
    const rawThreads = window.localStorage.getItem(CHAT_THREADS_STORAGE_KEY);
    if (!rawThreads) return createDefaultChatState();

    const parsed = JSON.parse(rawThreads) as Partial<ChatThread>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return createDefaultChatState();

    const chatThreads = parsed.map((thread, index) => sanitizeChatThread(thread, index));
    const persistedActiveId = window.localStorage.getItem(CHAT_ACTIVE_ID_STORAGE_KEY);
    const activeChatId =
      persistedActiveId && chatThreads.some((thread) => thread.id === persistedActiveId)
        ? persistedActiveId
        : chatThreads[0].id;

    return { chatThreads, activeChatId };
  } catch {
    return createDefaultChatState();
  }
}

function persistChatState(chatThreads: ChatThread[], activeChatId: string) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CHAT_THREADS_STORAGE_KEY, JSON.stringify(chatThreads));
  window.localStorage.setItem(CHAT_ACTIVE_ID_STORAGE_KEY, activeChatId);
}

function getInitialDeepseekKey() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DEEPSEEK_STORAGE_KEY) ?? "";
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
      ...overrides,
      parameters: { ...overrides.parameters },
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

const initialProjects = createMockProjects();
const initialWorkflows = createMockWorkflows();
const initialChatState = getInitialChatState();

export const useFlowStore = create<FlowState>((set, get) => ({
  projects: initialProjects,
  workflows: initialWorkflows,
  executions: createMockExecutions(initialWorkflows),
  activeProjectId: initialWorkflows[0]?.projectId ?? initialProjects[0]?.id ?? "",
  activeWorkflowId: initialWorkflows[0]?.id ?? "",
  selectedNodeId: null,
  contextNodeIds: [],
  isAddNodePanelOpen: false,
  rightClickCtx: null,
  activeTool: "select",
  showSettings: false,
  chatExpanded: false,
  chatThreads: initialChatState.chatThreads,
  activeChatId: initialChatState.activeChatId,
  deepseekKey: getInitialDeepseekKey(),

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
    const workflow = buildDefaultWorkflow(project.id, `${project.name} Flow`, project.accent);

    set((state) => ({
      projects: [...state.projects, project],
      workflows: [...state.workflows, workflow],
      activeProjectId: project.id,
      activeWorkflowId: workflow.id,
      selectedNodeId: null,
      contextNodeIds: [],
      isAddNodePanelOpen: false,
      rightClickCtx: null,
    }));

    return project;
  },

  deleteProject: (id) =>
    set((state) => {
      if (state.projects.length <= 1) return state;

      const removedWorkflowIds = new Set(
        state.workflows
          .filter((workflow) => workflow.projectId === id)
          .map((workflow) => workflow.id),
      );
      const remainingProjects = state.projects.filter((project) => project.id !== id);
      let remainingWorkflows = state.workflows.filter((workflow) => workflow.projectId !== id);

      if (!remainingWorkflows.length && remainingProjects[0]) {
        remainingWorkflows = [
          buildDefaultWorkflow(
            remainingProjects[0].id,
            `${remainingProjects[0].name} Flow`,
            remainingProjects[0].accent,
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

      return {
        projects: remainingProjects,
        workflows: remainingWorkflows,
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
    }),

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
      workflows: state.workflows.map((workflow) =>
        workflow.id === id
          ? { ...workflow, ...data, updatedAt: nowIso() }
          : workflow,
      ),
    })),

  createWorkflow: (name) => {
    const activeProject = getActiveProjectFromState(get());
    const workflow = buildDefaultWorkflow(
      get().activeProjectId,
      name || "New Workflow",
      activeProject?.accent,
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

      return { workflows: [...state.workflows, copy] };
    }),

  deleteWorkflow: (id) =>
    set((state) => {
      const remaining = state.workflows.filter((workflow) => workflow.id !== id);
      return {
        workflows: remaining,
        activeWorkflowId:
          state.activeWorkflowId === id ? remaining[0]?.id ?? "" : state.activeWorkflowId,
        activeProjectId:
          remaining.find((workflow) => workflow.id === state.activeWorkflowId)?.projectId ??
          remaining[0]?.projectId ??
          state.activeProjectId,
        selectedNodeId: null,
        contextNodeIds: [],
      };
    }),

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

  runWorkflow: () => {
    const state = get();
    const workflow = getActiveWorkflowFromState(state);
    const project = getActiveProjectFromState(state);
    if (!workflow || !project?.active) return;

    const executionId = uuidv4();
    set((state) => ({
      executions: [
        {
          id: executionId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: "running",
          startedAt: nowIso(),
          itemsProcessed: 0,
        },
        ...state.executions,
      ],
    }));

    window.setTimeout(() => {
      set((state) => ({
        executions: state.executions.map((execution) =>
          execution.id === executionId
            ? {
                ...execution,
                status: Math.random() > 0.12 ? "success" : "error",
                duration: 950 + Math.floor(Math.random() * 2500),
                itemsProcessed: 80 + Math.floor(Math.random() * 1200),
              }
            : execution,
        ),
      }));
    }, 1400);
  },

  exportWorkflowJson: () => {
    const workflow = getActiveWorkflowFromState(get());
    return workflow ? JSON.stringify(workflow, null, 2) : null;
  },

  importWorkflowJson: (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return { success: false, error: "Cole um JSON antes de importar." };

    try {
      const parsed = JSON.parse(trimmed) as Partial<Workflow>;

      set((state) => ({
        workflows: state.workflows.map((workflow) =>
          workflow.id === state.activeWorkflowId
            ? {
                ...workflow,
                name: parsed.name ?? workflow.name,
                accent: parsed.accent ?? workflow.accent,
                description: parsed.description ?? workflow.description,
                tags: Array.isArray(parsed.tags) ? parsed.tags : workflow.tags,
                nodes: Array.isArray(parsed.nodes) ? parsed.nodes : workflow.nodes,
                edges: Array.isArray(parsed.edges) ? parsed.edges : workflow.edges,
                updatedAt: nowIso(),
              }
            : workflow,
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

      let nextThreads = state.chatThreads.filter((thread) => thread.id !== id);
      if (!nextThreads.length) {
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEEPSEEK_STORAGE_KEY, key);
    }
    set({ deepseekKey: key });
  },

  onNodesChange: (changes) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? {
              ...workflow,
              nodes: applyNodeChanges(changes, workflow.nodes) as AppNode[],
              updatedAt: nowIso(),
            }
          : workflow,
      ),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? { ...workflow, edges: applyEdgeChanges(changes, workflow.edges), updatedAt: nowIso() }
          : workflow,
      ),
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
        workflows: state.workflows.map((item) =>
          item.id === workflow.id ? { ...item, edges: nextEdges, updatedAt: nowIso() } : item,
        ),
      };
    }),

  addNode: (node) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? { ...workflow, nodes: [...workflow.nodes, node], updatedAt: nowIso() }
          : workflow,
      ),
    })),

  addCatalogNode: (nodeType, position, overrides = {}) => {
    const workflow = getActiveWorkflowFromState(get());
    const freePosition = position
      ? findFreePosition(workflow.nodes, position.x, position.y)
      : findFreePosition(workflow.nodes, 360, 220);

    const node = buildCatalogNode(nodeType, freePosition, overrides);

    set((state) => ({
      workflows: state.workflows.map((item) =>
        item.id === state.activeWorkflowId
          ? { ...item, nodes: [...item.nodes, node], updatedAt: nowIso() }
          : item,
      ),
      isAddNodePanelOpen: false,
      rightClickCtx: null,
    }));

    return node;
  },

  addAiNodes: (nodes) =>
    nodes.map((spec, index) =>
      get().addCatalogNode(
        spec.nodeType,
        { x: 260 + index * 280, y: 220 + (index % 2) * 140 },
        spec as unknown as Partial<WorkflowNodeData>,
      ),
    ),

  duplicateNode: (id) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
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
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? {
              ...workflow,
              nodes: workflow.nodes.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, ...data } } : node,
              ),
              updatedAt: nowIso(),
            }
          : workflow,
      ),
    })),

  updateNodeConfig: (id, config) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? {
              ...workflow,
              nodes: workflow.nodes.map((node) =>
                node.id === id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        config: {
                          ...(node.data.config ?? {}),
                          ...config,
                        },
                      },
                    }
                  : node,
              ),
              updatedAt: nowIso(),
            }
          : workflow,
      ),
    })),

  updateNodeParameters: (id, field, value) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? {
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
            }
          : workflow,
      ),
    })),

  deleteNode: (id) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? {
              ...workflow,
              nodes: workflow.nodes.filter((node) => node.id !== id),
              edges: workflow.edges.filter((edge) => edge.source !== id && edge.target !== id),
              updatedAt: nowIso(),
            }
          : workflow,
      ),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      contextNodeIds: state.contextNodeIds.filter((item) => item !== id),
    })),

  deleteNodes: (ids) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === state.activeWorkflowId
          ? {
              ...workflow,
              nodes: workflow.nodes.filter((node) => !ids.includes(node.id)),
              edges: workflow.edges.filter(
                (edge) => !ids.includes(edge.source) && !ids.includes(edge.target),
              ),
              updatedAt: nowIso(),
            }
          : workflow,
      ),
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

export function useActiveWorkflow() {
  return useFlowStore((state) => getActiveWorkflowFromState(state));
}

export function useActiveProject() {
  return useFlowStore((state) => getActiveProjectFromState(state));
}

export function useActiveChatThread() {
  return useFlowStore((state) => getActiveChatThreadFromState(state));
}
