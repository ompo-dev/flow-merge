import { formatRelevantWorkflowExamples } from "@/lib/ai-workflow-examples";
import { formatNodePlaybookForPrompt } from "@/lib/ai-node-playbook";
import {
  allowedAiNodeTypes,
  nodeCatalogMap,
  type NodeTypeId,
} from "@/lib/node-catalog";
import type {
  AiNodeSpec,
  AiWorkflowEdge,
  GenerativeComponent,
  Workflow,
} from "@/lib/flow-types";

export interface NodeCommand {
  command: "update_node" | "delete_node" | "create_edge";
  nodeId?: string;
  data?: Record<string, unknown>;
  source?: string;
  target?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface AIResponse {
  action: "create_nodes" | "show_analysis" | "chat" | "modify";
  message: string;
  nodes?: AiNodeSpec[];
  edges?: AiWorkflowEdge[];
  commands?: NodeCommand[];
  ui?: GenerativeComponent[];
}

type DeepSeekContextNode = {
  id: string;
  label: string;
  nodeType: NodeTypeId;
  parameters?: Record<string, string>;
  config?: Record<string, unknown>;
};

type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

type ValidationNode = {
  ref: string;
  label: string;
  nodeType: NodeTypeId;
  parameters?: Record<string, unknown>;
};

const VALID_AI_ACTIONS = new Set<AIResponse["action"]>([
  "create_nodes",
  "show_analysis",
  "chat",
  "modify",
]);
const VALID_COMMANDS = new Set<NodeCommand["command"]>([
  "update_node",
  "delete_node",
  "create_edge",
]);
const VALID_UI_COMPONENTS = new Set<GenerativeComponent["component"]>([
  "metric",
  "chart",
  "table",
  "text",
]);
const VALID_CHART_TYPES = new Set<NonNullable<AiNodeSpec["chartType"]>>([
  "line",
  "bar",
  "area",
]);
const VALID_VIZ_VARIANTS = new Set<NonNullable<AiNodeSpec["vizVariant"]>>([
  "revenue",
  "conversion",
  "users",
  "errors",
  "aov",
  "custom",
]);
const LAYOUT_BASE_X = 80;
const LAYOUT_BASE_Y = 120;
const LAYOUT_COLUMN_GAP = 440;
const LAYOUT_ROW_GAP = 220;
const LAYOUT_COLLISION_X_GAP = 320;
const LAYOUT_COLLISION_Y_GAP = 170;

const SYSTEM_PROMPT = `You are Flow Merge AI, an embedded workflow automation and analytics assistant.

You operate a canvas-based app for indie hackers and SaaS founders.
Respond ONLY with valid JSON. No code fences and no prose outside JSON.
The "message" field may contain markdown for rich chat rendering.
User messages may contain markdown. Read headings, bullets, emphasis, tables, and fenced code as structured intent.

Allowed nodeType values:
${allowedAiNodeTypes.join(", ")}

Response format:
{
  "action": "create_nodes" | "show_analysis" | "chat" | "modify",
  "message": "Short explanation",
  "nodes": [
    {
      "alias": "trigger_a",
      "nodeType": "trigger_webhook",
      "label": "Webhook",
      "description": "optional",
      "notes": "optional",
      "parameters": { "Path": "/webhook" },
      "config": {},
      "programmable": {
        "mode": "builtin" | "code",
        "code": "optional javascript",
        "outputTemplate": "optional json template"
      },
      "position": { "x": 80, "y": 120 },
      "chartType": "line",
      "vizVariant": "revenue"
    }
  ],
  "edges": [
    { "source": "trigger_a", "target": "store_a" },
    { "source": "winner_found", "target": "announce_winner", "sourceHandle": "true" }
  ],
  "commands": [
    { "command": "update_node", "nodeId": "node-id", "data": { "label": "New label" } },
    { "command": "delete_node", "nodeId": "node-id" },
    { "command": "create_edge", "source": "node-a", "target": "node-b", "sourceHandle": "true" }
  ],
  "ui": [
    { "component": "metric", "props": { "label": "MRR", "value": "$12,450", "trend": "+5.2%" } },
    { "component": "chart", "props": { "type": "line", "title": "Revenue", "data": [{ "name": "Mon", "value": 12 }] } },
    { "component": "table", "props": { "title": "Top events", "columns": ["Event", "Count"], "rows": [["signup", "142"]] } },
    { "component": "text", "props": { "content": "Short insight" } }
  ]
}

Rules:
- Before writing JSON, silently plan in this order: classify the business goal, choose the canonical topology, choose the exact nodes, configure exact parameters, configure programmable logic only where needed, then validate that every downstream node can really use the upstream data/artifact it receives.
- Prefer "edges" for graph creation. Do not rely on implicit linear chaining.
- Use node aliases in "edges". Never use labels as edge references.
- Parameter values must be primitive strings, numbers, or booleans. Do not send arrays inside "parameters".
- Every request may include the full workflow JSON. Use it to preserve context, avoid stale edits, and modify only what is necessary.
- All nodes are programmable. When a node needs custom behavior, include a "programmable" object with "mode", "code", and optional "outputTemplate".
- For trigger nodes, when the flow depends on specific event names or fields, include config.testPayload with a realistic sample JSON that matches downstream expectations.
- Reference examples may be provided. Use them as guidance only. Never copy them blindly when the user intent or existing workflow differs.
- Use real parameter names from the app:
  - trigger_webhook: "Path", "HTTP Method", "Authentication", "Secret Token", "Tag Field", "Tag Value"
  - action_set: "Field Name", "Field Value"
  - analytics_store: "Store Name"
  - analytics_compare: "Input A Label", "Input B Label", "Metric"
  - analytics_ab: "Store Names", "Variant Field", "Conversion Field", "Revenue Field", "Minimum Sample"
  - action_if: "Value 1", "Operation", "Value 2"
  - monitor_alert: "Threshold", "Field", "Channel"
  - action_slack: "Webhook URL", "Channel", "Message"
  - action_email: "API Key", "From", "To", "Subject", "Message"
- For A/B or multivariate tests, do not use action_split to randomize variants.
- For A/B tests, prefer one trigger per variant, each trigger emitting a static variant tag, then one action_switch router, then one store per variant, then analytics_ab, then chart/report/metric nodes, then winner detection and notifications.
- For observability and logs, prefer one trigger per source, one store per source, one analytics_compare node that compares active sources, then downstream metrics/charts/reports/alerts that react to those sources. Do not use A/B terminology for logs.
- If the workflow is edited and a source/variant disappears, propagate that change downstream. Do not keep stale labels, stale stores, stale cases, or stale comparison semantics.
- Do not pretend a comparison still exists when only one active source remains. In that case simplify the semantics to the remaining live source.
- Manual disable is different from blocked by flow. If a source/node is disabled, do not delete its downstream branch automatically. Keep blocked nodes on the canvas, but treat them as semantically inactive until an active upstream source exists again.
- Shared downstream nodes must adapt to the remaining live upstream inputs. Exclusive downstream nodes must remain visible but blocked when their only active input disappears.
- Organize positions in readable columns from left to right with generous spacing. Keep at least ~440px between columns and ~220px between stacked nodes in the same column. Never place nodes on top of each other.
- When editing an existing workflow, prefer placing new nodes beside the current live graph instead of on top of existing nodes.

When context nodes are provided, you may modify them using commands.
If the user asks to build a workflow, prefer action="create_nodes".
If the user asks to analyze something, prefer action="show_analysis".
If the user asks to edit existing nodes, prefer action="modify".`;

const CRITIC_PROMPT = `You are Flow Merge AI Critic.

You review a proposed Flow Merge workflow JSON and return a corrected final JSON in the same response format.
Respond ONLY with valid JSON. No code fences and no prose outside JSON.
The "message" field may contain markdown for rich chat rendering.

Your job:
- Fix topology mistakes.
- Fix wrong node choice for the business goal.
- Fix stale branches, stale labels, stale stores, stale comparisons, stale experiment semantics.
- Fix parameters so every node can really use its upstream data.
- Add programmable logic only when necessary.
- Preserve disabled-vs-blocked semantics: keep dead branches visible when they are only blocked by missing upstream, and adapt shared downstream nodes to live inputs.
- Fix unreadable layouts and overlapping positions.
- Keep the plan minimal and coherent.
- Preserve user intent exactly.

Return only the corrected final JSON object.`;

function normalizeRawJson(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function normalizeIntentText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeNodeReference(value: string) {
  return normalizeIntentText(value).replace(/\s+/g, " ").trim();
}

function slugifyReference(value: string) {
  const slug = normalizeIntentText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "node";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeJsonValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value)
    .map(([key, entry]) => [key, sanitizeJsonValue(entry, depth + 1)] as const)
    .filter(([, entry]) => entry !== undefined);

  return Object.fromEntries(entries);
}

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeParameterValue(
  value: unknown,
): string | number | boolean | null {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const flattened = value
      .map((entry) => sanitizeParameterValue(entry))
      .filter(
        (entry): entry is string | number | boolean =>
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean",
      );
    return flattened.length ? flattened.join(", ") : null;
  }
  if (!isRecord(value)) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function isPrimitiveParameterValue(
  value: string | number | boolean | null,
): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function sanitizeParameters(
  value: unknown,
): Record<string, string | number | boolean> | undefined {
  if (!isRecord(value)) return undefined;

  const parameters = Object.entries(value).reduce<
    Record<string, string | number | boolean>
  >((accumulator, [rawKey, rawValue]) => {
    const key = rawKey.trim();
    const entry = sanitizeParameterValue(rawValue);
    if (
      key === "" ||
      !isPrimitiveParameterValue(entry) ||
      (typeof entry === "string" && entry.trim() === "")
    ) {
      return accumulator;
    }

    accumulator[key] = entry;
    return accumulator;
  }, {});

  return Object.keys(parameters).length ? parameters : undefined;
}

function sanitizeConfig(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const sanitized = sanitizeJsonValue(value);
  return isRecord(sanitized) && Object.keys(sanitized).length
    ? sanitized
    : undefined;
}

function sanitizePosition(
  value: unknown,
  fallbackIndex: number,
): { x: number; y: number } {
  const fallback = {
    x: LAYOUT_BASE_X + (fallbackIndex % 4) * LAYOUT_COLUMN_GAP,
    y: LAYOUT_BASE_Y + Math.floor(fallbackIndex / 4) * LAYOUT_ROW_GAP,
  };

  if (!isRecord(value)) return fallback;
  const x =
    typeof value.x === "number" && Number.isFinite(value.x)
      ? value.x
      : fallback.x;
  const y =
    typeof value.y === "number" && Number.isFinite(value.y)
      ? value.y
      : fallback.y;
  return { x, y };
}

function isNodeTypeId(value: unknown): value is NodeTypeId {
  return (
    typeof value === "string" &&
    allowedAiNodeTypes.includes(value as NodeTypeId)
  );
}

function isChartType(
  value: unknown,
): value is NonNullable<AiNodeSpec["chartType"]> {
  return (
    typeof value === "string" &&
    VALID_CHART_TYPES.has(value as NonNullable<AiNodeSpec["chartType"]>)
  );
}

function isVizVariant(
  value: unknown,
): value is NonNullable<AiNodeSpec["vizVariant"]> {
  return (
    typeof value === "string" &&
    VALID_VIZ_VARIANTS.has(value as NonNullable<AiNodeSpec["vizVariant"]>)
  );
}

function sanitizeProgrammable(
  value: unknown,
): AiNodeSpec["programmable"] | undefined {
  if (!isRecord(value)) return undefined;

  const mode =
    value.mode === "code"
      ? "code"
      : value.mode === "builtin"
        ? "builtin"
        : undefined;
  const code = typeof value.code === "string" ? value.code : undefined;
  const outputTemplate =
    typeof value.outputTemplate === "string" ? value.outputTemplate : undefined;

  if (!mode && code === undefined && outputTemplate === undefined)
    return undefined;

  return {
    ...(mode ? { mode } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(outputTemplate !== undefined ? { outputTemplate } : {}),
  };
}

function buildUniqueAlias(
  requestedAlias: string,
  nodeType: NodeTypeId,
  label: string,
  usedAliases: Set<string>,
) {
  let base = slugifyReference(
    requestedAlias || label || nodeCatalogMap[nodeType].label || nodeType,
  );
  if (!/^[a-z_]/.test(base)) {
    base = `node_${base}`;
  }

  let alias = base;
  let counter = 2;
  while (usedAliases.has(alias)) {
    alias = `${base}_${counter}`;
    counter += 1;
  }
  usedAliases.add(alias);
  return alias;
}

function sanitizeNodes(value: unknown): AiNodeSpec[] {
  if (!Array.isArray(value)) return [];

  const usedAliases = new Set<string>();
  const nodes: AiNodeSpec[] = [];

  value.forEach((entry, index) => {
    if (!isRecord(entry) || !isNodeTypeId(entry.nodeType)) return;

    const nodeType = entry.nodeType;
    const meta = nodeCatalogMap[nodeType];
    const label = sanitizeText(entry.label) || meta.label;
    const alias = buildUniqueAlias(
      sanitizeText(entry.alias),
      nodeType,
      label,
      usedAliases,
    );
    const description = sanitizeText(entry.description);
    const notes = sanitizeText(entry.notes);
    const parameters = sanitizeParameters(entry.parameters);
    const config = sanitizeConfig(entry.config);
    const programmable = sanitizeProgrammable(entry.programmable);
    const chartType = isChartType(entry.chartType)
      ? entry.chartType
      : meta.chartType;
    const vizVariant = isVizVariant(entry.vizVariant)
      ? entry.vizVariant
      : meta.vizVariant;

    nodes.push({
      alias,
      nodeType,
      label,
      ...(description ? { description } : {}),
      ...(notes ? { notes } : {}),
      ...(parameters ? { parameters } : {}),
      ...(config ? { config } : {}),
      ...(programmable ? { programmable } : {}),
      position: sanitizePosition(entry.position, index),
      ...(chartType ? { chartType } : {}),
      ...(vizVariant ? { vizVariant } : {}),
    });
  });

  return nodes;
}

function buildAiNodeReferenceLookup(nodes: AiNodeSpec[]) {
  const lookup = new Map<string, AiNodeSpec>();

  nodes.forEach((node) => {
    const refs = [node.alias, node.label].filter(Boolean) as string[];
    refs.forEach((ref) => {
      lookup.set(normalizeNodeReference(ref), node);
    });
  });

  return lookup;
}

function inferLayoutDepths(nodes: AiNodeSpec[], edges: AiWorkflowEdge[]) {
  const lookup = buildAiNodeReferenceLookup(nodes);
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const depths = new Map<string, number>();

  nodes.forEach((node) => {
    if (!node.alias) return;
    adjacency.set(node.alias, []);
    indegree.set(node.alias, 0);
  });

  edges.forEach((edge) => {
    const sourceNode = lookup.get(normalizeNodeReference(edge.source));
    const targetNode = lookup.get(normalizeNodeReference(edge.target));
    if (!sourceNode?.alias || !targetNode?.alias) return;
    if (sourceNode.alias === targetNode.alias) return;

    adjacency.set(sourceNode.alias, [
      ...(adjacency.get(sourceNode.alias) ?? []),
      targetNode.alias,
    ]);
    indegree.set(targetNode.alias, (indegree.get(targetNode.alias) ?? 0) + 1);
  });

  const queue = nodes
    .filter((node) => node.alias && (indegree.get(node.alias) ?? 0) === 0)
    .sort((left, right) => {
      const leftX = left.position?.x ?? 0;
      const rightX = right.position?.x ?? 0;
      if (leftX !== rightX) return leftX - rightX;

      return (left.position?.y ?? 0) - (right.position?.y ?? 0);
    })
    .map((node) => node.alias as string);

  queue.forEach((alias) => {
    depths.set(alias, 0);
  });

  while (queue.length) {
    const currentAlias = queue.shift();
    if (!currentAlias) continue;

    (adjacency.get(currentAlias) ?? []).forEach((targetAlias) => {
      const nextDepth = (depths.get(currentAlias) ?? 0) + 1;
      depths.set(
        targetAlias,
        Math.max(depths.get(targetAlias) ?? 0, nextDepth),
      );
      indegree.set(targetAlias, (indegree.get(targetAlias) ?? 1) - 1);

      if ((indegree.get(targetAlias) ?? 0) <= 0) {
        queue.push(targetAlias);
      }
    });
  }

  nodes
    .filter((node) => node.alias && !depths.has(node.alias))
    .sort((left, right) => {
      const leftX = left.position?.x ?? 0;
      const rightX = right.position?.x ?? 0;
      if (leftX !== rightX) return leftX - rightX;
      return (left.position?.y ?? 0) - (right.position?.y ?? 0);
    })
    .forEach((node, index) => {
      depths.set(node.alias as string, index);
    });

  return depths;
}

function applySmartLayout(
  response: AIResponse,
  workflowContext: Workflow | null | undefined,
): AIResponse {
  if (!response.nodes?.length) return response;

  const nodes = response.nodes;
  const edges = response.edges ?? [];
  const depths = inferLayoutDepths(nodes, edges);
  const grouped = new Map<number, AiNodeSpec[]>();

  nodes.forEach((node, index) => {
    const depth = depths.get(node.alias ?? "") ?? index;
    const currentColumn = grouped.get(depth) ?? [];
    currentColumn.push(node);
    grouped.set(depth, currentColumn);
  });

  const maxRows = Math.max(
    ...[...grouped.values()].map((column) => column.length),
    1,
  );
  const existingPositions =
    workflowContext?.nodes.map((node) => ({
      x: typeof node.position.x === "number" ? node.position.x : LAYOUT_BASE_X,
      y: typeof node.position.y === "number" ? node.position.y : LAYOUT_BASE_Y,
    })) ?? [];
  const existingMaxX = existingPositions.reduce(
    (max, position) => Math.max(max, position.x),
    LAYOUT_BASE_X - LAYOUT_COLUMN_GAP,
  );
  const shouldAppendToRight = Boolean(workflowContext?.nodes.length);
  const baseX = shouldAppendToRight
    ? existingMaxX + LAYOUT_COLUMN_GAP
    : LAYOUT_BASE_X;
  const occupied = [...existingPositions];
  const laidOutByAlias = new Map<string, AiNodeSpec>();

  [...grouped.entries()]
    .sort(([leftDepth], [rightDepth]) => leftDepth - rightDepth)
    .forEach(([depth, columnNodes]) => {
      const orderedColumnNodes = [...columnNodes].sort((left, right) => {
        const leftY = left.position?.y ?? 0;
        const rightY = right.position?.y ?? 0;
        if (leftY !== rightY) return leftY - rightY;
        return (left.position?.x ?? 0) - (right.position?.x ?? 0);
      });
      const columnStartY =
        LAYOUT_BASE_Y +
        Math.max(
          0,
          (maxRows - orderedColumnNodes.length) * (LAYOUT_ROW_GAP / 2),
        );

      orderedColumnNodes.forEach((node, index) => {
        let x = baseX + depth * LAYOUT_COLUMN_GAP;
        let y = columnStartY + index * LAYOUT_ROW_GAP;
        let attempts = 0;

        while (
          occupied.some(
            (position) =>
              Math.abs(position.x - x) < LAYOUT_COLLISION_X_GAP &&
              Math.abs(position.y - y) < LAYOUT_COLLISION_Y_GAP,
          ) &&
          attempts < 24
        ) {
          y += LAYOUT_ROW_GAP;
          attempts += 1;

          if (attempts % 6 === 0) {
            x += 80;
          }
        }

        occupied.push({ x, y });
        if (node.alias) {
          laidOutByAlias.set(node.alias, {
            ...node,
            position: { x, y },
          });
        }
      });
    });

  return {
    ...response,
    nodes: nodes.map((node) => {
      if (!node.alias) return node;
      return laidOutByAlias.get(node.alias) ?? node;
    }),
  };
}

function buildKnownReferenceSet(
  workflowContext: Workflow | null | undefined,
  contextNodes: DeepSeekContextNode[],
  nodes: AiNodeSpec[],
) {
  const references = new Set<string>();
  const addReference = (value?: string | null) => {
    if (!value) return;
    references.add(normalizeNodeReference(value));
  };

  workflowContext?.nodes.forEach((node) => {
    addReference(node.id);
    addReference(String(node.data.label));
  });
  contextNodes.forEach((node) => {
    addReference(node.id);
    addReference(node.label);
  });
  nodes.forEach((node) => {
    addReference(node.alias);
    addReference(node.label);
  });

  return references;
}

function hasKnownReference(references: Set<string>, value: string) {
  return references.has(normalizeNodeReference(value));
}

function sanitizeEdges(
  value: unknown,
  references: Set<string>,
): AiWorkflowEdge[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const edges: AiWorkflowEdge[] = [];

  value.forEach((entry) => {
    if (!isRecord(entry)) return;
    const source = sanitizeText(entry.source);
    const target = sanitizeText(entry.target);
    if (
      !source ||
      !target ||
      normalizeNodeReference(source) === normalizeNodeReference(target)
    ) {
      return;
    }
    if (
      !hasKnownReference(references, source) ||
      !hasKnownReference(references, target)
    )
      return;

    const sourceHandle = sanitizeText(entry.sourceHandle);
    const targetHandle = sanitizeText(entry.targetHandle);
    const dedupeKey = [
      normalizeNodeReference(source),
      sourceHandle,
      normalizeNodeReference(target),
      targetHandle,
    ].join("|");
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    edges.push({
      source,
      target,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
    });
  });

  return edges;
}

function sanitizeCommands(
  value: unknown,
  references: Set<string>,
): NodeCommand[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const commands = value.reduce<NodeCommand[]>((accumulator, entry) => {
    if (
      !isRecord(entry) ||
      !VALID_COMMANDS.has(entry.command as NodeCommand["command"])
    ) {
      return accumulator;
    }

    const command = entry.command as NodeCommand["command"];
    if (command === "create_edge") {
      const source = sanitizeText(entry.source);
      const target = sanitizeText(entry.target);
      if (
        !source ||
        !target ||
        !hasKnownReference(references, source) ||
        !hasKnownReference(references, target)
      ) {
        return accumulator;
      }
      const sourceHandle = sanitizeText(entry.sourceHandle);
      const targetHandle = sanitizeText(entry.targetHandle);
      accumulator.push({
        command,
        source,
        target,
        ...(sourceHandle ? { sourceHandle } : {}),
        ...(targetHandle ? { targetHandle } : {}),
      });
      return accumulator;
    }

    const nodeId = sanitizeText(entry.nodeId);
    if (!nodeId || !hasKnownReference(references, nodeId)) return accumulator;

    if (command === "delete_node") {
      accumulator.push({ command, nodeId });
      return accumulator;
    }

    const data = sanitizeConfig(entry.data);
    if (!data) return accumulator;
    accumulator.push({ command, nodeId, data });
    return accumulator;
  }, []);

  return commands.length ? commands : undefined;
}

function sanitizeGenerativeUi(
  value: unknown,
): GenerativeComponent[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const ui = value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      !VALID_UI_COMPONENTS.has(
        entry.component as GenerativeComponent["component"],
      )
    ) {
      return [];
    }
    const props = sanitizeConfig(entry.props);
    return [
      {
        component: entry.component as GenerativeComponent["component"],
        props: props ?? {},
      } satisfies GenerativeComponent,
    ];
  });

  return ui.length ? ui : undefined;
}

