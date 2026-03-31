import { v4 as uuidv4 } from "uuid";
import type { Edge } from "@xyflow/react";
import type { AppNode, Project, Workflow, WorkflowNodeData } from "@/lib/flow-types";
import type { NodeTypeId } from "@/lib/node-catalog";
import { assertSafeUserCode } from "@/lib/code-safety";
import { expandSemanticRecord } from "@/lib/data-semantics";
import { executeProgrammableNode, inferNodeProgrammingContext } from "@/lib/node-programming";
import { buildWorkflowIntelligenceGraph, getActiveIncomingNodes } from "@/lib/workflow-intelligence";
import type {
  ProjectRuntimeStore,
  RuntimeArtifact,
  RuntimeCollectionRecord,
  RuntimeEnvelope,
  RuntimeEvaluationContext,
  RuntimeItem,
  RuntimeNodePatch,
  RuntimeReportItem,
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

function describeRuntimeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown runtime error";
    }
  }
  return "Unknown runtime error";
}

function buildRecordsArtifact(items: Array<Record<string, unknown>>) {
  if (!items.length) return null;

  return {
    kind: "records" as const,
    rows: deepClone(items),
    rowCount: items.length,
  };
}

function composeEnvelopeArtifacts(
  items: Array<Record<string, unknown>>,
  artifacts: RuntimeArtifact[] = [],
) {
  const nextArtifacts = deepClone(artifacts).filter((artifact) => artifact.kind !== "records");
  const recordsArtifact = buildRecordsArtifact(items);

  return recordsArtifact ? [recordsArtifact, ...nextArtifacts] : nextArtifacts;
}

function createEnvelope(
  items: Array<Record<string, unknown>>,
  meta: Record<string, unknown> = {},
  artifacts: RuntimeArtifact[] = [],
): RuntimeEnvelope {
  const normalizedItems = items.map((item) => ({ json: deepClone(item) }));

  return {
    items: normalizedItems,
    meta: deepClone(meta),
    artifacts: composeEnvelopeArtifacts(
      normalizedItems.map((item) => item.json),
      artifacts,
    ),
  };
}

function cloneEnvelope(envelope: RuntimeEnvelope): RuntimeEnvelope {
  return createEnvelope(
    envelope.items.map((item) => item.json),
    envelope.meta,
    envelope.artifacts,
  );
}

function mergeEnvelopes(envelopes: RuntimeEnvelope[]) {
  if (!envelopes.length) {
    return createEnvelope([]);
  }

  return createEnvelope(
    envelopes.flatMap((envelope) => envelope.items.map((item) => item.json)),
    Object.assign({}, ...envelopes.map((envelope) => deepClone(envelope.meta))),
    envelopes.flatMap((envelope) =>
      envelope.artifacts.filter((artifact) => artifact.kind !== "records"),
    ),
  );
}

function getForwardedArtifacts(
  envelope: RuntimeEnvelope,
  artifacts: RuntimeArtifact[] = [],
) {
  return [
    ...envelope.artifacts.filter((artifact) => artifact.kind !== "records"),
    ...artifacts,
  ];
}

