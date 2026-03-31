import type {
  AppNode,
  JSONSchema,
  JSONSchemaProperty,
  NodeProgrammingConfig,
  Workflow,
  WorkflowNodeData,
} from "@/lib/flow-types";
import type { NodeTypeId } from "@/lib/node-catalog";
import type {
  RuntimeArtifact,
  RuntimeEnvelope,
  RuntimeEvaluationContext,
  RuntimeWebhookResponse,
} from "@/lib/runtime-types";
import { assertSafeUserCode } from "@/lib/code-safety";
import { expandSemanticPreview } from "@/lib/data-semantics";
import { getActiveIncomingNodes } from "@/lib/workflow-intelligence";

export interface EditorCompletionItem {
  label: string;
  insertText: string;
  detail: string;
  documentation?: string;
  kind?: "variable" | "function" | "snippet";
}

export interface NodeProgrammingContextInfo {
  inputSchema?: JSONSchema;
  inputPreview?: unknown;
  javascriptCompletions: EditorCompletionItem[];
  jsonCompletions: EditorCompletionItem[];
}

interface ProgramHelpers {
  now: () => string;
  toNumber: (value: unknown) => number;
  toBoolean: (value: unknown) => boolean;
  compare: (left: unknown, operation: string, right: unknown) => boolean;
  sum: (items: Array<Record<string, unknown>>, field: string) => number;
  avg: (items: Array<Record<string, unknown>>, field: string) => number;
  min: (items: Array<Record<string, unknown>>, field: string) => number;
  max: (items: Array<Record<string, unknown>>, field: string) => number;
  groupBy: (
    items: Array<Record<string, unknown>>,
    field: string,
  ) => Record<string, Array<Record<string, unknown>>>;
  pick: (target: Record<string, unknown>, path: string) => unknown;
}

interface ProgramScope {
  input: {
    first: Record<string, unknown> | null;
    items: Array<Record<string, unknown>>;
    count: number;
    meta: Record<string, unknown>;
    schema?: JSONSchema;
  };
  params: Record<string, string>;
  config: Record<string, unknown>;
  node: {
    id: string;
    label: string;
    nodeType: NodeTypeId;
  };
  env: {
    projectId: string;
    workflowId: string;
    source: string;
    trigger?: unknown;
  };
  store: RuntimeEvaluationContext["store"]["collections"];
  helpers: ProgramHelpers;
}

export interface ProgrammableExecutionResult {
  outputs?: Record<string, Array<Record<string, unknown>>>;
  summary?: string;
  patch?: Partial<WorkflowNodeData>;
  response?: RuntimeWebhookResponse;
  artifacts?: RuntimeArtifact[];
  meta?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeWebhookResponse(value: unknown): value is RuntimeWebhookResponse {
  return (
    isRecord(value) &&
    typeof value.status === "number" &&
    typeof value.body === "string"
  );
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getValueAtPath(target: unknown, path: string): unknown {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  let cursor = target;

  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }
  return false;
}

function compareValues(actual: unknown, operation: string, expected: unknown) {
  const normalizedOperation = operation.trim().toLowerCase() || "equals";
  const leftNumber = toNumber(actual);
  const rightNumber = toNumber(expected);
  const leftString = String(actual ?? "").toLowerCase();
  const rightString = String(expected ?? "").toLowerCase();

  switch (normalizedOperation) {
    case "equals":
    case "=":
      return leftString === rightString;
    case "not equals":
    case "!=":
      return leftString !== rightString;
    case "greater than":
    case ">":
      return leftNumber > rightNumber;
    case "greater or equal":
    case ">=":
      return leftNumber >= rightNumber;
    case "less than":
    case "<":
      return leftNumber < rightNumber;
    case "less or equal":
    case "<=":
      return leftNumber <= rightNumber;
    case "contains":
      return leftString.includes(rightString);
    default:
      return leftString === rightString;
  }
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      isRecord(entry) ? deepClone(entry) : { value: deepClone(entry) },
    );
  }

  if (isRecord(value)) {
    return [deepClone(value)];
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [{ value: deepClone(value) }];
}