function getParameterValue(
  parameters: Record<string, unknown> | undefined,
  ...names: string[]
) {
  if (!parameters) return "";
  const normalizedLookup = new Map(
    Object.entries(parameters).map(([key, value]) => [
      normalizeNodeReference(key),
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? String(value)
        : "",
    ]),
  );

  for (const name of names) {
    const value = normalizedLookup.get(normalizeNodeReference(name));
    if (value?.trim()) return value.trim();
  }

  return "";
}

function setParameterValue(node: AiNodeSpec, key: string, value: string) {
  if (!value.trim()) return;
  node.parameters = {
    ...(node.parameters ?? {}),
    [key]: value,
  };
}

function buildNodeSpecReferenceMap(nodes: AiNodeSpec[]) {
  const references = new Map<string, AiNodeSpec>();
  const add = (reference: string | undefined, node: AiNodeSpec) => {
    if (!reference) return;
    references.set(normalizeNodeReference(reference), node);
  };

  nodes.forEach((node) => {
    add(node.alias, node);
    add(node.label, node);
  });

  return references;
}

function buildIncomingNodes(nodes: AiNodeSpec[], edges: AiWorkflowEdge[]) {
  const referenceMap = buildNodeSpecReferenceMap(nodes);
  const incoming = new Map<string, AiNodeSpec[]>();

  edges.forEach((edge) => {
    const sourceNode = referenceMap.get(normalizeNodeReference(edge.source));
    const targetNode = referenceMap.get(normalizeNodeReference(edge.target));
    if (!sourceNode || !targetNode?.alias) return;

    const current = incoming.get(targetNode.alias) ?? [];
    if (!current.some((node) => node.alias === sourceNode.alias)) {
      current.push(sourceNode);
      incoming.set(targetNode.alias, current);
    }
  });

  return incoming;
}