function getLatestArtifact<TKind extends RuntimeArtifact["kind"]>(
  envelope: RuntimeEnvelope,
  kind: TKind,
) {
  const match = [...envelope.artifacts]
    .reverse()
    .find(
      (
        artifact,
      ): artifact is Extract<RuntimeArtifact, { kind: TKind }> => artifact.kind === kind,
    );

  return match ?? null;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getNodeParameter(node: AppNode, label: string) {
  const parameters = node.data.parameters ?? {};
  const match = Object.entries(parameters).find(([key]) => normalizeKey(key) === normalizeKey(label));
  const value = match?.[1];

  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
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
  input: RuntimeEnvelope,
  context: RuntimeEvaluationContext,
) {
  const expressionOnly = value.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/);
  const semanticItem = expandSemanticRecord(item);
  const inputItems = input.items.map((entry) => expandSemanticRecord(entry.json));
  const firstInputItem = inputItems[0] ?? semanticItem;

  const resolveExpression = (expression: string) => {
    if (expression === "$now") return new Date().toISOString();
    if (expression.startsWith("$json.")) return getValueAtPath(semanticItem, expression.slice(6));
    if (expression === "$json") return semanticItem;
    if (expression.startsWith("$meta.")) return getValueAtPath(context.request.payload ?? {}, expression.slice(6));
    if (expression === "input.first") return firstInputItem;
    if (expression.startsWith("input.first.")) {
      return getValueAtPath(firstInputItem, expression.slice("input.first.".length));
    }
    if (expression === "input.items") return inputItems;
    if (expression === "input.count") return input.items.length;
    if (expression === "input.meta") return input.meta;
    if (expression.startsWith("input.meta.")) {
      return getValueAtPath(input.meta, expression.slice("input.meta.".length));
    }
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
  input: RuntimeEnvelope,
  context: RuntimeEvaluationContext,
) {
  const resolved = resolveTemplateValue(rawValue, item, input, context);
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

function getActiveStoreNamesForNode(workflow: Workflow, nodeId: string) {
  return Array.from(
    new Set(
      getActiveIncomingNodes(workflow, nodeId)
        .filter((incomingNode) => incomingNode.data.nodeType === "analytics_store")
        .map((incomingNode) => getNodeParameter(incomingNode, "Store Name"))
        .filter(Boolean),
    ),
  );
}

function trimStoreLabel(label: string) {
  return label
    .replace(/^store\s*:\s*/i, "")
    .replace(/^store\s+/i, "")
    .trim();
}

function deriveComparisonSourceKey(storeName: string, label: string) {
  return slugify(
    storeName
      .replace(/^obs_/i, "")
      .replace(/^ab_/i, "")
      .trim() || label,
  );
}

function inferComparisonMetric(node: AppNode, sourceLabels: string[]) {
  const explicit = getNodeParameter(node, "Metric");
  if (explicit) return explicit;

  const combined = `${node.data.label} ${node.data.description ?? ""} ${sourceLabels.join(" ")}`;
  const normalized = normalizeKey(combined);

  if (normalized.includes("error") || normalized.includes("erro")) return "Error Logs";
  if (normalized.includes("revenue") || normalized.includes("receita")) return "Revenue";
  if (normalized.includes("user") || normalized.includes("usuario")) return "Users";
  return "Volume";
}

function getComparisonRecordValue(
  payload: Record<string, unknown>,
  metric: string,
) {
  const normalizedMetric = normalizeKey(metric);

  if (normalizedMetric.includes("revenue") || normalizedMetric.includes("receita")) {
    return toNumber(payload.amount ?? payload.revenue ?? payload.value ?? payload.total ?? 0);
  }

  if (normalizedMetric.includes("user") || normalizedMetric.includes("usuario")) {
    return toNumber(payload.users ?? payload.userCount ?? payload.count ?? payload.total ?? 1);
  }

  if (normalizedMetric.includes("error") || normalizedMetric.includes("erro")) {
    const explicit =
      payload.errorCount ??
      payload.errors ??
      payload.occurrences ??
      payload.count ??
      payload.total ??
      payload.value;
    return explicit !== undefined ? Math.max(0, toNumber(explicit)) : 1;
  }

  const explicit = payload.value ?? payload.total ?? payload.count ?? payload.amount;
  return explicit !== undefined ? Math.max(0, toNumber(explicit)) : 1;
}

function buildComparisonSourcesFromStoreNodes(
  node: AppNode,
  context: RuntimeEvaluationContext,
) {
  const incomingStores = getActiveIncomingNodes(context.workflow, node.id).filter(
    (incomingNode) => incomingNode.data.nodeType === "analytics_store",
  );
  const metric = inferComparisonMetric(
    node,
    incomingStores.map((storeNode) => trimStoreLabel(storeNode.data.label)),
  );

  const sources = incomingStores
    .map((storeNode) => {
      const storeName = getNodeParameter(storeNode, "Store Name");
      if (!storeName) return null;

      const records = getCollectionRecords(context.store, storeName);
      const label = trimStoreLabel(storeNode.data.label || storeName);
      const value = records.reduce(
        (sum, record) => sum + getComparisonRecordValue(record.payload, metric),
        0,
      );

      return {
        key: deriveComparisonSourceKey(storeName, label),
        label,
        storeName,
        value,
        count: records.length,
      };
    })
    .filter(
      (
        source,
      ): source is {
        key: string;
        label: string;
        storeName: string;
        value: number;
        count: number;
      } => Boolean(source),
    );

  return { metric, sources };
}

function buildComparisonSourcesFromItems(
  node: AppNode,
  items: RuntimeItem[],
) {
  const groups = new Map<string, RuntimeItem[]>();
  const metric = inferComparisonMetric(node, []);

  items.forEach((item) => {
    const key = String(
      item.json.sourceArea ??
        item.json.source_area ??
        item.json.source ??
        item.json.channel ??
        item.json.label ??
        "source",
    );
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(item);
  });

  const sources = Array.from(groups.entries()).map(([rawKey, group]) => {
    const label = rawKey
      .split("_")
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
    const value = group.reduce(
      (sum, item) => sum + getComparisonRecordValue(item.json, metric),
      0,
    );

    return {
      key: slugify(rawKey),
      label: label || "Source",
      storeName: undefined,
      value,
      count: group.length,
    };
  });

  return { metric, sources };
}

function formatMetricNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString();
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function getRowsFromEnvelope(envelope: RuntimeEnvelope) {
  const tableArtifact = getLatestArtifact(envelope, "table");
  if (tableArtifact?.rows.length) {
    return tableArtifact.rows.map((row) => expandSemanticRecord(row));
  }

  const aiSummaryArtifact = getLatestArtifact(envelope, "ai_summary");
  if (aiSummaryArtifact?.sourceRows?.length) {
    return aiSummaryArtifact.sourceRows.map((row) => expandSemanticRecord(row));
  }

  const recordsArtifact = getLatestArtifact(envelope, "records");
  if (recordsArtifact?.rows.length) {
    return recordsArtifact.rows.map((row) => expandSemanticRecord(row));
  }

  return envelope.items.map((item) => expandSemanticRecord(item.json));
}

function getColumnsFromEnvelope(
  envelope: RuntimeEnvelope,
  rows = getRowsFromEnvelope(envelope),
) {
  const tableArtifact = getLatestArtifact(envelope, "table");
  if (tableArtifact?.columns.length) return tableArtifact.columns;

  return Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => {
        set.add(key);
      });
      return set;
    }, new Set<string>()),
  );
}

function getNumericValueFromRow(row: Record<string, unknown>) {
  return toNumber(
    row.value ??
      row.total ??
      row.amount ??
      row.metric ??
      row.count ??
      0,
  );
}

function extractSeries(envelope: RuntimeEnvelope) {
  const seriesArtifact = getLatestArtifact(envelope, "series");
  if (seriesArtifact?.series.length) return seriesArtifact.series;

  const comparisonArtifact = getLatestArtifact(envelope, "comparison");
  if (comparisonArtifact?.sources.length) {
    return comparisonArtifact.sources.map((source) => ({
      label: source.label,
      value: source.value,
    }));
  }

  const funnelArtifact = getLatestArtifact(envelope, "funnel");
  if (funnelArtifact?.stages.length) {
    return funnelArtifact.stages.map((stage) => ({
      label: stage.label,
      value: stage.value,
    }));
  }

  return getRowsFromEnvelope(envelope).map((row, index) => {
    const label = String(
      row.date ??
        row.day ??
        row.name ??
        row.label ??
        row.title ??
        row.nodeLabel ??
        row.event ??
        row.source ??
        `Item ${index + 1}`,
    );
    const value = getNumericValueFromRow(row);

    return { label, value };
  });
}

