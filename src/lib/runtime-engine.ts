import { v4 as uuidv4 } from "uuid";
import type { Edge } from "@xyflow/react";
import type { AppNode, Project, Workflow, WorkflowNodeData } from "@/lib/flow-types";
import type { NodeTypeId } from "@/lib/node-catalog";
import type {
  ProjectRuntimeStore,
  RuntimeCollectionRecord,
  RuntimeEnvelope,
  RuntimeEvaluationContext,
  RuntimeItem,
  RuntimeNodePatch,
  RuntimeNodeSnapshot,
  RuntimeWebhookResponse,
  WorkflowExecutionRequest,
  WorkflowRunResult,
} from "@/lib/runtime-types";

interface ExecuteWorkflowRunOptions {
  project: Project;
  workflow: Workflow;
  request: WorkflowExecutionRequest;
  store: ProjectRuntimeStore;
  defaultAiApiKey?: string;
  defaultAiBaseUrl?: string;
}

interface NodeHandlerResult {
  outputs?: Record<string, RuntimeEnvelope>;
  patch?: Partial<WorkflowNodeData>;
  summary?: string;
  response?: RuntimeWebhookResponse;
}

const DEFAULT_AI_BASE_URL = "https://api.deepseek.com/v1/chat/completions";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEnvelope(
  items: Array<Record<string, unknown>>,
  meta: Record<string, unknown> = {},
): RuntimeEnvelope {
  return {
    items: items.map((item) => ({ json: deepClone(item) })),
    meta: deepClone(meta),
  };
}

function cloneEnvelope(envelope: RuntimeEnvelope): RuntimeEnvelope {
  return {
    items: envelope.items.map((item) => ({ json: deepClone(item.json) })),
    meta: deepClone(envelope.meta),
  };
}

function mergeEnvelopes(envelopes: RuntimeEnvelope[]) {
  if (!envelopes.length) {
    return createEnvelope([]);
  }

  return {
    items: envelopes.flatMap((envelope) =>
      envelope.items.map((item) => ({
        json: deepClone(item.json),
      })),
    ),
    meta: Object.assign({}, ...envelopes.map((envelope) => deepClone(envelope.meta))),
  } satisfies RuntimeEnvelope;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function getNodeParameter(node: AppNode, label: string) {
  const parameters = node.data.parameters ?? {};
  const match = Object.entries(parameters).find(([key]) => normalizeKey(key) === normalizeKey(label));
  return (match?.[1] ?? "").trim();
}

function getNodeConfigValue(node: AppNode, key: string) {
  return node.data.config?.[key];
}

function setValueAtPath(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) return target;

  let cursor: Record<string, unknown> = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }

    if (!cursor[segment] || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  });

  return target;
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

function parseJsonIfPossible(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function coerceValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);

  return trimmed;
}

function resolveTemplateValue(
  value: string,
  item: Record<string, unknown>,
  context: RuntimeEvaluationContext,
) {
  const expressionOnly = value.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/);

  const resolveExpression = (expression: string) => {
    if (expression === "$now") return new Date().toISOString();
    if (expression.startsWith("$json.")) return getValueAtPath(item, expression.slice(6));
    if (expression === "$json") return item;
    if (expression.startsWith("$meta.")) return getValueAtPath(context.request.payload ?? {}, expression.slice(6));
    if (expression.startsWith("$store.")) {
      const [collection, fieldPath] = expression.slice(7).split(".", 2);
      const records = context.store.collections[collection] ?? [];
      if (!fieldPath) return records;
      return records.map((record) => getValueAtPath(record.payload, fieldPath));
    }
    return undefined;
  };

  if (expressionOnly) {
    return resolveExpression(expressionOnly[1]) ?? "";
  }

  return value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expression: string) => {
    const resolved = resolveExpression(expression);
    if (resolved === undefined || resolved === null) return "";
    if (typeof resolved === "string") return resolved;
    return JSON.stringify(resolved);
  });
}