function stripStorePrefix(label: string) {
  return label.replace(/^store\s*:\s*/i, "").trim();
}

function deriveAiStoreName(node: AiNodeSpec, upstreamNodes: AiNodeSpec[]) {
  const directTrigger = upstreamNodes.find((upstreamNode) =>
    upstreamNode.nodeType.startsWith("trigger_"),
  );
  const triggerTag = directTrigger
    ? getParameterValue(directTrigger.parameters, "Tag Value", "variant tag")
    : "";

  if (triggerTag) {
    return `ab_${slugifyReference(triggerTag)}`;
  }

  const labelSeed =
    stripStorePrefix(node.label ?? "") ||
    stripStorePrefix(upstreamNodes[0]?.label ?? "") ||
    "store_data";

  const slug = slugifyReference(labelSeed);
  return slug === "store" ? "store_data" : slug;
}

function repairNodeSemantics(response: AIResponse) {
  if (!response.nodes?.length) return response;

  const incoming = buildIncomingNodes(response.nodes, response.edges ?? []);

  response.nodes.forEach((node) => {
    const upstreamNodes = incoming.get(node.alias ?? "") ?? [];

    if (node.nodeType === "action_switch") {
      const tagValues = upstreamNodes
        .map((upstreamNode) =>
          getParameterValue(
            upstreamNode.parameters,
            "Tag Value",
            "variant tag",
          ),
        )
        .filter(Boolean);

      tagValues.slice(0, 4).forEach((tagValue, index) => {
        const field = `Case ${index + 1}`;
        if (!getParameterValue(node.parameters, field)) {
          setParameterValue(node, field, tagValue);
        }
      });
    }

    if (node.nodeType === "analytics_ab") {
      const storeNames = upstreamNodes
        .filter((upstreamNode) => upstreamNode.nodeType === "analytics_store")
        .map((upstreamNode) =>
          getParameterValue(upstreamNode.parameters, "Store Name"),
        )
        .filter(Boolean);

      if (
        storeNames.length &&
        !getParameterValue(node.parameters, "Store Names")
      ) {
        setParameterValue(node, "Store Names", storeNames.join(","));
      }
    }

    if (
      node.nodeType === "analytics_store" &&
      !getParameterValue(node.parameters, "Store Name")
    ) {
      setParameterValue(
        node,
        "Store Name",
        deriveAiStoreName(node, upstreamNodes),
      );
    }

    if (node.nodeType === "analytics_compare") {
      const sourceLabels = upstreamNodes
        .map((upstreamNode) => {
          if (upstreamNode.nodeType === "analytics_store") {
            return stripStorePrefix(upstreamNode.label ?? "");
          }
          return upstreamNode.label ?? "";
        })
        .filter(Boolean);

      if (
        sourceLabels[0] &&
        !getParameterValue(node.parameters, "Input A Label")
      ) {
        setParameterValue(node, "Input A Label", sourceLabels[0]);
      }
      if (
        sourceLabels[1] &&
        !getParameterValue(node.parameters, "Input B Label")
      ) {
        setParameterValue(node, "Input B Label", sourceLabels[1]);
      }
    }
  });

  return response;
}