function findComparisonSourceForMetric(
  node: AppNode,
  comparisonArtifact: Extract<RuntimeArtifact, { kind: "comparison" }>,
) {
  const configuredSourceKey =
    typeof node.data.config?.comparisonSourceKey === "string"
      ? String(node.data.config?.comparisonSourceKey)
      : "";
  if (configuredSourceKey) {
    return (
      comparisonArtifact.sources.find((source) => source.key === configuredSourceKey) ?? null
    );
  }

  const normalizedLabel = normalizeKey(node.data.label);
  return (
    comparisonArtifact.sources.find((source) => {
      const sourceLabel = normalizeKey(source.label);
      return (
        normalizedLabel.includes(sourceLabel) ||
        normalizedLabel.includes(normalizeKey(source.key).replace(/_/g, " "))
      );
    }) ?? null
  );
}

function summarizeMetric(node: AppNode, envelope: RuntimeEnvelope, fallbackLabel: string) {
  const metricArtifact = getLatestArtifact(envelope, "metric");
  if (metricArtifact) {
    return {
      value: metricArtifact.value,
      rawValue: metricArtifact.rawValue,
      trend: metricArtifact.trend ?? "",
      compareLabel: metricArtifact.compareLabel ?? "vs previous period",
      metricLabel: metricArtifact.label ?? fallbackLabel,
    };
  }

  const comparisonArtifact = getLatestArtifact(envelope, "comparison");
  if (comparisonArtifact) {
    const normalizedLabel = normalizeKey(node.data.label);
    const configuredMode =
      typeof node.data.config?.comparisonMetricMode === "string"
        ? normalizeKey(String(node.data.config?.comparisonMetricMode))
        : "";
    const matchedSource = findComparisonSourceForMetric(node, comparisonArtifact);
    const leaderSource =
      comparisonArtifact.sources.find((source) => source.label === comparisonArtifact.leader) ??
      comparisonArtifact.sources[0];

    if (matchedSource) {
      return {
        value: formatMetricNumber(matchedSource.value),
        rawValue: matchedSource.value,
        trend: `${(matchedSource.share * 100).toFixed(1)}% of total`,
        compareLabel: comparisonArtifact.metric.toLowerCase(),
        metricLabel: matchedSource.label,
      };
    }

    if (
      configuredMode === "leader" ||
      normalizedLabel.includes("leader") ||
      normalizedLabel.includes("noisiest") ||
      normalizedLabel.includes("top source") ||
      normalizedLabel.includes("maior") ||
      normalizedLabel.includes("mais erro")
    ) {
      return {
        value: leaderSource?.label ?? "Pending",
        rawValue: leaderSource?.value,
        trend: leaderSource
          ? `${formatMetricNumber(leaderSource.value)} ${comparisonArtifact.metric.toLowerCase()}`
          : "",
        compareLabel: "top source",
        metricLabel: fallbackLabel,
      };
    }

    if (
      configuredMode === "delta" ||
      normalizedLabel.includes("delta") ||
      normalizedLabel.includes("difference") ||
      normalizedLabel.includes("diferenca")
    ) {
      return {
        value: formatMetricNumber(comparisonArtifact.delta),
        rawValue: comparisonArtifact.delta,
        trend: `${comparisonArtifact.sourceCount} active source(s)`,
        compareLabel: comparisonArtifact.metric.toLowerCase(),
        metricLabel: fallbackLabel,
      };
    }

    if (
      configuredMode === "total" ||
      normalizedLabel.includes("total") ||
      normalizedLabel.includes("overall") ||
      normalizedLabel.includes("geral")
    ) {
      return {
        value: formatMetricNumber(comparisonArtifact.total),
        rawValue: comparisonArtifact.total,
        trend: `${comparisonArtifact.sourceCount} active source(s)`,
        compareLabel: comparisonArtifact.metric.toLowerCase(),
        metricLabel: fallbackLabel,
      };
    }

    return {
      value: leaderSource?.label ?? formatMetricNumber(comparisonArtifact.total),
      rawValue: leaderSource?.value ?? comparisonArtifact.total,
      trend: leaderSource
        ? `${formatMetricNumber(leaderSource.value)} ${comparisonArtifact.metric.toLowerCase()}`
        : "",
      compareLabel: comparisonArtifact.metric.toLowerCase(),
      metricLabel: fallbackLabel,
    };
  }

  const first = expandSemanticRecord(envelope.items[0]?.json ?? {});
  const explicitValue = first.value ?? first.total ?? first.metric ?? first.amount;
  const explicitTrend = first.trend ?? first.delta;
  const total =
    explicitValue !== undefined
      ? explicitValue
      : getRowsFromEnvelope(envelope).reduce((sum, row) => sum + getNumericValueFromRow(row), 0);
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
    rawValue: typeof total === "number" || typeof total === "string" ? total : undefined,
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
  const activeColumns = columns?.length
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

function getReportItemsFromEnvelope(envelope: RuntimeEnvelope) {
  const reportArtifact = getLatestArtifact(envelope, "report");
  if (reportArtifact?.reportItems.length) return reportArtifact.reportItems;

  const aiSummaryArtifact = getLatestArtifact(envelope, "ai_summary");
  if (aiSummaryArtifact?.reportItems?.length) return aiSummaryArtifact.reportItems;

  const comparisonArtifact = getLatestArtifact(envelope, "comparison");
  if (comparisonArtifact?.sources.length) {
    return comparisonArtifact.sources.map((source) => ({
      label: source.label,
      value: formatMetricNumber(source.value),
      delta: `${(source.share * 100).toFixed(1)}% share`,
      positive: source.label === comparisonArtifact.leader,
    }));
  }

  const rows = getRowsFromEnvelope(envelope);
  const columns = getColumnsFromEnvelope(envelope, rows);

  return buildReportItemsFromObjects(rows, columns);
}

function getInsightFromEnvelope(envelope: RuntimeEnvelope) {
  const reportArtifact = getLatestArtifact(envelope, "report");
  if (reportArtifact?.insight) return reportArtifact.insight;

  const aiSummaryArtifact = getLatestArtifact(envelope, "ai_summary");
  if (aiSummaryArtifact?.summary) return aiSummaryArtifact.summary;

  const comparisonArtifact = getLatestArtifact(envelope, "comparison");
  if (comparisonArtifact?.sources.length) {
    if (comparisonArtifact.sourceCount === 1) {
      return `Tracking 1 active source: ${comparisonArtifact.sources[0]?.label}.`;
    }

    if (comparisonArtifact.leader) {
      return `${comparisonArtifact.leader} currently leads ${comparisonArtifact.metric.toLowerCase()} volume across ${comparisonArtifact.sourceCount} active sources.`;
    }
  }

  const first = expandSemanticRecord(envelope.items[0]?.json ?? {});
  return String(first.insight ?? first.summary ?? first.message ?? "");
}

function getFunnelStagesFromEnvelope(envelope: RuntimeEnvelope) {
  const funnelArtifact = getLatestArtifact(envelope, "funnel");
  if (funnelArtifact?.stages.length) return funnelArtifact.stages;

  return getRowsFromEnvelope(envelope).map((row, index) => ({
    label: String(row.label ?? row.name ?? row.title ?? row.nodeLabel ?? `Stage ${index + 1}`),
    value: toNumber(row.value ?? row.total ?? row.amount ?? row.count),
  }));
}

function normalizeAiReportItems(items: unknown): RuntimeReportItem[] | undefined {
  if (!Array.isArray(items)) return undefined;

  const normalized = items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, index) => ({
      label: String(item.label ?? item.name ?? `Item ${index + 1}`),
      value: formatReportValue(item.value ?? item.total ?? item.amount ?? ""),
      delta: formatReportValue(item.delta ?? item.trend ?? item.change ?? ""),
      positive: !String(item.delta ?? item.trend ?? item.change ?? "").startsWith("-"),
    }));

  return normalized.length ? normalized : undefined;
}

function normalizeAiSummaryMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      summary: "",
      reportItems: undefined as RuntimeReportItem[] | undefined,
    };
  }

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return {
      summary: trimmed,
      reportItems: undefined as RuntimeReportItem[] | undefined,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        summary: trimmed,
        reportItems: undefined as RuntimeReportItem[] | undefined,
      };
    }

    const record = parsed as Record<string, unknown>;
    const summarySource =
      record.summary ?? record.insight ?? record.message ?? record.result ?? trimmed;

    return {
      summary:
        typeof summarySource === "string"
          ? summarySource
          : JSON.stringify(summarySource),
      reportItems: normalizeAiReportItems(record.reportItems),
    };
  } catch {
    return {
      summary: trimmed,
      reportItems: undefined as RuntimeReportItem[] | undefined,
    };
  }
}

function classifyError(item: Record<string, unknown>) {
  const message = String(item.message ?? item.error ?? item.stack ?? "");
  const level = String(
    item.level ?? item.errorLevel ?? item.logLevel ?? item.severity ?? "error",
  ).toLowerCase();

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
  return nodeType === "action_merge" || nodeType === "analytics_compare";
}

function isTriggerNode(node: AppNode) {
  return node.data.nodeType.startsWith("trigger_");
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
  const programContext = inferNodeProgrammingContext(context.workflow, node.id);
  const programmableResult = executeProgrammableNode({
    node,
    input,
    context,
    inputSchema: programContext.inputSchema,
  });

  if (programmableResult) {
    return {
      outputs: Object.fromEntries(
        Object.entries(programmableResult.outputs ?? {}).map(([handle, rows]) => [
          handle,
          createEnvelope(
            rows,
            { ...input.meta, ...(programmableResult.meta ?? {}) },
            getForwardedArtifacts(input, programmableResult.artifacts),
          ),
        ]),
      ),
      patch: programmableResult.patch,
      summary: programmableResult.summary,
      response: programmableResult.response,
    };
  }

  switch (node.data.nodeType) {
    case "trigger_manual":
    case "trigger_webhook":
    case "trigger_schedule": {
      const payload = deepClone(
        context.request.payload ??
          ({
            event: node.data.nodeType,
            timestamp: new Date().toISOString(),
            workflowId: context.workflow.id,
            projectId: context.project.id,
          } satisfies Record<string, unknown>),
      );
      const tagField = getNodeParameter(node, "Tag Field");
      const tagValue = getNodeParameter(node, "Tag Value");

      if (tagField) {
        setValueAtPath(payload, tagField, materializeValue(tagValue, payload, input, context));
      }

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
        setValueAtPath(nextJson, fieldName, materializeValue(fieldValue, item.json, input, context));
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
            materializeValue(field, item.json, input, context),
            rule,
            materializeValue(expected, item.json, input, context),
          ),
        )
        .map((item) => item.json);

      return {
        outputs: { default: createEnvelope(filtered, input.meta) },
        summary: `${filtered.length}/${items.length} items matched`,
      };
    }

    case "action_if": {
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
        materializeValue(leftRaw, firstItem, input, context),
        operation,
        materializeValue(rightRaw, firstItem, input, context),
      );

      return {
        outputs: {
          [decision ? "true" : "false"]: cloneEnvelope(input),
        },
        summary: decision ? "Condition matched" : "Condition failed",
      };
    }

    case "action_switch": {
      const valueRaw =
        getNodeParameter(node, "Value") ||
        getNodeParameter(node, "Value 1") ||
        "{{ $json }}";
      const operation = getNodeParameter(node, "Operation") || "equals";
      const actualValue = materializeValue(valueRaw, firstItem, input, context);
      const cases = Array.from({ length: 4 }, (_, index) => {
        const caseIndex = index + 1;
        const expectedRaw = getNodeParameter(node, `Case ${caseIndex}`);

        return expectedRaw
          ? {
              handle: `case_${caseIndex}`,
              label: expectedRaw,
              expected: materializeValue(expectedRaw, firstItem, input, context),
            }
          : null;
      }).filter((entry): entry is { handle: string; label: string; expected: unknown } => Boolean(entry));
      const matchedCase = cases.find((entry) =>
        compareValues(actualValue, operation, entry.expected),
      );

      return {
        outputs: {
          [matchedCase?.handle ?? "default"]: cloneEnvelope(input),
        },
        summary: matchedCase
          ? `Matched ${matchedCase.label}`
          : "No switch case matched",
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
      const batches: Array<{
        batchIndex: number;
        items: Array<Record<string, unknown>>;
        size: number;
      }> = [];

      for (let index = 0; index < items.length; index += safeBatchSize) {
        batches.push({
          batchIndex: Math.floor(index / safeBatchSize),
          items: items.slice(index, index + safeBatchSize).map((item) => item.json),
          size: Math.min(safeBatchSize, items.length - index),
        });
      }

      const forwardedItems = batches.flatMap((batch) =>
        batch.items.map((item) => ({
          ...item,
          batchIndex: batch.batchIndex,
          batchSize: batch.size,
          batchCount: batches.length,
        })),
      );

      return {
        outputs: {
          default: createEnvelope(forwardedItems, {
            batches: batches.length,
            batchSize: safeBatchSize,
          }),
        },
        summary: `${batches.length} batch(es) from ${items.length} item(s)`,
      };
    }

    case "action_code":
    case "action_function": {
      const code = getNodeParameter(node, "Code") || "return items.map((item) => item.json);";
      assertSafeUserCode(code, "Codigo runtime do node");
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
      const storeName = getNodeParameter(node, "Store Name");
      if (!storeName) {
        return {
          outputs: {},
          summary: "Store skipped because no active store name is configured",
        };
      }
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
        const values = items.map((item) => toNumber(materializeValue(field, item.json, input, context)));
        const total =
          aggregation === "count"
            ? values.length
            : values.reduce((sum, value) => sum + value, 0);
        const metricValue = formatReportValue(total);
        return {
          outputs: {
            default: createEnvelope(
              [{ label: node.data.label, total, aggregation, field }],
              {
                total,
              },
              [
                {
                  kind: "metric",
                  label: node.data.label,
                  value: metricValue,
                  rawValue: total,
                  compareLabel: `${aggregation} of ${field}`,
                },
              ],
            ),
          },
          summary: `${aggregation} => ${total}`,
        };
      }

      const buckets = new Map<string, number>();
      items.forEach((item) => {
        const groupKey = String(materializeValue(groupBy, item.json, input, context) ?? "unknown");
        const value =
          aggregation === "count" ? 1 : toNumber(materializeValue(field, item.json, input, context));
        buckets.set(groupKey, (buckets.get(groupKey) ?? 0) + value);
      });

      const rows = Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));

      return {
        outputs: {
          default: createEnvelope(rows, { groups: rows.length }, [
            {
              kind: "table",
              label: node.data.label,
              columns: ["label", "value"],
              rows,
              rowCount: rows.length,
            },
            {
              kind: "series",
              label: node.data.label,
              chartType: "line",
              series: rows.map((row) => ({
                label: String(row.label),
                value: toNumber(row.value),
              })),
            },
          ]),
        },
        summary: `${rows.length} aggregate bucket(s)`,
      };
    }

    case "analytics_compare": {
      const preferredSourceLabels = [
        getNodeParameter(node, "Input A Label"),
        getNodeParameter(node, "Input B Label"),
      ].filter(Boolean);
      const fromStores = buildComparisonSourcesFromStoreNodes(node, context);
      const fallbackGroups = buildComparisonSourcesFromItems(node, items);
      const metric = fromStores.sources.length ? fromStores.metric : fallbackGroups.metric;
      const rawSources = fromStores.sources.length ? fromStores.sources : fallbackGroups.sources;
      const total = rawSources.reduce((sum, source) => sum + source.value, 0);
      const sortedSources = [...rawSources].sort((left, right) => right.value - left.value);
      const leader = sortedSources[0] ?? null;
      const runnerUp = sortedSources[1] ?? null;
      const sources = rawSources.map((source, index) => ({
        ...source,
        label: source.label || preferredSourceLabels[index] || `Source ${index + 1}`,
        share: total > 0 ? source.value / total : 0,
      }));
      const rows = sources.map((source) => ({
        source: source.label,
        key: source.key,
        metric,
        value: source.value,
        count: source.count,
        share: `${(source.share * 100).toFixed(1)}%`,
      }));
      const delta = leader && runnerUp ? leader.value - runnerUp.value : leader?.value ?? 0;
      const reportItems = sources.map((source) => ({
        label: source.label,
        value: formatMetricNumber(source.value),
        delta: `${(source.share * 100).toFixed(1)}% share`,
        positive: source.label === leader?.label,
      }));
      const insight =
        sources.length <= 1
          ? `Tracking 1 active source: ${sources[0]?.label ?? "Source"}.`
          : `${leader?.label ?? "Top source"} currently leads ${metric.toLowerCase()} volume with ${formatMetricNumber(leader?.value ?? 0)}.`;

      return {
        outputs: {
          default: createEnvelope(
            [
              {
                metric,
                total,
                delta,
                sourceCount: sources.length,
                leader: leader?.label ?? "",
                leaderValue: leader?.value ?? 0,
                sources,
              },
            ],
            {
              comparisonMetric: metric,
            },
            [
              {
                kind: "comparison",
                label: node.data.label,
                metric,
                total,
                delta,
                sourceCount: sources.length,
                leader: leader?.label,
                leaderValue: leader?.value,
                sources,
              },
              {
                kind: "series",
                label: metric,
                chartType: "bar",
                series: sources.map((source) => ({
                  label: source.label,
                  value: source.value,
                })),
              },
              {
                kind: "table",
                label: metric,
                columns: ["source", "value", "count", "share"],
                rows,
                rowCount: rows.length,
              },
              {
                kind: "report",
                label: node.data.label,
                insight,
                reportItems,
              },
            ],
          ),
        },
        summary:
          sources.length > 1
            ? `${metric}: ${sources.map((source) => source.label).join(" vs ")}`
            : `${metric}: ${sources[0]?.label ?? "No active source"}`,
      };
    }

    case "analytics_ab": {
      const minimumSample = Number(getNodeParameter(node, "Minimum Sample") || 100);
      const activeStoreNames = getActiveStoreNamesForNode(context.workflow, node.id);
      const storeNames = activeStoreNames.length
        ? activeStoreNames
        : getNodeParameter(node, "Store Names")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
      const variantField = getNodeParameter(node, "Variant Field") || "variant";
      const conversionField = getNodeParameter(node, "Conversion Field") || "converted";
      const revenueField = getNodeParameter(node, "Revenue Field") || "amount";
      const baseline = getNodeParameter(node, "Baseline");
      const sourceItems =
        storeNames.length > 0
          ? storeNames.flatMap((storeName) =>
              getCollectionRecords(context.store, storeName).map((record) => ({
                json: deepClone(record.payload),
              })),
            )
          : items;
      const grouped = new Map<string, RuntimeItem[]>();
      const variantDetected = sourceItems.some(
        (item) =>
          getValueAtPath(item.json, variantField) !== undefined || item.json.variant !== undefined,
      );

      if (variantDetected) {
        sourceItems.forEach((item) => {
          const key = String(
            getValueAtPath(item.json, variantField) ??
              item.json.variant ??
              item.json.experiment_variant ??
              "unknown",
          );
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)?.push(item);
        });
      } else {
        const half = Math.max(1, Math.floor(sourceItems.length / 2));
        grouped.set("control", sourceItems.slice(0, half));
        grouped.set("treatment", sourceItems.slice(half));
      }

      const rows = Array.from(grouped.entries()).map(([label, group]) => {
        const conversions = group.filter((item) =>
          toBoolean(
            getValueAtPath(item.json, conversionField) ??
              item.json.converted ??
              item.json.success,
          ),
        ).length;
        const users = group.length;
        const rate = users ? conversions / users : 0;
        const revenue = group.reduce(
          (sum, item) =>
            sum +
            toNumber(
              getValueAtPath(item.json, revenueField) ??
                item.json.amount ??
                item.json.revenue ??
                item.json.value ??
                0,
            ),
          0,
        );

        return {
          label,
          users,
          conversions,
          rate,
          revenue,
        };
      });

      const baselineRow =
        rows.find((row) => row.label === baseline) ??
        rows[0] ??
        {
          label: "baseline",
          users: 0,
          conversions: 0,
          rate: 0,
          revenue: 0,
        };
      const eligibleRows = rows.filter((row) => row.users >= minimumSample);
      const winnerRow = eligibleRows
        .slice()
        .sort((left, right) => {
          if (right.rate !== left.rate) return right.rate - left.rate;
          return right.revenue - left.revenue;
        })[0];
      const winner = winnerRow?.label ?? "insufficient_sample";
      const winningRate = winnerRow ? Number((winnerRow.rate * 100).toFixed(2)) : 0;
      const insight =
        winner === "insufficient_sample"
          ? `Need at least ${minimumSample} users per variant before declaring a winner.`
          : `${winner} leads with ${winningRate}% conversion from ${winnerRow?.conversions ?? 0}/${winnerRow?.users ?? 0} users.`;
      const reportItems = rows.map((row) => {
        const diff = row.rate - baselineRow.rate;
        return {
          label: row.label,
          value: `${(row.rate * 100).toFixed(2)}%`,
          delta:
            row.label === baselineRow.label
              ? `${row.conversions}/${row.users} conv`
              : `${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(2)}pp vs ${baselineRow.label}`,
          positive: row.label === baselineRow.label ? true : diff >= 0,
        };
      });

      return {
        outputs: {
          default: createEnvelope(
            [
              {
                winner,
                winningRate,
                winningUsers: winnerRow?.users ?? 0,
                winningConversions: winnerRow?.conversions ?? 0,
                minimumSample,
                variants: rows.map((row) => ({
                  label: row.label,
                  users: row.users,
                  conversions: row.conversions,
                  conversionRate: Number((row.rate * 100).toFixed(2)),
                  revenue: row.revenue,
                })),
              },
            ],
            {},
            [
              {
                kind: "series",
                label: node.data.label,
                chartType: "bar",
                series: rows.map((row) => ({
                  label: row.label,
                  value: Number((row.rate * 100).toFixed(2)),
                })),
              },
              {
                kind: "table",
                label: node.data.label,
                columns: ["label", "users", "conversions", "conversionRate", "revenue"],
                rows: rows.map((row) => ({
                  label: row.label,
                  users: row.users,
                  conversions: row.conversions,
                  conversionRate: `${(row.rate * 100).toFixed(2)}%`,
                  revenue: row.revenue,
                })),
                rowCount: rows.length,
              },
              {
                kind: "metric",
                label: "Winner",
                value: winner === "insufficient_sample" ? "Pending" : winner,
                rawValue: winner,
                compareLabel:
                  winner === "insufficient_sample"
                    ? `Need ${minimumSample}+ users`
                    : `${winningRate}% conversion`,
              },
              {
                kind: "report",
                label: node.data.label,
                insight,
                reportItems,
              },
            ],
          ),
        },
        summary: `Experiment winner: ${winner}`,
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
        outputs: {
          default: createEnvelope(rows, { funnel: true }, [
            {
              kind: "funnel",
              label: node.data.label,
              stages: rows.map((row) => ({
                label: String(row.label),
                value: toNumber(row.value),
              })),
            },
          ]),
        },
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
          const key = String(materializeValue(segmentField, item.json, input, context) ?? "unknown");
        if (values.length && !values.includes(key)) return;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });

      const rows = Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
      return {
        outputs: {
          default: createEnvelope(rows, {}, [
            {
              kind: "table",
              label: node.data.label,
              columns: ["label", "value"],
              rows,
              rowCount: rows.length,
            },
            {
              kind: "series",
              label: node.data.label,
              chartType: "bar",
              series: rows.map((row) => ({
                label: String(row.label),
                value: toNumber(row.value),
              })),
            },
          ]),
        },
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
      const acceptedLevels = levelFilter
        .split("+")
        .map((token) => normalizeKey(token))
        .filter(Boolean);
      const acceptAnyLevel =
        acceptedLevels.length === 0 ||
        acceptedLevels.some((token) => token.includes("all"));

      const rows = items
        .map((item) => ({
          ...item.json,
          ...classifyError(item.json),
        }))
        .filter((item) =>
          acceptAnyLevel
            ? true
            : acceptedLevels.some((token) =>
                String(item.level ?? "")
                  .toLowerCase()
                  .includes(token.split(" ")[0] ?? token),
              ),
        )
        .filter((item) => {
          if (!matcher) return true;
          const searchableRecord = item as Record<string, unknown>;
          const searchableText = [
            searchableRecord.message,
            searchableRecord.level,
            searchableRecord.category,
            searchableRecord.error,
            searchableRecord.stack,
          ]
            .filter(Boolean)
            .join(" ");
          return matcher.test(searchableText);
        });

      return {
        outputs: { default: createEnvelope(rows) },
        summary: `${rows.length} error(s) classified`,
      };
    }

    case "monitor_alert": {
      const threshold = Number(getNodeParameter(node, "Threshold") || 0);
      const comparisonArtifact = getLatestArtifact(input, "comparison");
      const field =
        getNodeParameter(node, "Field") ||
        (comparisonArtifact ? "{{ input.first.total }}" : "{{ $json.value }}");
      const channel = getNodeParameter(node, "Channel") || "log";

      const matches = items.filter(
        (item) => toNumber(materializeValue(field, item.json, input, context)) >= threshold,
      );
      const alertPayload = {
        triggered: matches.length > 0,
        threshold,
        matches: matches.length,
        channel,
      };

      return {
        outputs: {
          default: createEnvelope([alertPayload], { alert: alertPayload.triggered }, [
            {
              kind: "alert",
              label: node.data.label,
              triggered: alertPayload.triggered,
              threshold,
              matches: matches.length,
              channel,
            },
          ]),
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
      const formattedValue =
        payload.currency === "USD"
          ? `$${Math.round(total).toLocaleString()}`
          : `${Math.round(total).toLocaleString()} ${payload.currency}`;

      return {
        outputs: {
          default: createEnvelope([payload], { revenueMetric: metric }, [
            {
              kind: "metric",
              label: metric.toUpperCase(),
              value: formattedValue,
              rawValue: total,
              compareLabel: payload.currency,
            },
          ]),
        },
        summary: `${metric.toUpperCase()} ${total.toLocaleString()}`,
      };
    }

    case "action_slack": {
      const webhookUrl = getNodeParameter(node, "Webhook URL");
      const channel = getNodeParameter(node, "Channel");
      const messageTemplate =
        getNodeParameter(node, "Message") || JSON.stringify(firstItem);
      const message = String(materializeValue(messageTemplate, firstItem, input, context));

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
      const sourceRows = getRowsFromEnvelope(input);
      const sourceColumns = getColumnsFromEnvelope(input, sourceRows);
      const payloadText = JSON.stringify(
        {
          meta: input.meta,
          columns: sourceColumns,
          rows: sourceRows,
        },
        null,
        2,
      );

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
      const normalized = normalizeAiSummaryMessage(message);
      const reportItems =
        normalized.reportItems ?? buildReportItemsFromObjects(sourceRows, sourceColumns);

      return {
        outputs: {
          default: createEnvelope(
            [
              {
                insight: normalized.summary,
                summary: normalized.summary,
                model,
                status: response.status,
                reportItems,
                rowCount: sourceRows.length,
              },
            ],
            {
              ...input.meta,
              ai: true,
            },
            getForwardedArtifacts(input, [
              {
                kind: "ai_summary",
                label: node.data.label,
                summary: normalized.summary,
                model,
                status: response.status,
                sourceRows,
                columns: sourceColumns,
                reportItems,
              },
              {
                kind: "report",
                label: node.data.label,
                insight: normalized.summary,
                reportItems,
              },
            ]),
          ),
        },
        summary: "AI insight generated",
        patch: {
          notes: normalized.summary.slice(0, 240),
        },
      };
    }

    case "viz_metric": {
      const metric = summarizeMetric(node, input, node.data.label);
      return {
        outputs: {
          default: createEnvelope(
            [
              {
                label: metric.metricLabel,
                value: metric.rawValue ?? metric.value,
                formattedValue: metric.value,
                trend: metric.trend,
                compareLabel: metric.compareLabel,
              },
            ],
            input.meta,
            getForwardedArtifacts(input, [
              {
                kind: "metric",
                label: metric.metricLabel,
                value: metric.value,
                rawValue: metric.rawValue,
                trend: metric.trend,
                compareLabel: metric.compareLabel,
              },
            ]),
          ),
        },
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
      const series = extractSeries(input);
      const chartType = String(node.data.config?.chartType ?? node.data.chartType ?? "line");
      return {
        outputs: {
          default: createEnvelope(
            series.map((entry) => ({
              label: entry.label,
              value: entry.value,
            })),
            input.meta,
            getForwardedArtifacts(input, [
              {
                kind: "series",
                label: node.data.label,
                chartType:
                  chartType === "bar" || chartType === "area" ? chartType : "line",
                series,
              },
            ]),
          ),
        },
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
      const rows = getRowsFromEnvelope(input);
      const columns = getColumnsFromEnvelope(input, rows);

      return {
        outputs: {
          default: createEnvelope(
            rows,
            input.meta,
            getForwardedArtifacts(input, [
              {
                kind: "table",
                label: node.data.label,
                columns,
                rows,
                rowCount: rows.length,
              },
            ]),
          ),
        },
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
      const reportItems = getReportItemsFromEnvelope(input);
      const insight =
        getInsightFromEnvelope(input) || String(getNodeConfigValue(node, "insight") ?? "");

      return {
        outputs: {
          default: createEnvelope(
            [
              {
                reportTitle: String(getNodeConfigValue(node, "reportTitle") ?? node.data.label),
                insight,
                reportItems,
              },
            ],
            input.meta,
            getForwardedArtifacts(input, [
              {
                kind: "report",
                label: node.data.label,
                insight,
                reportItems,
              },
            ]),
          ),
        },
        summary: `Report updated with ${reportItems.length} row(s)`,
        patch: {
          config: {
            ...(node.data.config ?? {}),
            reportItems,
            insight,
          },
        },
      };
    }

    case "viz_funnel": {
      const stages = getFunnelStagesFromEnvelope(input);

      return {
        outputs: {
          default: createEnvelope(
            stages.map((stage) => ({
              label: stage.label,
              value: stage.value,
            })),
            input.meta,
            getForwardedArtifacts(input, [
              {
                kind: "funnel",
                label: node.data.label,
                stages,
              },
            ]),
          ),
        },
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

function resolveEntryNodes(
  workflow: Workflow,
  request: WorkflowExecutionRequest,
  incomingCounts: Record<string, number>,
) {
  if (request.triggerNodeId) {
    const explicitNode = workflow.nodes.find((node) => node.id === request.triggerNodeId);
    return explicitNode ? [explicitNode] : [];
  }

  const sourceTriggers = workflow.nodes.filter((node) => {
    if (!isTriggerNode(node)) return false;

    if (request.source === "webhook") {
      return node.data.nodeType === "trigger_webhook";
    }

    if (request.source === "schedule") {
      return node.data.nodeType === "trigger_schedule";
    }

    return true;
  });

  if (sourceTriggers.length) return sourceTriggers;

  const rootNodes = workflow.nodes.filter((node) => (incomingCounts[node.id] ?? 0) === 0);
  if (rootNodes.length) return rootNodes;

  return workflow.nodes.length ? [workflow.nodes[0]] : [];
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
  const graph = buildWorkflowIntelligenceGraph(workflow);
  const activeEdges = graph.activeEdges;
  const incomingCounts = buildIncomingCounts(activeEdges);
  const entryNodes = resolveEntryNodes(workflow, request, incomingCounts);
  if (!entryNodes.length) {
    throw new Error("No starting node found for this workflow.");
  }

  const entryNodeIds = new Set(entryNodes.map((node) => node.id));
  const bootstrapPayload =
    request.payload ??
    ({
      event: `${request.source}_run`,
      timestamp: new Date().toISOString(),
      workflowId: workflow.id,
      projectId: project.id,
      source: request.source,
    } satisfies Record<string, unknown>);

  const updatedStore = deepClone(store);
  const outgoingMap = buildOutgoingMap(activeEdges);
  const nodesById = Object.fromEntries(
    workflow.nodes.map((node) => [node.id, node]),
  ) as Record<string, AppNode>;
  const nodeSnapshots = createInitialSnapshots(workflow);
  const nodePatches: RuntimeNodePatch[] = [];
  const logs: string[] = [];
  const pendingInputs: Record<string, RuntimeEnvelope[]> = Object.fromEntries(
    entryNodes.map((node) => [
      node.id,
      [
        isTriggerNode(node)
          ? createEnvelope([], {})
          : createEnvelope([deepClone(bootstrapPayload)], {
              source: request.source,
              bootstrap: true,
            }),
      ],
    ]),
  );
  const queued = new Set<string>(entryNodes.map((node) => node.id));
  const queue: string[] = entryNodes.map((node) => node.id);
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
    if (!graph.reachableNodeIds.has(nodeId) && !entryNodeIds.has(nodeId)) continue;

    if (requiresAllInputs(node.data.nodeType)) {
      const requiredCount = Math.max(1, incomingCounts[nodeId] ?? 1);
      if ((pendingInputs[nodeId]?.length ?? 0) < requiredCount && !entryNodeIds.has(nodeId)) {
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
        summary: "Node desativado, nenhuma saida foi emitida",
        inputPreview: buildPreview(input.items),
        outputPreview: null,
      };
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
        inputPreview: buildPreview(input.items),
        outputPreview: buildPreview(previewSource),
      };

      logs.push(`${node.data.label}: ${result.summary ?? "completed"}`);
    } catch (error) {
      const message = describeRuntimeError(error);
      nodeSnapshots[nodeId] = {
        ...nodeSnapshots[nodeId],
        status: "error",
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        itemCount: input.items.length,
        error: message,
        summary: message,
        inputPreview: buildPreview(input.items),
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