function materializeValue(
  rawValue: string,
  item: Record<string, unknown>,
  context: RuntimeEvaluationContext,
) {
  const resolved = resolveTemplateValue(rawValue, item, context);
  return coerceValue(resolved);
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
  const normalizedOperation = normalizeKey(operation || "equals");
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

function buildPreview(items: RuntimeItem[]) {
  if (!items.length) return null;
  if (items.length === 1) return items[0].json;
  return {
    count: items.length,
    first: items[0].json,
  };
}

function addRecordsToCollection(
  store: ProjectRuntimeStore,
  collectionName: string,
  sourceNodeId: string,
  items: RuntimeItem[],
) {
  const current = store.collections[collectionName] ?? [];
  const nextRecords: RuntimeCollectionRecord[] = items.map((item) => ({
    id: uuidv4(),
    timestamp: Date.now(),
    sourceNodeId,
    payload: deepClone(item.json),
  }));

  store.collections[collectionName] = [...current, ...nextRecords];
  store.lastUpdatedAt = Date.now();
}

function getCollectionRecords(store: ProjectRuntimeStore, collectionName: string) {
  return store.collections[collectionName] ?? [];
}

function extractSeries(items: RuntimeItem[]) {
  return items.map((item, index) => {
    const label = String(
      item.json.date ?? item.json.day ?? item.json.name ?? item.json.label ?? `Item ${index + 1}`,
    );
    const value = toNumber(
      item.json.value ??
        item.json.total ??
        item.json.amount ??
        item.json.metric ??
        item.json.count ??
        0,
    );

    return { label, value };
  });
}

function summarizeMetric(items: RuntimeItem[], fallbackLabel: string) {
  const first = items[0]?.json ?? {};
  const explicitValue = first.value ?? first.total ?? first.metric ?? first.amount;
  const explicitTrend = first.trend ?? first.delta;
  const total =
    explicitValue !== undefined
      ? explicitValue
      : items.reduce(
          (sum, item) =>
            sum +
            toNumber(
              item.json.value ??
                item.json.total ??
                item.json.amount ??
                item.json.metric,
            ),
          0,
        );
  const totalNumber = toNumber(total);
  const trend =
    explicitTrend !== undefined
      ? String(explicitTrend)
      : `${totalNumber >= 0 ? "+" : ""}${(Math.abs(totalNumber) * 0.08).toFixed(1)}%`;

  return {
    value:
      typeof total === "number" && total > 1000
        ? `$${Math.round(total).toLocaleString()}`
        : String(total),
    trend,
    compareLabel: "vs previous period",
    metricLabel: fallbackLabel,
  };
}

function formatReportValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function buildReportItemsFromObjects(
  rows: Array<Record<string, unknown>>,
  columns?: string[],
) {
  const activeColumns =
    columns && columns.length
      ? columns
      : Array.from(
          rows.reduce((set, row) => {
            Object.keys(row).forEach((key) => {
              set.add(key);
            });
            return set;
          }, new Set<string>()),
        );

  return rows.slice(0, 4).map((row, index) => {
    const [labelKey, valueKey, deltaKey] = activeColumns;
    const label = formatReportValue(
      row[labelKey ?? "label"] ?? row.name ?? row.title ?? `Item ${index + 1}`,
    );
    const value = formatReportValue(
      row[valueKey ?? "value"] ?? row.value ?? row.total ?? row.amount ?? row.status ?? "",
    );
    const delta = formatReportValue(
      row[deltaKey ?? "delta"] ?? row.delta ?? row.trend ?? row.change ?? "",
    );

    return {
      label: label || `Item ${index + 1}`,
      value,
      delta,
      positive: !String(delta).startsWith("-"),
    };
  });
}

function buildReportItemsFromPayloads(items: RuntimeItem[]) {
  if (!items.length) return [];
  const first = items[0]?.json ?? {};

  if (Array.isArray(first.reportItems)) {
    return first.reportItems as Array<{
      label: string;
      value: string;
      delta: string;
      positive: boolean;
    }>;
  }

  if (Array.isArray(first.rows)) {
    const rows = first.rows.filter(
      (row): row is Record<string, unknown> => typeof row === "object" && row !== null && !Array.isArray(row),
    );
    const columns = Array.isArray(first.columns)
      ? first.columns.map((column) => String(column))
      : undefined;
    return buildReportItemsFromObjects(rows, columns);
  }

  return buildReportItemsFromObjects(items.map((item) => item.json));
}

function classifyError(item: Record<string, unknown>) {
  const message = String(item.message ?? item.error ?? item.stack ?? "");
  const level = String(item.level ?? item.severity ?? "error").toLowerCase();

  let category = "application";
  if (message.toLowerCase().includes("timeout")) category = "timeout";
  if (message.toLowerCase().includes("auth")) category = "auth";
  if (message.toLowerCase().includes("5xx")) category = "server";

  return {
    level,
    category,
    message,
    fingerprint: `${level}:${category}`,
  };
}

function requiresAllInputs(nodeType: NodeTypeId) {
  return (
    nodeType === "action_merge" ||
    nodeType === "analytics_compare" ||
    nodeType === "analytics_ab"
  );
}

async function callJsonApi(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;

  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    text,
    json,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function executeNode(
  node: AppNode,
  input: RuntimeEnvelope,
  context: RuntimeEvaluationContext,
  defaultAiApiKey?: string,
  defaultAiBaseUrl?: string,
): Promise<NodeHandlerResult> {
  const items = input.items;
  const firstItem = items[0]?.json ?? {};

  switch (node.data.nodeType) {
    case "trigger_manual":
    case "trigger_webhook":
    case "trigger_schedule": {
      const payload =
        context.request.payload ??
        ({
          event: node.data.nodeType,
          timestamp: new Date().toISOString(),
          workflowId: context.workflow.id,
          projectId: context.project.id,
        } satisfies Record<string, unknown>);

      return {
        outputs: {
          default: createEnvelope([payload], {
            trigger: node.data.nodeType,
            source: context.request.source,
          }),
        },
        summary: `${node.data.label} emitted 1 event`,
      };
    }

    case "action_http": {
      const method = (getNodeParameter(node, "Method") || "GET").toUpperCase();
      const url = getNodeParameter(node, "URL");
      const responseFormat = normalizeKey(getNodeParameter(node, "Response Format") || "json");
      if (!url) throw new Error("HTTP node requires URL.");

      const body =
        method === "GET"
          ? undefined
          : JSON.stringify(items.length === 1 ? firstItem : items.map((item) => item.json));

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
      const rawText = await response.text();
      const payload = responseFormat === "json" ? parseJsonIfPossible(rawText) : rawText;

      return {
        outputs: {
          default: createEnvelope(
            [
              {
                status: response.status,
                ok: response.ok,
                body: payload as Record<string, unknown>,
              },
            ],
            { status: response.status },
          ),
        },
        summary: `${method} ${url}`,
      };
    }

    case "action_set": {
      const fieldName = getNodeParameter(node, "Field Name");
      const fieldValue = getNodeParameter(node, "Field Value");
      if (!fieldName) throw new Error("Set node requires Field Name.");

      const nextItems = items.map((item) => {
        const nextJson = deepClone(item.json);
        setValueAtPath(nextJson, fieldName, materializeValue(fieldValue, item.json, context));
        return nextJson;
      });

      return {
        outputs: { default: createEnvelope(nextItems, input.meta) },
        summary: `Set ${fieldName}`,
      };
    }

    case "action_filter": {
      const field = getNodeParameter(node, "Field");
      const rule = getNodeParameter(node, "Rule") || "greater than";
      const expected = getNodeParameter(node, "Value");

      const filtered = items
        .filter((item) =>
          compareValues(
            materializeValue(field, item.json, context),
            rule,
            materializeValue(expected, item.json, context),
          ),
        )
        .map((item) => item.json);

      return {
        outputs: { default: createEnvelope(filtered, input.meta) },
        summary: `${filtered.length}/${items.length} items matched`,
      };
    }

    case "action_if":
    case "action_switch": {
      const leftRaw =
        getNodeParameter(node, "Value 1") ||
        getNodeParameter(node, "Value") ||
        "{{ $json }}";
      const operation =
        getNodeParameter(node, "Operation") ||
        getNodeParameter(node, "Mode") ||
        "equals";
      const rightRaw = getNodeParameter(node, "Value 2") || "true";

      const decision = compareValues(
        materializeValue(leftRaw, firstItem, context),
        operation,
        materializeValue(rightRaw, firstItem, context),
      );

      return {
        outputs: {
          [decision ? "true" : "false"]: cloneEnvelope(input),
        },
        summary: decision ? "Condition matched" : "Condition failed",
      };
    }

    case "action_merge": {
      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Merged ${items.length} items`,
      };
    }

    case "action_split": {
      const batchSize = Number(getNodeParameter(node, "Batch Size") || 100);
      const safeBatchSize = Number.isNaN(batchSize) || batchSize <= 0 ? 100 : batchSize;
      const batches: Record<string, unknown>[] = [];

      for (let index = 0; index < items.length; index += safeBatchSize) {
        batches.push({
          batchIndex: Math.floor(index / safeBatchSize),
          items: items.slice(index, index + safeBatchSize).map((item) => item.json),
          size: Math.min(safeBatchSize, items.length - index),
        });
      }

      return {
        outputs: { default: createEnvelope(batches, { batches: batches.length }) },
        summary: `${batches.length} batch(es)`,
      };
    }

    case "action_code":
    case "action_function": {
      const code = getNodeParameter(node, "Code") || "return items.map((item) => item.json);";
      // Local desktop runtime by design. This executes user code on local data.
      const executor = new Function(
        "items",
        "input",
        "context",
        `${code}`,
      ) as (
        items: RuntimeItem[],
        input: RuntimeEnvelope,
        context: RuntimeEvaluationContext,
      ) => unknown;
      const result = executor(items, input, context);
      const normalized = Array.isArray(result)
        ? result.map((entry) =>
            typeof entry === "object" && entry ? entry : { value: entry },
          )
        : typeof result === "object" && result
          ? [result as Record<string, unknown>]
          : [{ value: result }];

      return {
        outputs: { default: createEnvelope(normalized, input.meta) },
        summary: `${node.data.label} executed`,
      };
    }

    case "action_wait": {
      const amount = Number(getNodeParameter(node, "Amount") || 1);
      const unit = normalizeKey(getNodeParameter(node, "Unit") || "seconds");
      const multiplier =
        unit.includes("minute") ? 60_000 : unit.includes("hour") ? 3_600_000 : 1_000;
      const delayMs = Math.min(Math.max(amount * multiplier, 0), 15_000);
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));

      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Waited ${Math.round(delayMs / 1000)}s`,
      };
    }

    case "action_respond": {
      const status = Number(getNodeParameter(node, "Response Code") || 200);
      const respondWith = normalizeKey(getNodeParameter(node, "Respond With") || "json payload");
      const responseBody =
        respondWith.includes("json")
          ? JSON.stringify(items.length === 1 ? firstItem : items.map((item) => item.json))
          : String(firstItem.message ?? "ok");

      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Prepared webhook response ${status}`,
        response: {
          status,
          body: responseBody,
          headers: {
            "content-type": respondWith.includes("json")
              ? "application/json"
              : "text/plain",
          },
        },
      };
    }

    case "analytics_store": {
      const storeName = getNodeParameter(node, "Store Name") || "events_store";
      addRecordsToCollection(context.store, storeName, node.id, items);
      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Stored ${items.length} item(s) in ${storeName}`,
      };
    }

    case "analytics_aggregate": {
      const groupBy = getNodeParameter(node, "Group By");
      const aggregation = normalizeKey(getNodeParameter(node, "Aggregation") || "sum");
      const field = getNodeParameter(node, "Field") || "{{ $json.amount }}";

      if (!groupBy) {
        const values = items.map((item) => toNumber(materializeValue(field, item.json, context)));
        const total =
          aggregation === "count"
            ? values.length
            : values.reduce((sum, value) => sum + value, 0);
        return {
          outputs: {
            default: createEnvelope([{ total, aggregation, field }], {
              total,
            }),
          },
          summary: `${aggregation} => ${total}`,
        };
      }

      const buckets = new Map<string, number>();
      items.forEach((item) => {
        const groupKey = String(materializeValue(groupBy, item.json, context) ?? "unknown");
        const value =
          aggregation === "count" ? 1 : toNumber(materializeValue(field, item.json, context));
        buckets.set(groupKey, (buckets.get(groupKey) ?? 0) + value);
      });

      const rows = Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));

      return {
        outputs: { default: createEnvelope(rows, { groups: rows.length }) },
        summary: `${rows.length} aggregate bucket(s)`,
      };
    }

    case "analytics_compare": {
      const labelA = getNodeParameter(node, "Input A Label") || "A";
      const labelB = getNodeParameter(node, "Input B Label") || "B";
      const metric = getNodeParameter(node, "Metric") || "Value";
      const half = Math.max(1, Math.floor(items.length / 2));
      const groupA = items.slice(0, half);
      const groupB = items.slice(half);
      const totalA = groupA.reduce(
        (sum, item) =>
          sum + toNumber(item.json.value ?? item.json.total ?? item.json.amount ?? 0),
        0,
      );
      const totalB = groupB.reduce(
        (sum, item) =>
          sum + toNumber(item.json.value ?? item.json.total ?? item.json.amount ?? 0),
        0,
      );

      return {
        outputs: {
          default: createEnvelope([
            {
              metric,
              [labelA]: totalA,
              [labelB]: totalB,
              delta: totalB - totalA,
            },
          ]),
        },
        summary: `${metric}: ${labelA} vs ${labelB}`,
      };
    }

    case "analytics_ab": {
      const minimumSample = Number(getNodeParameter(node, "Minimum Sample") || 100);
      const half = Math.max(1, Math.floor(items.length / 2));
      const control = items.slice(0, half);
      const treatment = items.slice(half);
      const controlConversions = control.filter((item) =>
        toBoolean(item.json.converted ?? item.json.success),
      ).length;
      const treatmentConversions = treatment.filter((item) =>
        toBoolean(item.json.converted ?? item.json.success),
      ).length;
      const controlRate = control.length ? controlConversions / control.length : 0;
      const treatmentRate = treatment.length ? treatmentConversions / treatment.length : 0;
      const winner =
        control.length < minimumSample || treatment.length < minimumSample
          ? "insufficient_sample"
          : controlRate >= treatmentRate
            ? "control"
            : "treatment";

      return {
        outputs: {
          default: createEnvelope([
            {
              controlRate,
              treatmentRate,
              controlCount: control.length,
              treatmentCount: treatment.length,
              winner,
            },
          ]),
        },
        summary: `A/B winner: ${winner}`,
      };
    }

    case "analytics_funnel": {
      const stages = [
        getNodeParameter(node, "Step 1") || "page_view",
        getNodeParameter(node, "Step 2") || "signup",
        getNodeParameter(node, "Step 3") || "paid",
      ].filter(Boolean);

      const rows = stages.map((stage) => ({
        label: stage,
        value: items.filter(
          (item) => String(item.json.event ?? item.json.stage ?? item.json.name) === stage,
        ).length,
      }));

      return {
        outputs: { default: createEnvelope(rows, { funnel: true }) },
        summary: `${rows.length} funnel stage(s)`,
      };
    }

    case "analytics_segment": {
      const segmentField = getNodeParameter(node, "Segment Field") || "{{ $json.segment }}";
      const values = getNodeParameter(node, "Values")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const buckets = new Map<string, number>();
      items.forEach((item) => {
        const key = String(materializeValue(segmentField, item.json, context) ?? "unknown");
        if (values.length && !values.includes(key)) return;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });

      const rows = Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
      return {
        outputs: { default: createEnvelope(rows) },
        summary: `${rows.length} segment(s)`,
      };
    }

    case "analytics_enrich": {
      const source = getNodeParameter(node, "Source") || "events_store";
      const joinField = getNodeParameter(node, "Join Field") || "user_id";
      const records = getCollectionRecords(context.store, source);
      const indexed = new Map(
        records.map((record) => [
          String(getValueAtPath(record.payload, joinField) ?? ""),
          record.payload,
        ]),
      );

      const enriched = items.map((item) => {
        const joinKey = String(getValueAtPath(item.json, joinField) ?? "");
        return {
          ...item.json,
          enrichment: indexed.get(joinKey) ?? null,
        };
      });

      return {
        outputs: { default: createEnvelope(enriched, input.meta) },
        summary: `Enriched ${enriched.length} item(s) from ${source}`,
      };
    }

    case "monitor_error": {
      const levelFilter = normalizeKey(getNodeParameter(node, "Level Filter") || "error");
      const pattern = getNodeParameter(node, "Pattern");
      const matcher = pattern ? new RegExp(pattern, "i") : null;

      const rows = items
        .map((item) => ({
          ...item.json,
          ...classifyError(item.json),
        }))
        .filter((item) => item.level.includes(levelFilter.split(" ")[0]))
        .filter((item) => (matcher ? matcher.test(String(item.message ?? "")) : true));

      return {
        outputs: { default: createEnvelope(rows) },
        summary: `${rows.length} error(s) classified`,
      };
    }

    case "monitor_alert": {
      const threshold = Number(getNodeParameter(node, "Threshold") || 0);
      const field = getNodeParameter(node, "Field") || "{{ $json.value }}";
      const channel = getNodeParameter(node, "Channel") || "log";

      const matches = items.filter(
        (item) => toNumber(materializeValue(field, item.json, context)) >= threshold,
      );
      const alertPayload = {
        triggered: matches.length > 0,
        threshold,
        matches: matches.length,
        channel,
      };

      return {
        outputs: {
          default: createEnvelope([alertPayload], { alert: alertPayload.triggered }),
        },
        summary: alertPayload.triggered
          ? `Alert triggered on ${matches.length} item(s)`
          : "No alert triggered",
      };
    }

    case "monitor_revenue": {
      const metric = normalizeKey(getNodeParameter(node, "Metric") || "mrr");
      const total = items.reduce(
        (sum, item) =>
          sum +
          toNumber(
            item.json.amount ??
              item.json.revenue ??
              item.json.value ??
              item.json.total,
          ),
        0,
      );
      const payload = {
        metric,
        total,
        currency: getNodeParameter(node, "Currency") || "USD",
      };

      return {
        outputs: { default: createEnvelope([payload], { revenueMetric: metric }) },
        summary: `${metric.toUpperCase()} ${total.toLocaleString()}`,
      };
    }

    case "action_slack": {
      const webhookUrl = getNodeParameter(node, "Webhook URL");
      const channel = getNodeParameter(node, "Channel");
      const messageTemplate =
        getNodeParameter(node, "Message") || JSON.stringify(firstItem);
      const message = String(materializeValue(messageTemplate, firstItem, context));

      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: channel ? `${channel}: ${message}` : message,
          }),
        });
      }

      return {
        outputs: { default: cloneEnvelope(input) },
        summary: webhookUrl ? "Slack notification sent" : "Slack payload prepared",
      };
    }

    case "action_email": {
      const apiKey = getNodeParameter(node, "API Key");
      const from = getNodeParameter(node, "From");
      const to = getNodeParameter(node, "To");
      const subject = getNodeParameter(node, "Subject") || "Flow Merge notification";
      const message =
        getNodeParameter(node, "Message") || JSON.stringify(firstItem, null, 2);

      if (apiKey && from && to) {
        await callJsonApi("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            text: message,
          }),
        });
      }

      return {
        outputs: { default: cloneEnvelope(input) },
        summary: apiKey && from && to ? "Email request sent" : "Email payload prepared",
      };
    }

    case "action_github": {
      const token = getNodeParameter(node, "Token");
      const owner = getNodeParameter(node, "Owner");
      const repository = getNodeParameter(node, "Repository");
      const operation = normalizeKey(getNodeParameter(node, "Operation") || "get pull request");

      if (!token || !owner || !repository) {
        return {
          outputs: { default: cloneEnvelope(input) },
          summary: "GitHub credentials missing",
        };
      }

      const url = operation.includes("pull")
        ? `https://api.github.com/repos/${owner}/${repository}/pulls`
        : `https://api.github.com/repos/${owner}/${repository}`;
      const response = await callJsonApi(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });

      return {
        outputs: {
          default: createEnvelope([
            {
              status: response.status,
              data: response.json ?? response.text,
            },
          ]),
        },
        summary: `GitHub ${operation} completed`,
      };
    }

    case "action_notion": {
      const token = getNodeParameter(node, "Token");
      const databaseId = getNodeParameter(node, "Database ID");
      const operation = normalizeKey(getNodeParameter(node, "Operation") || "create");

      if (!token || !databaseId) {
        return {
          outputs: { default: cloneEnvelope(input) },
          summary: "Notion credentials missing",
        };
      }

      const url = operation.includes("query")
        ? `https://api.notion.com/v1/databases/${databaseId}/query`
        : "https://api.notion.com/v1/pages";
      const body = operation.includes("query")
        ? {}
        : {
            parent: { database_id: databaseId },
            properties: {
              Name: {
                title: [
                  {
                    text: {
                      content: String(firstItem.title ?? firstItem.name ?? "Flow Merge entry"),
                    },
                  },
                ],
              },
            },
          };

      const response = await callJsonApi(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      return {
        outputs: {
          default: createEnvelope([
            { status: response.status, data: response.json ?? response.text },
          ]),
        },
        summary: `Notion ${operation} completed`,
      };
    }

    case "action_openai": {
      const apiKey = getNodeParameter(node, "API Key") || defaultAiApiKey;
      const baseUrl =
        getNodeParameter(node, "API Base URL") ||
        defaultAiBaseUrl ||
        DEFAULT_AI_BASE_URL;
      const model = getNodeParameter(node, "Model") || "deepseek-chat";
      const prompt =
        getNodeParameter(node, "Prompt") ||
        "Summarize the input and return practical insights.";
      const payloadText = JSON.stringify(items.map((item) => item.json), null, 2);

      if (!apiKey) {
        return {
          outputs: { default: cloneEnvelope(input) },
          summary: "AI credentials missing",
          patch: {
            notes: "Configure an AI API key to enable this node.",
          },
        };
      }

      const response = await callJsonApi(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are an analytics and SaaS operations assistant. Return concise insights.",
            },
            {
              role: "user",
              content: `${prompt}\n\nInput:\n${payloadText}`,
            },
          ],
        }),
      });

      const responseJson = response.json as Record<string, unknown> | null;
      const choices = Array.isArray(responseJson?.choices)
        ? (responseJson?.choices as Array<Record<string, unknown>>)
        : [];
      const firstChoice = choices[0];
      const message =
        typeof firstChoice?.message === "object" && firstChoice?.message
          ? String(
              (firstChoice.message as Record<string, unknown>).content ?? response.text,
            )
          : response.text;

      return {
        outputs: {
          default: createEnvelope([{ insight: message, model, status: response.status }]),
        },
        summary: "AI insight generated",
        patch: {
          notes: message.slice(0, 240),
        },
      };
    }

    case "viz_metric": {
      const metric = summarizeMetric(items, node.data.label);
      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Metric rendered from ${items.length} item(s)`,
        patch: {
          config: {
            ...(node.data.config ?? {}),
            value: metric.value,
            trend: metric.trend,
            compareLabel: metric.compareLabel,
          },
        },
      };
    }

    case "viz_chart": {
      const series = extractSeries(items);
      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Chart updated with ${series.length} point(s)`,
        patch: {
          config: {
            ...(node.data.config ?? {}),
            series,
          },
        },
      };
    }

    case "viz_table": {
      const rows = items.map((item) => item.json);
      const columns = Array.from(
        rows.reduce((set, row) => {
          Object.keys(row).forEach((key) => {
            set.add(key);
          });
          return set;
        }, new Set<string>()),
      );

      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Table updated with ${rows.length} row(s)`,
        patch: {
          config: {
            ...(node.data.config ?? {}),
            columns: columns.join(","),
            rows,
          },
        },
      };
    }

    case "viz_report": {
      const reportItems = items.slice(0, 4).map((item, index) => ({
        label: String(item.json.label ?? item.json.name ?? `Item ${index + 1}`),
        value: String(item.json.value ?? item.json.total ?? item.json.amount ?? ""),
        delta: String(item.json.delta ?? item.json.trend ?? ""),
        positive: !String(item.json.delta ?? item.json.trend ?? "").startsWith("-"),
      }));

      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Report updated with ${reportItems.length} row(s)`,
        patch: {
          config: {
            ...(node.data.config ?? {}),
            reportItems,
            insight:
              String(firstItem.insight ?? firstItem.summary ?? "") ||
              String(getNodeConfigValue(node, "insight") ?? ""),
          },
        },
      };
    }

    case "viz_funnel": {
      const stages = items.map((item, index) => ({
        label: String(item.json.label ?? `Stage ${index + 1}`),
        value: toNumber(item.json.value ?? item.json.total ?? item.json.count),
      }));

      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `Funnel updated with ${stages.length} stage(s)`,
        patch: {
          config: {
            ...(node.data.config ?? {}),
            stages,
          },
        },
      };
    }

    case "viz_dashboard": {
      return {
        outputs: { default: cloneEnvelope(input) },
        summary: "Dashboard available for widget composition",
        patch: {
          notes: `Latest input items: ${items.length}`,
        },
      };
    }

    default: {
      return {
        outputs: { default: cloneEnvelope(input) },
        summary: `${node.data.label} passed ${items.length} item(s) through`,
      };
    }
  }
}