function sanitizeAiResponse(
  response: AIResponse,
  workflowContext: Workflow | null | undefined,
  contextNodes: DeepSeekContextNode[],
) {
  const action = VALID_AI_ACTIONS.has(response.action)
    ? response.action
    : "chat";
  const nodes = sanitizeNodes(response.nodes);
  const references = buildKnownReferenceSet(
    workflowContext,
    contextNodes,
    nodes,
  );
  const edges = sanitizeEdges(response.edges, references);
  const commands = sanitizeCommands(response.commands, references);
  const ui = sanitizeGenerativeUi(response.ui);

  return applySmartLayout(
    repairNodeSemantics({
      action,
      message: sanitizeText(response.message) || "Fluxo planejado.",
      ...(nodes.length ? { nodes } : {}),
      ...(edges.length ? { edges } : {}),
      ...(commands?.length ? { commands } : {}),
      ...(ui?.length ? { ui } : {}),
    }),
    workflowContext,
  );
}

function splitCsvValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getEffectiveEdges(response: AIResponse) {
  const edges = [...(response.edges ?? [])];
  response.commands?.forEach((command) => {
    if (command.command !== "create_edge" || !command.source || !command.target)
      return;
    edges.push({
      source: command.source,
      target: command.target,
      ...(command.sourceHandle ? { sourceHandle: command.sourceHandle } : {}),
      ...(command.targetHandle ? { targetHandle: command.targetHandle } : {}),
    });
  });
  return edges;
}