function mergeSchemaProperty(
  target: JSONSchemaProperty | undefined,
  source: JSONSchemaProperty,
): JSONSchemaProperty {
  const next: JSONSchemaProperty = {
    ...(target ?? {}),
    ...source,
    type: source.type || target?.type || "string",
  };

  if (target?.properties || source.properties) {
    const merged: Record<string, JSONSchemaProperty> = {};
    Object.entries(target?.properties ?? {}).forEach(([key, property]) => {
      merged[key] = property;
    });
    Object.entries(source.properties ?? {}).forEach(([key, property]) => {
      merged[key] = mergeSchemaProperty(merged[key], property);
    });
    next.properties = merged;
  }

  if (target?.items || source.items) {
    next.items = mergeSchemaProperty(target?.items, source.items ?? { type: "object" });
  }

  return next;
}

function mergeJsonSchemas(schemas: Array<JSONSchema | undefined>) {
  const merged: JSONSchema = { type: "object", properties: {} };

  schemas.filter(Boolean).forEach((schema) => {
    Object.entries(schema?.properties ?? {}).forEach(([key, property]) => {
      merged.properties![key] = mergeSchemaProperty(merged.properties?.[key], property);
    });
  });

  return Object.keys(merged.properties ?? {}).length ? merged : undefined;
}

function schemaFromPreview(value: unknown): JSONSchemaProperty {
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: schemaFromPreview(value[0] ?? {}),
    };
  }

  if (isRecord(value)) {
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, schemaFromPreview(item)]),
      ),
    };
  }

  if (typeof value === "number") return { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

function toOutputSchemaFromPreview(value: unknown): JSONSchema | undefined {
  const property = schemaFromPreview(value);
  if (property.type !== "object" || !property.properties) return undefined;

  return {
    type: "object",
    properties: property.properties,
  };
}

function setSchemaPropertyAtPath(
  schema: JSONSchema,
  path: string,
  property: JSONSchemaProperty,
) {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) return schema;

  let cursor = schema;
  segments.forEach((segment, index) => {
    cursor.properties ??= {};

    if (index === segments.length - 1) {
      cursor.properties[segment] = mergeSchemaProperty(cursor.properties[segment], property);
      return;
    }

    const current = cursor.properties[segment];
    if (!current || current.type !== "object" || !current.properties) {
      cursor.properties[segment] = {
        type: "object",
        properties: {},
      };
    }

    cursor = {
      type: "object",
      properties: cursor.properties[segment].properties,
    };
  });

  return schema;
}

function getNodeParameter(node: AppNode, label: string) {
  const parameters = node.data.parameters ?? {};
  const match = Object.entries(parameters).find(
    ([key]) => key.trim().toLowerCase() === label.trim().toLowerCase(),
  );
  const value = match?.[1];

  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

const passthroughNodeTypes = new Set<NodeTypeId>([
  "action_set",
  "action_filter",
  "action_if",
  "action_switch",
  "action_merge",
  "action_split",
  "action_wait",
  "action_respond",
  "analytics_store",
]);

const analyticsCompareOutputSchema: JSONSchema = {
  type: "object",
  properties: {
    metric: { type: "string", description: "Comparison metric label" },
    total: { type: "number", description: "Total value across active sources" },
    delta: { type: "number", description: "Difference between top sources" },
    sourceCount: { type: "number", description: "How many sources are active" },
    leader: { type: "string", description: "Label of the current leading source" },
    leaderValue: { type: "number", description: "Value of the current leading source" },
    sources: {
      type: "array",
      description: "Active sources included in this comparison",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "Stable source identifier" },
          label: { type: "string", description: "Display label for the source" },
          storeName: { type: "string", description: "Runtime store backing this source" },
          value: { type: "number", description: "Calculated metric for this source" },
          count: { type: "number", description: "How many records fed this source" },
          share: { type: "number", description: "Share of total represented by this source" },
        },
      },
    },
  },
};