function buildOutgoingMap(edges: Edge[]) {
  return edges.reduce<Record<string, Edge[]>>((accumulator, edge) => {
    if (!accumulator[edge.source]) accumulator[edge.source] = [];
    accumulator[edge.source].push(edge);
    return accumulator;
  }, {});
}

function buildIncomingCounts(edges: Edge[]) {
  return edges.reduce<Record<string, number>>((accumulator, edge) => {
    accumulator[edge.target] = (accumulator[edge.target] ?? 0) + 1;
    return accumulator;
  }, {});
}

function resolveTriggerNode(workflow: Workflow, triggerNodeId?: string) {
  if (triggerNodeId) {
    return workflow.nodes.find((node) => node.id === triggerNodeId) ?? null;
  }

  return workflow.nodes.find((node) => node.data.nodeType.startsWith("trigger_")) ?? null;
}

function createInitialSnapshots(workflow: Workflow) {
  return workflow.nodes.reduce<Record<string, RuntimeNodeSnapshot>>(
    (accumulator, node) => {
      accumulator[node.id] = {
        nodeId: node.id,
        nodeType: node.data.nodeType,
        status: "idle",
      };
      return accumulator;
    },
    {},
  );
}

function applyNodePatch(
  patches: RuntimeNodePatch[],
  nodeId: string,
  patch: Partial<WorkflowNodeData>,
) {
  const existing = patches.find((entry) => entry.nodeId === nodeId);
  if (existing) {
    existing.data = {
      ...existing.data,
      ...patch,
      config: {
        ...(existing.data.config ?? {}),
        ...(patch.config ?? {}),
      },
    };
    return;
  }

  patches.push({ nodeId, data: patch });
}