function isLogIntent(userMessage: string) {
  const normalized = normalizeIntentText(userMessage);
  return (
    normalized.includes("observabilidade") ||
    normalized.includes("observability") ||
    normalized.includes("logs") ||
    normalized.includes("erros") ||
    normalized.includes("errors") ||
    normalized.includes("backend") ||
    normalized.includes("frontend")
  );
}

function isExperimentIntent(userMessage: string) {
  const normalized = normalizeIntentText(userMessage);
  return (
    normalized.includes("a/b") ||
    normalized.includes("ab test") ||
    normalized.includes("teste a/b") ||
    normalized.includes("teste ab") ||
    normalized.includes("experiment") ||
    normalized.includes("experimento") ||
    normalized.includes("multivari")
  );
}

function buildValidationNodeMap(
  workflowContext: Workflow | null | undefined,
  contextNodes: DeepSeekContextNode[],
  responseNodes: AiNodeSpec[] | undefined,
) {
  const lookup = new Map<string, ValidationNode>();
  const addNode = (
    reference: string | undefined,
    node: Omit<ValidationNode, "ref">,
  ) => {
    if (!reference) return;
    lookup.set(normalizeNodeReference(reference), {
      ref: reference,
      ...node,
    });
  };

  workflowContext?.nodes.forEach((node) => {
    const payload = {
      label: node.data.label,
      nodeType: node.data.nodeType,
      parameters: node.data.parameters,
    } satisfies Omit<ValidationNode, "ref">;
    addNode(node.id, payload);
    addNode(node.data.label, payload);
  });

  contextNodes.forEach((node) => {
    const payload = {
      label: node.label,
      nodeType: node.nodeType,
      parameters: node.parameters,
    } satisfies Omit<ValidationNode, "ref">;
    addNode(node.id, payload);
    addNode(node.label, payload);
  });

  responseNodes?.forEach((node) => {
    const payload = {
      label: node.label ?? node.alias ?? node.nodeType,
      nodeType: node.nodeType,
      parameters: node.parameters,
    } satisfies Omit<ValidationNode, "ref">;
    addNode(node.alias, payload);
    addNode(node.label, payload);
  });

  return lookup;
}

function buildIncomingValidationNodes(
  nodeLookup: Map<string, ValidationNode>,
  edges: AiWorkflowEdge[],
) {
  const incoming = new Map<string, ValidationNode[]>();

  edges.forEach((edge) => {
    const sourceNode = nodeLookup.get(normalizeNodeReference(edge.source));
    const targetNode = nodeLookup.get(normalizeNodeReference(edge.target));
    if (!sourceNode || !targetNode) return;

    const targetKey = normalizeNodeReference(edge.target);
    const current = incoming.get(targetKey) ?? [];
    if (
      !current.some(
        (node) =>
          normalizeNodeReference(node.ref) ===
          normalizeNodeReference(sourceNode.ref),
      )
    ) {
      current.push(sourceNode);
      incoming.set(targetKey, current);
    }
  });

  return incoming;
}

function buildValidationIssues(
  userMessage: string,
  response: AIResponse,
  workflowContext: Workflow | null | undefined,
  contextNodes: DeepSeekContextNode[],
) {
  const issues: ValidationIssue[] = [];
  const nodes = response.nodes ?? [];
  const edges = getEffectiveEdges(response);
  const nodeLookup = buildValidationNodeMap(
    workflowContext,
    contextNodes,
    nodes,
  );
  const incoming = buildIncomingValidationNodes(nodeLookup, edges);
  const logsIntent = isLogIntent(userMessage);
  const experimentIntent = isExperimentIntent(userMessage);

  if (
    (response.action === "create_nodes" || response.action === "modify") &&
    nodes.length > 1 &&
    edges.length === 0
  ) {
    issues.push({
      severity: "error",
      code: "missing_edges",
      message:
        "The plan creates multiple nodes without connecting them with edges.",
    });
  }

  nodes.forEach((node) => {
    const nodeKey = normalizeNodeReference(
      node.alias ?? node.label ?? node.nodeType,
    );
    const upstreamNodes = incoming.get(nodeKey) ?? [];

    if (node.nodeType.startsWith("trigger_") && upstreamNodes.length > 0) {
      issues.push({
        severity: "error",
        code: "trigger_has_upstream",
        message: `${node.label ?? node.nodeType} is a trigger and should not receive upstream nodes.`,
      });
    }

    if (
      node.nodeType === "analytics_store" &&
      !getParameterValue(node.parameters, "Store Name")
    ) {
      issues.push({
        severity: "error",
        code: "store_without_name",
        message: `${node.label ?? node.nodeType} is missing Store Name.`,
      });
    }

    if (node.nodeType === "action_if") {
      const hasEnough =
        Boolean(getParameterValue(node.parameters, "Value 1")) &&
        Boolean(getParameterValue(node.parameters, "Operation")) &&
        Boolean(getParameterValue(node.parameters, "Value 2"));
      if (!hasEnough) {
        issues.push({
          severity: "error",
          code: "if_incomplete",
          message: `${node.label ?? node.nodeType} is missing Value 1, Operation, or Value 2.`,
        });
      }
    }

    if (node.nodeType === "action_switch") {
      const upstreamTags = uniq(
        upstreamNodes
          .map((upstreamNode) =>
            getParameterValue(upstreamNode.parameters, "Tag Value"),
          )
          .filter(Boolean),
      );
      const caseValues = uniq(
        [1, 2, 3, 4]
          .map((index) => getParameterValue(node.parameters, `Case ${index}`))
          .filter(Boolean),
      );

      if (
        upstreamTags.length &&
        !upstreamTags.every((tag) => caseValues.includes(tag))
      ) {
        issues.push({
          severity: "error",
          code: "switch_missing_cases",
          message: `${node.label ?? node.nodeType} does not cover all upstream tag values in its cases.`,
        });
      }
    }

    if (node.nodeType === "analytics_ab") {
      const parameterStores = splitCsvValues(
        getParameterValue(node.parameters, "Store Names"),
      );
      const upstreamStores = upstreamNodes
        .filter((upstreamNode) => upstreamNode.nodeType === "analytics_store")
        .map((upstreamNode) =>
          getParameterValue(upstreamNode.parameters, "Store Name"),
        )
        .filter(Boolean);
      const activeStores = uniq([...parameterStores, ...upstreamStores]);

      if (activeStores.length < 2) {
        issues.push({
          severity: "error",
          code: "ab_needs_two_variants",
          message: `${node.label ?? node.nodeType} needs at least two active variant stores.`,
        });
      }
    }

    if (node.nodeType === "analytics_compare") {
      const parameterLabels = uniq(
        [
          getParameterValue(node.parameters, "Input A Label"),
          getParameterValue(node.parameters, "Input B Label"),
        ].filter(Boolean),
      );
      const upstreamSources = uniq(
        upstreamNodes
          .map((upstreamNode) => {
            if (upstreamNode.nodeType === "analytics_store") {
              return stripStorePrefix(upstreamNode.label);
            }
            return upstreamNode.label;
          })
          .filter(Boolean),
      );
      const activeSources = uniq([...parameterLabels, ...upstreamSources]);

      if (activeSources.length < 2) {
        issues.push({
          severity: "error",
          code: "compare_needs_two_sources",
          message: `${node.label ?? node.nodeType} needs at least two active sources to compare.`,
        });
      }
    }

    if (
      (node.nodeType === "viz_metric" ||
        node.nodeType === "viz_chart" ||
        node.nodeType === "viz_report" ||
        node.nodeType === "viz_table" ||
        node.nodeType === "viz_funnel") &&
      upstreamNodes.length === 0
    ) {
      issues.push({
        severity: "warning",
        code: "viz_without_upstream",
        message: `${node.label ?? node.nodeType} has no upstream data source.`,
      });
    }

    if (node.nodeType === "monitor_alert") {
      const field = getParameterValue(node.parameters, "Field");
      if (!field && upstreamNodes.length === 0) {
        issues.push({
          severity: "warning",
          code: "alert_without_field",
          message: `${node.label ?? node.nodeType} has no explicit field and no upstream metric source.`,
        });
      }
    }
  });

  if (logsIntent && nodes.some((node) => node.nodeType === "analytics_ab")) {
    issues.push({
      severity: "error",
      code: "logs_using_ab",
      message:
        "Log/observability workflows should not use analytics_ab or experiment semantics.",
    });
  }

  if (
    logsIntent &&
    nodes.some((node) =>
      normalizeIntentText(node.label ?? "").match(/winner|variant|conversion/),
    )
  ) {
    issues.push({
      severity: "warning",
      code: "logs_with_experiment_labels",
      message:
        "Log/observability workflows still contain experiment-oriented labels like winner, variant, or conversion.",
    });
  }

  if (
    experimentIntent &&
    nodes.some((node) => node.nodeType === "analytics_compare") &&
    !nodes.some((node) => node.nodeType === "analytics_ab")
  ) {
    issues.push({
      severity: "warning",
      code: "experiment_without_ab_analyzer",
      message:
        "Experiment workflow uses generic comparison without analytics_ab winner semantics.",
    });
  }

  return issues.slice(0, 12);
}