const analyticsAbOutputSchema: JSONSchema = {
  type: "object",
  properties: {
    winner: { type: "string", description: "Winning variant or insufficient_sample" },
    winningRate: { type: "number", description: "Winning conversion rate" },
    winningUsers: { type: "number", description: "Users in the winning variant" },
    winningConversions: {
      type: "number",
      description: "Conversions in the winning variant",
    },
    totalRevenue: { type: "number", description: "Revenue across all active variants" },
    variants: {
      type: "array",
      description: "Summary per active variant",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Variant label" },
          users: { type: "number", description: "Users in this variant" },
          conversions: { type: "number", description: "Conversions in this variant" },
          conversionRate: { type: "number", description: "Conversion rate percentage" },
          revenue: { type: "number", description: "Revenue captured by this variant" },
        },
      },
    },
  },
};

function getNodeSpecificOutputSchema(workflow: Workflow, node: AppNode, visited: Set<string>) {
  if (node.data.nodeType.startsWith("trigger_")) {
    const base = deepClone(node.data.schema?.output ?? { type: "object", properties: {} });
    const tagField = getNodeParameter(node, "Tag Field");
    if (tagField) {
      setSchemaPropertyAtPath(base, tagField, {
        type: "string",
        description: "Static tag injected by this trigger",
      });
    }
    return base;
  }

  if (passthroughNodeTypes.has(node.data.nodeType)) {
    const incomingNodes = getActiveIncomingNodes(workflow, node.id);
    const mergedSchema = mergeJsonSchemas(
      incomingNodes.map((incomingNode) =>
        getEffectiveNodeOutputSchema(workflow, incomingNode, new Set(visited)),
      ),
    );

    if (!mergedSchema) return node.data.schema?.output;

    if (node.data.nodeType === "action_set") {
      const fieldName = getNodeParameter(node, "Field Name");
      if (fieldName) {
        setSchemaPropertyAtPath(mergedSchema, fieldName, {
          type: "string",
          description: "Field injected by Set node",
        });
      }
    }

    return mergedSchema;
  }

  if (node.data.nodeType === "analytics_compare") {
    return analyticsCompareOutputSchema;
  }

  if (node.data.nodeType === "analytics_ab") {
    return analyticsAbOutputSchema;
  }

  return node.data.schema?.output;
}

function getEffectiveNodeOutputSchema(
  workflow: Workflow,
  node: AppNode,
  visited = new Set<string>(),
): JSONSchema | undefined {
  if (visited.has(node.id)) return node.data.schema?.output;
  visited.add(node.id);

  const runtimePreview = node.data.runtime?.outputPreview;
  if (runtimePreview && isRecord(runtimePreview)) {
    return toOutputSchemaFromPreview(expandSemanticPreview(runtimePreview));
  }

  return getNodeSpecificOutputSchema(workflow, node, visited);
}

function mergePreviews(previews: unknown[]) {
  const normalizedPreviews = previews.map((preview) => expandSemanticPreview(preview));
  const records = normalizedPreviews.filter(isRecord) as Array<Record<string, unknown>>;
  if (!records.length) return normalizedPreviews.find((preview) => preview !== undefined);

  return records.reduce<Record<string, unknown>>((accumulator, preview) => {
    Object.entries(preview).forEach(([key, value]) => {
      if (!(key in accumulator)) {
        accumulator[key] = value;
      }
    });
    return accumulator;
  }, {});
}

function flattenPropertyPaths(
  property: JSONSchemaProperty,
  prefix: string,
  values: Set<string>,
) {
  values.add(prefix);

  if (property.type === "object" && property.properties) {
    Object.entries(property.properties).forEach(([key, child]) => {
      flattenPropertyPaths(child, `${prefix}.${key}`, values);
    });
  }

  if (property.type === "array" && property.items) {
    flattenPropertyPaths(property.items, `${prefix}[0]`, values);
  }
}

function snippet(label: string, insertText: string, detail: string, documentation?: string) {
  return {
    label,
    insertText,
    detail,
    documentation,
    kind: "snippet" as const,
  };
}