export async function executeWorkflowRun({
  project,
  workflow,
  request,
  store,
  defaultAiApiKey,
  defaultAiBaseUrl,
}: ExecuteWorkflowRunOptions): Promise<WorkflowRunResult> {
  const triggerNode = resolveTriggerNode(workflow, request.triggerNodeId);
  if (!triggerNode) {
    throw new Error("No trigger node found for this workflow.");
  }

  const updatedStore = deepClone(store);
  const outgoingMap = buildOutgoingMap(workflow.edges);
  const incomingCounts = buildIncomingCounts(workflow.edges);
  const nodesById = Object.fromEntries(
    workflow.nodes.map((node) => [node.id, node]),
  ) as Record<string, AppNode>;
  const nodeSnapshots = createInitialSnapshots(workflow);
  const nodePatches: RuntimeNodePatch[] = [];
  const logs: string[] = [];
  const pendingInputs: Record<string, RuntimeEnvelope[]> = {
    [triggerNode.id]: [createEnvelope([], {})],
  };
  const queued = new Set<string>([triggerNode.id]);
  const queue: string[] = [triggerNode.id];
  let response: RuntimeWebhookResponse | undefined;

  const context: RuntimeEvaluationContext = {
    project,
    workflow,
    nodesById,
    incomingCounts,
    store: updatedStore,
    request,
    logs,
  };

  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    queued.delete(nodeId);

    const node = nodesById[nodeId];
    if (!node) continue;

    if (requiresAllInputs(node.data.nodeType)) {
      const requiredCount = Math.max(1, incomingCounts[nodeId] ?? 1);
      if ((pendingInputs[nodeId]?.length ?? 0) < requiredCount && nodeId !== triggerNode.id) {
        continue;
      }
    }

    const input = mergeEnvelopes(pendingInputs[nodeId] ?? []);
    pendingInputs[nodeId] = [];

    const startedAt = Date.now();
    nodeSnapshots[nodeId] = {
      ...nodeSnapshots[nodeId],
      status: node.data.disabled ? "skipped" : "running",
      startedAt,
    };

    if (node.data.disabled) {
      nodeSnapshots[nodeId] = {
        ...nodeSnapshots[nodeId],
        status: "skipped",
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        itemCount: input.items.length,
        summary: "Node disabled, input forwarded",
        outputPreview: buildPreview(input.items),
      };

      (outgoingMap[nodeId] ?? []).forEach((edge) => {
        if (!pendingInputs[edge.target]) pendingInputs[edge.target] = [];
        pendingInputs[edge.target].push(cloneEnvelope(input));
        if (!queued.has(edge.target)) {
          queue.push(edge.target);
          queued.add(edge.target);
        }
      });
      continue;
    }

    try {
      const result = await executeNode(
        node,
        input,
        context,
        defaultAiApiKey,
        defaultAiBaseUrl,
      );

      if (result.patch) {
        applyNodePatch(nodePatches, nodeId, result.patch);
      }

      if (result.response) {
        response = result.response;
      }

      const defaultOutput = result.outputs?.default;
      const routedOutputs = result.outputs ?? {};
      (outgoingMap[nodeId] ?? []).forEach((edge) => {
        const handleKey = edge.sourceHandle ?? "default";
        const output = routedOutputs[handleKey] ?? defaultOutput;
        if (!output) return;

        if (!pendingInputs[edge.target]) pendingInputs[edge.target] = [];
        pendingInputs[edge.target].push(cloneEnvelope(output));
        if (!queued.has(edge.target)) {
          queue.push(edge.target);
          queued.add(edge.target);
        }
      });

      const previewSource =
        defaultOutput?.items ?? Object.values(routedOutputs).flatMap((output) => output.items);

      nodeSnapshots[nodeId] = {
        ...nodeSnapshots[nodeId],
        status: "success",
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        itemCount: previewSource.length,
        summary: result.summary,
        outputPreview: buildPreview(previewSource),
      };

      logs.push(`${node.data.label}: ${result.summary ?? "completed"}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown node execution error";
      nodeSnapshots[nodeId] = {
        ...nodeSnapshots[nodeId],
        status: "error",
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        itemCount: input.items.length,
        error: message,
        summary: message,
      };
      applyNodePatch(nodePatches, nodeId, {
        notes: message,
      });
      logs.push(`${node.data.label}: ERROR ${message}`);
    }
  }

  const hasError = Object.values(nodeSnapshots).some(
    (snapshot) => snapshot.status === "error",
  );
  const itemsProcessed = Object.values(nodeSnapshots).reduce(
    (sum, snapshot) => sum + (snapshot.itemCount ?? 0),
    0,
  );

  return {
    executionStatus: hasError ? "error" : "success",
    itemsProcessed,
    response,
    nodeSnapshots,
    nodePatches,
    updatedStore,
    logs,
  };
}