function formatValidationIssues(issues: ValidationIssue[]) {
  if (!issues.length) return "[Validation findings]\n- none";
  return `[Validation findings]\n${issues
    .map(
      (issue, index) =>
        `${index + 1}. [${issue.severity}] ${issue.code}: ${issue.message}`,
    )
    .join("\n")}`;
}

async function requestDeepSeekJson(
  apiKey: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  onChunk?: (chunk: string) => void,
) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      stream: Boolean(onChunk),
      max_tokens: 2200,
      temperature: onChunk ? 0.6 : 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek retornou ${response.status}.`);
  }

  if (!onChunk) {
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Nao foi possivel abrir o stream da resposta.");
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let streamedMessage = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));
    for (const line of lines) {
      const payload = line.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          fullText += delta;
          const partialMessage = extractJsonStringField(
            fullText,
            "message",
            true,
          );
          if (
            partialMessage &&
            partialMessage.length > streamedMessage.length
          ) {
            const nextChunk = partialMessage.slice(streamedMessage.length);
            streamedMessage = partialMessage;
            onChunk(nextChunk);
          }
        }
      } catch {
        continue;
      }
    }
  }

  return fullText;
}

async function runCriticPass(
  apiKey: string,
  userMessage: string,
  workflowContext: Workflow | null | undefined,
  contextNodes: DeepSeekContextNode[],
  candidate: AIResponse,
  issues: ValidationIssue[],
) {
  if (!issues.length) return candidate;

  const workflowPrefix = workflowContext
    ? `[Workflow JSON]\n${JSON.stringify(workflowContext, null, 2)}\n\n`
    : "";
  const contextPrefix = contextNodes.length
    ? `[Context nodes]\n${contextNodes
        .map(
          (node) =>
            `- ${node.label} (id: ${node.id}, nodeType: ${node.nodeType}, parameters: ${JSON.stringify(node.parameters ?? {})}, config: ${JSON.stringify(node.config ?? {})})`,
        )
        .join("\n")}\n\n`
    : "";
  const nodePlaybookPrefix = formatNodePlaybookForPrompt(
    userMessage,
    workflowContext,
    18,
  );
  const findings = formatValidationIssues(issues);

  const content = await requestDeepSeekJson(apiKey, [
    { role: "system", content: CRITIC_PROMPT },
    {
      role: "user",
      content: `${workflowPrefix}${contextPrefix}${nodePlaybookPrefix}\n\n${findings}\n\n[Original user request]\n${userMessage}\n\n[Candidate JSON]\n${JSON.stringify(candidate, null, 2)}`,
    },
  ]);

  return sanitizeAiResponse(
    parseMaybeJson(content),
    workflowContext,
    contextNodes,
  );
}

function decodeJsonStringFragment(value: string, allowPartial = false) {
  const candidate =
    allowPartial && value.endsWith("\\") ? value.slice(0, -1) : value;

  try {
    return JSON.parse(`"${candidate}"`) as string;
  } catch {
    return candidate
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

function extractJsonStringField(
  raw: string,
  field: string,
  allowPartial = false,
) {
  const fieldToken = `"${field}"`;
  const fieldIndex = raw.indexOf(fieldToken);
  if (fieldIndex === -1) return null;

  const colonIndex = raw.indexOf(":", fieldIndex + fieldToken.length);
  if (colonIndex === -1) return null;

  const firstQuoteIndex = raw.indexOf('"', colonIndex + 1);
  if (firstQuoteIndex === -1) return null;

  let value = "";
  let escaped = false;

  for (let index = firstQuoteIndex + 1; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      return decodeJsonStringFragment(value);
    }

    value += char;
  }

  return allowPartial ? decodeJsonStringFragment(value, true) : null;
}

function parseMaybeJson(value: string): AIResponse {
  const cleaned = normalizeRawJson(value);

  try {
    return JSON.parse(cleaned) as AIResponse;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(
          cleaned.slice(firstBrace, lastBrace + 1),
        ) as AIResponse;
      } catch {
        // continue to structured field extraction
      }
    }

    const action = extractJsonStringField(cleaned, "action");
    const message = extractJsonStringField(cleaned, "message");

    if (message) {
      return {
        action:
          action === "create_nodes" ||
          action === "show_analysis" ||
          action === "modify" ||
          action === "chat"
            ? action
            : "chat",
        message,
      };
    }

    return { action: "chat", message: cleaned };
  }
}

function buildAbTestTemplate(userMessage: string): AIResponse | null {
  const normalized = normalizeIntentText(userMessage);
  const mentionsExperiment =
    normalized.includes("a/b") ||
    normalized.includes("ab test") ||
    normalized.includes("teste a/b") ||
    normalized.includes("teste ab") ||
    normalized.includes("multivari");

  if (!mentionsExperiment) return null;

  const variantALabel = normalized.includes("onboard")
    ? "Variant A - Onboarding"
    : "Variant A - Control";
  const variantBLabel =
    normalized.includes("direto") && normalized.includes("compra")
      ? "Variant B - Direct Checkout"
      : "Variant B - Treatment";
  const variantCLabel = normalized.includes("agradec")
    ? "Variant C - Thank You First"
    : "Variant C - Challenger";

  return {
    action: "create_nodes",
    message:
      "Montei um teste multivariado com 3 triggers, um router central por variant, stores locais, analyzer, grafico de conversao, winner metric, winner report, validacao de vencedor e notificacoes.",
    nodes: [
      {
        alias: "trigger_a",
        nodeType: "trigger_webhook",
        label: variantALabel,
        description: "Recebe eventos da variante A.",
        parameters: {
          Path: "/ab/variant-a",
          "HTTP Method": "POST",
          "Tag Field": "variant",
          "Tag Value": "variant_a",
        },
        position: { x: 0, y: 260 },
      },
      {
        alias: "trigger_b",
        nodeType: "trigger_webhook",
        label: variantBLabel,
        description: "Recebe eventos da variante B.",
        parameters: {
          Path: "/ab/variant-b",
          "HTTP Method": "POST",
          "Tag Field": "variant",
          "Tag Value": "variant_b",
        },
        position: { x: -60, y: 400 },
      },
      {
        alias: "trigger_c",
        nodeType: "trigger_webhook",
        label: variantCLabel,
        description: "Recebe eventos da variante C.",
        parameters: {
          Path: "/ab/variant-c",
          "HTTP Method": "POST",
          "Tag Field": "variant",
          "Tag Value": "variant_c",
        },
        position: { x: -60, y: 560 },
      },
      {
        alias: "variant_router",
        nodeType: "action_switch",
        label: "Route Variant",
        description:
          "Recebe qualquer trigger e envia para a store correta pela tag da variante.",
        parameters: {
          Value: "{{ $json.variant }}",
          Operation: "equals",
          "Case 1": "variant_a",
          "Case 2": "variant_b",
          "Case 3": "variant_c",
        },
        position: { x: 340, y: 400 },
      },
      {
        alias: "store_a",
        nodeType: "analytics_store",
        label: "Store A",
        description: "Persistencia local da variante A.",
        parameters: {
          "Store Name": "ab_variant_a",
        },
        position: { x: 720, y: 240 },
      },
      {
        alias: "store_b",
        nodeType: "analytics_store",
        label: "Store B",
        description: "Persistencia local da variante B.",
        parameters: {
          "Store Name": "ab_variant_b",
        },
        position: { x: 720, y: 400 },
      },
      {
        alias: "store_c",
        nodeType: "analytics_store",
        label: "Store C",
        description: "Persistencia local da variante C.",
        parameters: {
          "Store Name": "ab_variant_c",
        },
        position: { x: 720, y: 560 },
      },
      {
        alias: "ab_analyzer",
        nodeType: "analytics_ab",
        label: "A/B Analyzer",
        description:
          "Calcula taxa de conversao, receita e vencedor entre as variantes.",
        parameters: {
          "Store Names": "ab_variant_a,ab_variant_b,ab_variant_c",
          "Variant Field": "variant",
          "Conversion Field": "converted",
          "Revenue Field": "amount",
          "Minimum Sample": "100",
        },
        position: { x: 1020, y: 400 },
      },
      {
        alias: "conversion_chart",
        nodeType: "viz_chart",
        label: "A/B/C Conversion Rate",
        description: "Grafico comparando conversao das tres variantes.",
        chartType: "bar",
        vizVariant: "conversion",
        config: {
          chartType: "bar",
          variant: "conversion",
          timeRange: "Last 30 days",
          xAxisLabel: "Variant",
          yAxisLabel: "Conversion %",
        },
        position: { x: 1360, y: 120 },
      },
      {
        alias: "winner_report",
        nodeType: "viz_report",
        label: "Variant Winner Report",
        description: "Resumo do teste e desempenho por variante.",
        config: {
          reportTitle: "Winner Report",
          refreshRate: "Every 1h",
          includeAiInsight: "Yes",
        },
        position: { x: 1360, y: 340 },
      },
      {
        alias: "winner_metric",
        nodeType: "viz_metric",
        label: "Winning Variant",
        description: "Mostra a variante que esta liderando.",
        vizVariant: "custom",
        position: { x: 1360, y: 720 },
      },
      {
        alias: "winner_found",
        nodeType: "action_if",
        label: "Winner Found?",
        description:
          "Valida se ja existe amostra suficiente para declarar vencedor.",
        parameters: {
          "Value 1": "{{ $json.winner }}",
          Operation: "not equals",
          "Value 2": "insufficient_sample",
        },
        position: { x: 1720, y: 460 },
      },
      {
        alias: "announce_winner",
        nodeType: "action_slack",
        label: "Announce Winner",
        description: "Envia a variante vencedora para o canal do time.",
        parameters: {
          Channel: "#growth",
          Message:
            "Winner {{ $json.winner }} with {{ $json.winningRate }}% conversion and {{ $json.winningConversions }}/{{ $json.winningUsers }} sales.",
        },
        position: { x: 2120, y: 320 },
      },
      {
        alias: "notify_team",
        nodeType: "action_email",
        label: "Notify Team",
        description: "Dispara email para o time com o resultado do teste.",
        parameters: {
          Subject: "A/B test winner detected",
          Message:
            "Winner {{ $json.winner }} with {{ $json.winningRate }}% conversion. Review the winner report in Flow Merge.",
        },
        position: { x: 2120, y: 540 },
      },
    ],
    edges: [
      { source: "trigger_a", target: "variant_router" },
      { source: "trigger_b", target: "variant_router" },
      { source: "trigger_c", target: "variant_router" },
      { source: "variant_router", target: "store_a", sourceHandle: "case_1" },
      { source: "variant_router", target: "store_b", sourceHandle: "case_2" },
      { source: "variant_router", target: "store_c", sourceHandle: "case_3" },
      { source: "store_a", target: "ab_analyzer" },
      { source: "store_b", target: "ab_analyzer" },
      { source: "store_c", target: "ab_analyzer" },
      { source: "ab_analyzer", target: "conversion_chart" },
      { source: "ab_analyzer", target: "winner_report" },
      { source: "ab_analyzer", target: "winner_metric" },
      { source: "ab_analyzer", target: "winner_found" },
      {
        source: "winner_found",
        target: "announce_winner",
        sourceHandle: "true",
      },
      { source: "winner_found", target: "notify_team", sourceHandle: "true" },
    ],
  };
}

function buildLogObservabilityTemplate(userMessage: string): AIResponse | null {
  const normalized = normalizeIntentText(userMessage);
  const mentionsLogs =
    normalized.includes("observabilidade") ||
    normalized.includes("logs") ||
    normalized.includes("erro") ||
    normalized.includes("error");
  const mentionsFrontend = normalized.includes("front");
  const mentionsBackend = normalized.includes("back");

  if (!mentionsLogs || (!mentionsFrontend && !mentionsBackend)) return null;

  const sourceNodes: AiNodeSpec[] = [];
  const sourceEdges: AiWorkflowEdge[] = [];
  const sourceMetricNodes: AiNodeSpec[] = [];

  const sources = [
    mentionsFrontend
      ? {
          alias: "frontend_trigger",
          label: "Frontend Logs",
          description: "Recebe logs de erro do frontend.",
          path: "/webhook/logs/frontend",
          storeAlias: "frontend_store",
          storeLabel: "Store: Frontend Logs",
          storeName: "obs_frontend_logs",
          sourceKey: "frontend_logs",
          metricAlias: "frontend_errors_metric",
          metricLabel: "Erros Frontend",
          triggerY: 140,
          storeY: 140,
          metricY: 80,
        }
      : null,
    mentionsBackend
      ? {
          alias: "backend_trigger",
          label: "Backend Logs",
          description: "Recebe logs de erro do backend.",
          path: "/webhook/logs/backend",
          storeAlias: "backend_store",
          storeLabel: "Store: Backend Logs",
          storeName: "obs_backend_logs",
          sourceKey: "backend_logs",
          metricAlias: "backend_errors_metric",
          metricLabel: "Erros Backend",
          triggerY: 320,
          storeY: 320,
          metricY: 300,
        }
      : null,
  ].filter(Boolean) as Array<{
    alias: string;
    label: string;
    description: string;
    path: string;
    storeAlias: string;
    storeLabel: string;
    storeName: string;
    sourceKey: string;
    metricAlias: string;
    metricLabel: string;
    triggerY: number;
    storeY: number;
    metricY: number;
  }>;

  sources.forEach((source) => {
    sourceNodes.push(
      {
        alias: source.alias,
        nodeType: "trigger_webhook",
        label: source.label,
        description: `${source.description} Aceita payload JSON com dados de erro e contexto.`,
        parameters: {
          Path: source.path,
          "HTTP Method": "POST",
          "Tag Field": "sourceArea",
          "Tag Value": source.sourceKey,
        },
        position: { x: 80, y: source.triggerY },
      },
      {
        alias: source.storeAlias,
        nodeType: "analytics_store",
        label: source.storeLabel,
        description: `Armazena os eventos de ${source.label.toLowerCase()} para comparação.`,
        parameters: {
          "Store Name": source.storeName,
        },
        position: { x: 520, y: source.storeY },
      },
    );

    sourceEdges.push(
      { source: source.alias, target: source.storeAlias },
      { source: source.storeAlias, target: "compare_logs" },
    );

    sourceMetricNodes.push({
      alias: source.metricAlias,
      nodeType: "viz_metric",
      label: source.metricLabel,
      description: `Mostra o volume de erros de ${source.label.toLowerCase()}.`,
      vizVariant: "errors",
      config: {
        variant: "errors",
        comparisonMetricMode: "source",
        comparisonSourceKey: source.sourceKey,
      },
      position: { x: 1380, y: source.metricY },
    });
  });

  return {
    action: "create_nodes",
    message:
      "Montei um fluxo de observabilidade com fontes separadas por origem, stores por origem, comparador semântico, métricas de erro por fonte, gráfico consolidado, relatório e alerta.",
    nodes: [
      ...sourceNodes,
      {
        alias: "compare_logs",
        nodeType: "analytics_compare",
        label: "Comparar Logs",
        description:
          "Compara volume e participação de erros entre as fontes ativas.",
        parameters: {
          "Input A Label": sources[0]?.label ?? "Source A",
          "Input B Label": sources[1]?.label ?? "Source B",
          Metric: "Error Logs",
        },
        position: { x: 920, y: 220 },
      },
      ...sourceMetricNodes,
      {
        alias: "total_errors_metric",
        nodeType: "viz_metric",
        label: "Erros Totais",
        description:
          "Mostra o volume total de erros entre todas as fontes ativas.",
        vizVariant: "errors",
        config: {
          variant: "errors",
          comparisonMetricMode: "total",
        },
        position: { x: 1380, y: 520 },
      },
      {
        alias: "error_comparison_chart",
        nodeType: "viz_chart",
        label: "Erro por Fonte",
        description: "Gráfico comparando o volume de erros por origem.",
        chartType: "bar",
        vizVariant: "errors",
        config: {
          variant: "errors",
          chartType: "bar",
          timeRange: "Last 24 hours",
          xAxisLabel: "Source",
          yAxisLabel: "Error Logs",
        },
        position: { x: 1760, y: 80 },
      },
      {
        alias: "error_report",
        nodeType: "viz_report",
        label: "Relatório de Erros",
        description:
          "Resume a fonte mais ruidosa, total de erros e participação por origem.",
        config: {
          reportTitle: "Error Source Report",
          refreshRate: "Every 5m",
          includeAiInsight: "Yes",
        },
        position: { x: 1760, y: 420 },
      },
      {
        alias: "error_alert",
        nodeType: "monitor_alert",
        label: "Alerta: Pico de Erros",
        description:
          "Dispara alerta quando o volume total de erros passa do limite.",
        parameters: {
          Threshold: "100",
          Field: "{{ input.first.total }}",
          Channel: "Slack",
        },
        position: { x: 1380, y: 700 },
      },
    ],
    edges: [
      ...sourceEdges,
      ...sourceMetricNodes.map((metricNode) => ({
        source: "compare_logs",
        target: metricNode.alias ?? "",
      })),
      { source: "compare_logs", target: "total_errors_metric" },
      { source: "compare_logs", target: "error_comparison_chart" },
      { source: "compare_logs", target: "error_report" },
      { source: "compare_logs", target: "error_alert" },
    ].filter((edge) => edge.target),
  };
}

function buildTemplateReferenceExamples(userMessage: string) {
  const examples = [
    buildAbTestTemplate(userMessage),
    buildLogObservabilityTemplate(userMessage),
  ].filter(Boolean) as AIResponse[];

  if (!examples.length) return "";

  return `[Reference JSON examples]\n${examples
    .map(
      (example, index) =>
        `Example ${index + 1}:\n${JSON.stringify(example, null, 2)}`,
    )
    .join("\n\n")}\n\n`;
}

export async function streamDeepSeek(
  apiKey: string,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  contextNodes: DeepSeekContextNode[],
  workflowContext: Workflow | null | undefined,
  onChunk: (chunk: string) => void,
  onDone: (response: AIResponse) => void,
  onError: (error: string) => void,
) {
  if (!apiKey) {
    onError(
      "DeepSeek API key nao configurada. Abra Settings no header e adicione a chave.",
    );
    return;
  }

  const contextPrefix = contextNodes.length
    ? `[Context nodes]\n${contextNodes
        .map(
          (node) =>
            `- ${node.label} (id: ${node.id}, nodeType: ${node.nodeType}, parameters: ${JSON.stringify(node.parameters ?? {})}, config: ${JSON.stringify(node.config ?? {})})`,
        )
        .join("\n")}\n\n`
    : "";
  const workflowPrefix = workflowContext
    ? `[Workflow JSON]\n${JSON.stringify(workflowContext, null, 2)}\n\n`
    : "";
  const nodePlaybookPrefix = formatNodePlaybookForPrompt(
    userMessage,
    workflowContext,
  );
  const referenceExamplesPrefix = formatRelevantWorkflowExamples(userMessage);
  const referenceJsonExamplesPrefix =
    buildTemplateReferenceExamples(userMessage);

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-8),
    {
      role: "user",
      content: `${workflowPrefix}${contextPrefix}${nodePlaybookPrefix}\n\n${referenceExamplesPrefix}${referenceJsonExamplesPrefix}${userMessage}`,
    },
  ];

  try {
    const fullText = await requestDeepSeekJson(apiKey, messages, onChunk);
    const initialResponse = sanitizeAiResponse(
      parseMaybeJson(fullText),
      workflowContext,
      contextNodes,
    );
    const initialIssues = buildValidationIssues(
      userMessage,
      initialResponse,
      workflowContext,
      contextNodes,
    );

    let finalResponse = initialResponse;
    if (initialIssues.length) {
      const repairedResponse = await runCriticPass(
        apiKey,
        userMessage,
        workflowContext,
        contextNodes,
        initialResponse,
        initialIssues,
      );
      const repairedIssues = buildValidationIssues(
        userMessage,
        repairedResponse,
        workflowContext,
        contextNodes,
      );

      if (repairedIssues.length <= initialIssues.length) {
        finalResponse = repairedResponse;
      }
    }

    onDone(finalResponse);
  } catch (error) {
    onError(
      error instanceof Error
        ? error.message
        : "Erro de rede ao chamar DeepSeek.",
    );
  }
}