function getDefaultCodeTemplate(nodeType: NodeTypeId) {
  switch (nodeType) {
    case "action_if":
      return `const payload = input.first ?? {};
const passed = helpers.compare(payload.status ?? "", "equals", "active");

return {
  route: passed ? "true" : "false",
  result: {
    ...payload,
    passed,
  },
  summary: passed ? "Condition matched" : "Condition failed",
};`;
    case "action_switch":
      return `const payload = input.first ?? {};
const variant = String(payload.variant ?? "");

const route =
  variant === "variant_a"
    ? "case_1"
    : variant === "variant_b"
      ? "case_2"
      : variant === "variant_c"
        ? "case_3"
        : "default";

return {
  route,
  result: payload,
  summary: \`Routed \${variant || "default"}\`,
};`;
    case "analytics_compare":
      return `const rows = input.items;
const grouped = helpers.groupBy(rows, "sourceArea");
const sources = Object.entries(grouped).map(([key, group]) => ({
  key,
  label: key,
  value: group.length,
  count: group.length,
}));
const total = sources.reduce((sum, source) => sum + source.value, 0);
const leader = [...sources].sort((left, right) => right.value - left.value)[0];

return {
  result: {
    metric: "Volume",
    total,
    delta: sources.length > 1 ? (leader?.value ?? 0) - (sources[1]?.value ?? 0) : total,
    leader: leader?.label ?? "",
    leaderValue: leader?.value ?? 0,
    sources,
  },
  summary: \`Compared \${sources.length} source(s)\`,
};`;
    case "monitor_alert":
      return `const payload = input.first ?? {};
const threshold = helpers.toNumber(params["Threshold"] ?? 0);
const observedValue = helpers.toNumber(payload.total ?? payload.value ?? 0);
const triggered = observedValue >= threshold;

return {
  result: {
    ...payload,
    triggered,
    threshold,
    observedValue,
  },
  summary: triggered ? "Alert triggered" : "No alert triggered",
};`;
    case "action_code":
    case "action_function":
      return `const rows = input.items;

return {
  result: rows.map((row) => ({
    ...row,
  })),
  summary: \`Processed \${rows.length} item(s)\`,
};`;
    default:
      return `const payload = input.first ?? {};

return {
  result: payload,
  summary: \`Forwarded \${input.count} item(s)\`,
};`;
  }
}

function literalCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return `""`;
  if (trimmed === "true" || trimmed === "false") return trimmed;
  if (!Number.isNaN(Number(trimmed))) return trimmed;
  return JSON.stringify(trimmed);
}

function templateToCode(value: string, fallback = "payload") {
  const trimmed = value.trim();
  const match = trimmed.match(/^\{\{\s*(.+?)\s*\}\}$/);
  const expression = match?.[1]?.trim() ?? "";

  if (expression === "$json" || expression === "input.first") return fallback;
  if (expression.startsWith("$json.")) {
    return `${fallback}.${expression.slice(6)}`;
  }
  if (expression.startsWith("input.first.")) {
    return `${fallback}.${expression.slice("input.first.".length)}`;
  }

  return literalCode(trimmed);
}

export function getBuiltinCodePreview(node: AppNode) {
  const getParam = (label: string) => getNodeParameter(node, label);

  switch (node.data.nodeType) {
    case "action_if": {
      const left = templateToCode(getParam("Value 1") || "{{ input.first.status }}");
      const operation = JSON.stringify(getParam("Operation") || "equals");
      const right = templateToCode(getParam("Value 2") || "true");

      return `const payload = input.first ?? {};\nconst passed = helpers.compare(${left}, ${operation}, ${right});\n\nreturn {\n  route: passed ? "true" : "false",\n  result: {\n    ...payload,\n    passed,\n  },\n  summary: passed ? "Condition matched" : "Condition failed",\n};`;
    }
    case "action_switch": {
      const switchValue = templateToCode(getParam("Value") || "{{ input.first.variant }}");
      const operation = JSON.stringify(getParam("Operation") || "equals");
      const cases = Array.from({ length: 4 }, (_, index) => {
        const label = getParam(`Case ${index + 1}`);
        if (!label) return null;
        return `  if (helpers.compare(${switchValue}, ${operation}, ${literalCode(label)})) {\n    return {\n      route: "case_${index + 1}",\n      result: payload,\n      summary: ${JSON.stringify(`Matched ${label}`)},\n    };\n  }`;
      }).filter(Boolean);

      return `const payload = input.first ?? {};\n\n${cases.join("\n\n")}\n\nreturn {\n  route: "default",\n  result: payload,\n  summary: "No switch case matched",\n};`;
    }
    case "analytics_compare": {
      const metric = JSON.stringify(getParam("Metric") || "Volume");
      return `const rows = input.items;\nconst grouped = helpers.groupBy(rows, "sourceArea");\nconst sources = Object.entries(grouped).map(([key, group]) => ({\n  key,\n  label: key,\n  value: group.length,\n  count: group.length,\n}));\nconst total = sources.reduce((sum, source) => sum + source.value, 0);\nconst sorted = [...sources].sort((left, right) => right.value - left.value);\nconst leader = sorted[0];\nconst runnerUp = sorted[1];\n\nreturn {\n  result: {\n    metric: ${metric},\n    total,\n    delta: leader && runnerUp ? leader.value - runnerUp.value : total,\n    leader: leader?.label ?? "",\n    leaderValue: leader?.value ?? 0,\n    sources,\n  },\n  summary: \`Compared \${sources.length} source(s)\`,\n};`;
    }
    case "monitor_alert": {
      const threshold = literalCode(getParam("Threshold") || "0");
      const field = templateToCode(getParam("Field") || "{{ input.first.total }}");
      return `const payload = input.first ?? {};\nconst threshold = helpers.toNumber(${threshold});\nconst observedValue = helpers.toNumber(${field});\nconst triggered = observedValue >= threshold;\n\nreturn {\n  result: {\n    ...payload,\n    triggered,\n    threshold,\n    observedValue,\n  },\n  summary: triggered ? "Alert triggered" : "No alert triggered",\n};`;
    }
    default:
      return getDefaultCodeTemplate(node.data.nodeType);
  }
}

export function getDefaultProgrammableConfig(nodeType: NodeTypeId): NodeProgrammingConfig {
  return {
    mode: "builtin",
    code: getDefaultCodeTemplate(nodeType),
    outputTemplate: "",
  };
}

export function ensureProgrammableConfig(
  programmable: NodeProgrammingConfig | undefined,
  nodeType: NodeTypeId,
): NodeProgrammingConfig {
  const defaults = getDefaultProgrammableConfig(nodeType);

  if (!programmable) {
    return {
      ...defaults,
      mode: "builtin",
    };
  }

  return {
    mode: programmable?.mode ?? defaults.mode,
    code: programmable?.code ?? defaults.code,
    outputTemplate: programmable?.outputTemplate ?? defaults.outputTemplate,
  };
}

export function inferNodeProgrammingContext(
  workflow: Workflow,
  nodeId: string,
): NodeProgrammingContextInfo {
  const node = workflow.nodes.find((entry) => entry.id === nodeId);
  const incomingNodes = getActiveIncomingNodes(workflow, nodeId);
  const inputSchema = mergeJsonSchemas(
    incomingNodes.map((incomingNode) => {
      const preview = incomingNode.data.runtime?.outputPreview;
      if (preview && isRecord(preview)) {
        return toOutputSchemaFromPreview(preview);
      }

      return getEffectiveNodeOutputSchema(workflow, incomingNode);
    }),
  );
  const inputPreview = mergePreviews(
    incomingNodes.map((incomingNode) => incomingNode.data.runtime?.outputPreview),
  );
  const basePaths = new Set<string>([
    "input.first",
    "input.items",
    "input.count",
    "input.meta",
    "params",
    "config",
    "node",
    "env",
    "store",
  ]);

  Object.entries(inputSchema?.properties ?? {}).forEach(([key, property]) => {
    flattenPropertyPaths(property, `input.first.${key}`, basePaths);
  });

  Object.keys(node?.data.parameters ?? {}).forEach((key) => {
    basePaths.add(`params["${key}"]`);
  });

  Object.keys(node?.data.config ?? {}).forEach((key) => {
    basePaths.add(`config["${key}"]`);
  });

  const javascriptCompletions: EditorCompletionItem[] = [
    snippet(
      "Return Result",
      `return {\n  result: input.first ?? {},\n  summary: "Processed input",\n};`,
      "Return one result object",
    ),
    snippet(
      "Return Branch",
      `return {\n  route: "true",\n  result: input.first ?? {},\n  summary: "Condition matched",\n};`,
      "Route to a specific handle",
    ),
    snippet(
      "Return Multi Items",
      `return {\n  result: input.items.map((item) => ({ ...item })),\n  summary: \`Processed \${input.count} item(s)\`,\n};`,
      "Return an array of items",
    ),
    ...[
      ["helpers.compare", `helpers.compare(input.first?.status, "equals", "active")`, "Compare values"],
      ["helpers.sum", `helpers.sum(input.items, "amount")`, "Sum numeric field"],
      ["helpers.avg", `helpers.avg(input.items, "amount")`, "Average numeric field"],
      ["helpers.groupBy", `helpers.groupBy(input.items, "variant")`, "Group rows by field"],
      ["helpers.now", `helpers.now()`, "Current ISO timestamp"],
    ].map(([label, insertText, detail]) => ({
      label,
      insertText,
      detail,
      kind: "function" as const,
    })),
    ...Array.from(basePaths).map((path) => ({
      label: path,
      insertText: path,
      detail: "Connected input context",
      kind: "variable" as const,
    })),
  ];

  const jsonCompletions: EditorCompletionItem[] = [
    snippet(
      "Output Object",
      `{\n  "data": "{{ result }}",\n  "source": "{{ node.label }}"\n}`,
      "JSON payload sent to the next node",
    ),
    snippet(
      "Forward Input",
      `{\n  "variant": "{{ input.first.variant }}",\n  "amount": "{{ input.first.amount }}"\n}`,
      "Map selected input fields",
    ),
    ...Array.from(basePaths).map((path) => ({
      label: `{{ ${path} }}`,
      insertText: `{{ ${path} }}`,
      detail: "Template expression",
      kind: "variable" as const,
    })),
    ...["result", "result.route", "result.summary", "result.result"].map((path) => ({
      label: `{{ ${path} }}`,
      insertText: `{{ ${path} }}`,
      detail: "Program result expression",
      kind: "variable" as const,
    })),
  ];

  return {
    inputSchema,
    inputPreview,
    javascriptCompletions,
    jsonCompletions,
  };
}

function createHelpers(): ProgramHelpers {
  return {
    now: () => new Date().toISOString(),
    toNumber,
    toBoolean,
    compare: compareValues,
    sum: (items, field) =>
      items.reduce((sum, item) => sum + toNumber(getValueAtPath(item, field)), 0),
    avg: (items, field) => {
      if (!items.length) return 0;
      return (
        items.reduce((sum, item) => sum + toNumber(getValueAtPath(item, field)), 0) /
        items.length
      );
    },
    min: (items, field) =>
      Math.min(...items.map((item) => toNumber(getValueAtPath(item, field))), 0),
    max: (items, field) =>
      Math.max(...items.map((item) => toNumber(getValueAtPath(item, field))), 0),
    groupBy: (items, field) =>
      items.reduce<Record<string, Array<Record<string, unknown>>>>((accumulator, item) => {
        const key = String(getValueAtPath(item, field) ?? "undefined");
        if (!accumulator[key]) accumulator[key] = [];
        accumulator[key].push(item);
        return accumulator;
      }, {}),
    pick: getValueAtPath,
  };
}

function evaluateExpression(expression: string, scope: Record<string, unknown>) {
  assertSafeUserCode(expression, "Expressao programavel");
  const evaluator = new Function(
    ...Object.keys(scope),
    `"use strict"; return (${expression});`,
  );

  return evaluator(...Object.values(scope));
}

function renderTemplateNode(value: unknown, scope: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const expressionOnly = value.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/);
    if (expressionOnly) {
      return evaluateExpression(expressionOnly[1], scope);
    }

    return value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expression: string) => {
      const resolved = evaluateExpression(expression, scope);
      if (resolved === undefined || resolved === null) return "";
      return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => renderTemplateNode(entry, scope));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderTemplateNode(entry, scope)]),
    );
  }

  return value;
}

function renderOutputTemplate(
  template: string,
  scope: Record<string, unknown>,
) {
  if (!template.trim()) return undefined;
  const parsed = JSON.parse(template) as unknown;
  return renderTemplateNode(parsed, scope);
}

export function executeProgrammableNode(args: {
  node: AppNode;
  input: RuntimeEnvelope;
  context: RuntimeEvaluationContext;
  inputSchema?: JSONSchema;
}): ProgrammableExecutionResult | null {
  const programmable = ensureProgrammableConfig(
    args.node.data.programmable,
    args.node.data.nodeType,
  );

  if (programmable.mode !== "code" || !programmable.code.trim()) {
    return null;
  }

  assertSafeUserCode(programmable.code, "Codigo do node programavel");

  const items = args.input.items.map((item) => deepClone(item.json));
  const scope: ProgramScope = {
    input: {
      first: items[0] ?? null,
      items,
      count: items.length,
      meta: deepClone(args.input.meta),
      schema: args.inputSchema,
    },
    params: deepClone(args.node.data.parameters ?? {}),
    config: deepClone(args.node.data.config ?? {}),
    node: {
      id: args.node.id,
      label: args.node.data.label,
      nodeType: args.node.data.nodeType,
    },
    env: {
      projectId: args.context.project.id,
      workflowId: args.context.workflow.id,
      source: args.context.request.source,
      trigger: args.input.meta.trigger,
    },
    store: deepClone(args.context.store.collections),
    helpers: createHelpers(),
  };

  const executor = new Function(
    "scope",
    `"use strict"; const { input, params, config, node, env, store, helpers } = scope; ${programmable.code}`,
  ) as (scope: ProgramScope) => unknown;
  const rawResult = executor(scope);
  const recordResult = isRecord(rawResult) ? rawResult : { result: rawResult };
  const templateScope = {
    input: scope.input,
    params: scope.params,
    config: scope.config,
    node: scope.node,
    env: scope.env,
    store: scope.store,
    helpers: scope.helpers,
    result: recordResult,
  } satisfies Record<string, unknown>;

  const normalizeRoutePayload = (value: unknown) => {
    const templated = renderOutputTemplate(programmable.outputTemplate, {
      ...templateScope,
      result: value,
    });
    return toRecordArray(templated ?? value);
  };

  let outputs: Record<string, Array<Record<string, unknown>>> = {};
  if (isRecord(recordResult.routes)) {
    outputs = Object.fromEntries(
      Object.entries(recordResult.routes).map(([handle, value]) => [
        handle,
        normalizeRoutePayload(value),
      ]),
    );
  } else {
    const outputValue =
      renderOutputTemplate(programmable.outputTemplate, templateScope) ??
      recordResult.result ??
      recordResult.item ??
      recordResult.items ??
      rawResult;
    const route = typeof recordResult.route === "string" ? recordResult.route : "default";
    outputs = {
      [route]: toRecordArray(outputValue),
    };
  }

  return {
    outputs,
    summary:
      typeof recordResult.summary === "string" ? recordResult.summary : undefined,
    patch: isRecord(recordResult.patch)
      ? (recordResult.patch as Partial<WorkflowNodeData>)
      : undefined,
    response: isRuntimeWebhookResponse(recordResult.response)
      ? recordResult.response
      : undefined,
    artifacts: Array.isArray(recordResult.artifacts)
      ? (recordResult.artifacts as RuntimeArtifact[])
      : undefined,
    meta: isRecord(recordResult.meta) ? (recordResult.meta as Record<string, unknown>) : undefined,
  };
}
