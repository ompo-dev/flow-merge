import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeWorkflowRun } from "@/lib/runtime-engine";
import { nodeCatalogMap, type NodeTypeId } from "@/lib/node-catalog";
import { getDefaultNodeConfig, getNodeSchema } from "@/lib/node-config";
import { getDefaultProgrammableConfig } from "@/lib/node-programming";
import { getEmptyProjectStore } from "@/lib/runtime-storage";
import type { AppNode, Project, Workflow } from "@/lib/flow-types";
import { applyWorkflowIntelligence } from "@/lib/workflow-intelligence";
import type { RuntimeNodePatch, WorkflowRunResult } from "@/lib/runtime-types";

type CompatibilityResult = {
  flowKind: "pair" | "triple";
  sourceType: NodeTypeId;
  middleType?: NodeTypeId;
  targetType: NodeTypeId;
  ok: boolean;
  executionStatus?: string;
  sourceStatus?: string;
  middleStatus?: string;
  targetStatus?: string;
  sourceSummary?: string;
  middleSummary?: string;
  targetSummary?: string;
  semanticChecks?: string[];
  error?: string;
};

const triggerTypes: NodeTypeId[] = ["trigger_manual", "trigger_webhook", "trigger_schedule"];
const allTypes = Object.keys(nodeCatalogMap) as NodeTypeId[];
const targetTypes = allTypes.filter((type) => !triggerTypes.includes(type));

const sharedPayload = {
  event: "purchase_completed",
  source: "compatibility_suite",
  timestamp: "2026-03-30T12:00:00.000Z",
  userId: "usr_test_suite",
  sessionId: "sess_test_suite",
  amount: 49,
  converted: true,
  variant: "variant_a",
  status: "active",
  plan: "pro",
  segment: "beta",
  title: "Compatibility entry",
  level: "ERROR",
  message: "ERROR synthetic compatibility payload",
  errorLevel: "ERROR",
};

const safeParameters: Partial<Record<NodeTypeId, Record<string, string>>> = {
  trigger_webhook: {
    "HTTP Method": "POST",
    Path: "/compatibility/test",
  },
  trigger_schedule: {
    "Trigger Interval": "Every hour",
    Timezone: "UTC",
  },
  action_http: {
    Method: "GET",
    URL: "data:application/json,%7B%22ok%22%3Atrue%2C%22value%22%3A49%2C%22amount%22%3A49%2C%22converted%22%3Atrue%2C%22variant%22%3A%22variant_a%22%2C%22plan%22%3A%22pro%22%2C%22status%22%3A%22active%22%2C%22level%22%3A%22ERROR%22%2C%22message%22%3A%22ERROR%20synthetic%20compatibility%20payload%22%7D",
    "Response Format": "JSON",
  },
  action_set: {
    "Field Name": "value",
    "Field Value": "{{ input.first.amount }}",
  },
  action_filter: {
    Field: "{{ input.first.amount }}",
    Rule: "greater than",
    Value: "10",
  },
  action_if: {
    "Value 1": "{{ input.first.converted }}",
    Operation: "equals",
    "Value 2": "true",
  },
  action_switch: {
    Value: "{{ input.first.variant }}",
    Operation: "equals",
    "Case 1": "variant_a",
  },
  action_merge: {
    Mode: "Append Rows",
    "Join Field": "userId",
  },
  action_split: {
    "Batch Size": "1",
  },
  action_wait: {
    Unit: "Seconds",
    Amount: "0",
  },
  action_respond: {
    "Response Code": "200",
    "Respond With": "JSON payload",
  },
  analytics_store: {
    "Store Name": "compat_store",
  },
  analytics_aggregate: {
    "Group By": "{{ input.first.event }}",
    Aggregation: "Count",
    Field: "{{ input.first.amount }}",
  },
  analytics_compare: {
    "Input A Label": "Source A",
    "Input B Label": "Source B",
    Metric: "Errors",
  },
  analytics_ab: {
    "Store Names": "compat_variant_a,compat_variant_b",
    "Variant Field": "variant",
    "Conversion Field": "converted",
    "Revenue Field": "amount",
    "Minimum Sample": "1",
  },
  analytics_funnel: {
    "Step 1": "purchase_completed",
    "Step 2": "signup",
    "Step 3": "paid",
  },
  analytics_segment: {
    "Segment Field": "{{ input.first.plan }}",
    Values: "free,pro,enterprise",
  },
  analytics_enrich: {
    Source: "Data Store",
    "Join Field": "userId",
  },
  monitor_error: {
    "Level Filter": "ERROR + FATAL",
    Pattern: "",
  },
  monitor_alert: {
    Threshold: "10",
    Field: "{{ input.first.amount }}",
    Channel: "Slack",
  },
  monitor_revenue: {
    Metric: "Revenue",
    Currency: "USD",
  },
  action_slack: {
    Channel: "#compat",
    Message: "{{ input.first.event }}",
  },
  action_email: {
    Subject: "Compatibility Test",
    Message: "{{ input.first.event }}",
  },
  viz_metric: {
    "Metric Label": "Compat Metric",
    "Data Field": "{{ input.first.amount }}",
  },
  viz_chart: {
    "Chart Type": "Bar",
    "X Axis": "{{ input.first.event }}",
    "Y Axis": "{{ input.first.amount }}",
  },
  viz_table: {
    Columns: "event,amount,status",
    "Max Rows": "5",
  },
  viz_report: {
    Title: "Compatibility Report",
    Refresh: "Every 1h",
  },
  viz_funnel: {
    "Stage 1": "Visited",
    "Stage 2": "Signed Up",
    "Stage 3": "Paid",
  },
  viz_dashboard: {
    Layout: "6 columns",
    Title: "Compatibility Dashboard",
  },
};

function makeProject(): Project {
  return {
    id: "proj_compatibility",
    name: "Compatibility Project",
    description: "Automated node compatibility checks",
    accent: "#58a6ff",
    active: true,
  };
}

function makeNode(type: NodeTypeId, id: string): AppNode {
  const meta = nodeCatalogMap[type];
  const parameters = { ...(safeParameters[type] ?? {}) };

  if (type === "analytics_store") {
    parameters["Store Name"] = `${parameters["Store Name"]}_${id}`;
  }

  return {
    id,
    type: meta.shellType,
    position: { x: 0, y: 0 },
    data: {
      label: meta.label,
      nodeType: type,
      description: meta.description,
      icon: meta.icon,
      badge: meta.badge,
      accent: meta.accent,
      subtle: meta.subtle,
      disabled: false,
      notes: "",
      schema: getNodeSchema(type),
      chartType: meta.chartType,
      vizVariant: meta.vizVariant,
      parameters,
      config: getDefaultNodeConfig(type, {
        label: meta.label,
        chartType: meta.chartType,
        vizVariant: meta.vizVariant,
      }),
      programmable: getDefaultProgrammableConfig(type),
    },
  };
}

function getEdgeHandleForSource(type: NodeTypeId) {
  if (type === "action_if") return "true";
  if (type === "action_switch") return "case_1";
  return undefined;
}

function buildWorkflow(
  sourceType: NodeTypeId,
  targetType: NodeTypeId,
  middleType?: NodeTypeId,
): {
  workflow: Workflow;
  request: { source: "manual" | "schedule" | "webhook"; triggerNodeId: string; payload: typeof sharedPayload };
  sourceId: string;
  middleId?: string;
  targetId: string;
} {
  const sourceId = `source_${sourceType}`;
  const middleId = middleType ? `middle_${middleType}` : undefined;
  const targetId = `target_${targetType}`;
  const sourceNode = makeNode(sourceType, sourceId);
  const middleNode = middleType && middleId ? makeNode(middleType, middleId) : null;
  const targetNode = makeNode(targetType, targetId);
  const nodes: AppNode[] = [];
  const edges: Workflow["edges"] = [];
  let triggerNodeId = sourceId;
  let source: "manual" | "schedule" | "webhook" = "manual";
  const nextTargetId = middleId ?? targetId;
  const nextTargetHandle = getEdgeHandleForSource(sourceType);
  const finalTargetHandle =
    middleNode && middleType ? getEdgeHandleForSource(middleType) : undefined;

  if (triggerTypes.includes(sourceType)) {
    nodes.push(sourceNode);
    if (middleNode) nodes.push(middleNode);
    nodes.push(targetNode);
    edges.push({
      id: `edge_${sourceId}_${nextTargetId}`,
      source: sourceId,
      target: nextTargetId,
      sourceHandle: nextTargetHandle,
    });
    if (middleNode && middleId) {
      edges.push({
        id: `edge_${middleId}_${targetId}`,
        source: middleId,
        target: targetId,
        sourceHandle: finalTargetHandle,
      });
    }
    source =
      sourceType === "trigger_schedule"
        ? "schedule"
        : sourceType === "trigger_webhook"
          ? "webhook"
          : "manual";
  } else {
    const triggerId = `entry_${sourceType}_${targetType}`;
    const triggerNode = makeNode("trigger_manual", triggerId);
    triggerNodeId = triggerId;
    nodes.push(triggerNode, sourceNode);
    if (middleNode) nodes.push(middleNode);
    nodes.push(targetNode);
    edges.push(
      {
        id: `edge_${triggerId}_${sourceId}`,
        source: triggerId,
        target: sourceId,
      },
      {
        id: `edge_${sourceId}_${nextTargetId}`,
        source: sourceId,
        target: nextTargetId,
        sourceHandle: nextTargetHandle,
      },
    );
    if (middleNode && middleId) {
      edges.push({
        id: `edge_${middleId}_${targetId}`,
        source: middleId,
        target: targetId,
        sourceHandle: finalTargetHandle,
      });
    }
  }

  const workflow: Workflow = {
    id: `wf_${sourceType}_${targetType}`,
    projectId: "proj_compatibility",
    name: `${sourceType} -> ${targetType}`,
    accent: "#58a6ff",
    active: true,
    nodes,
    edges,
    createdAt: "2026-03-30T00:00:00.000Z",
    updatedAt: "2026-03-30T00:00:00.000Z",
    tags: ["compatibility"],
    description: "Automated compatibility workflow",
  };

  return {
    workflow: applyWorkflowIntelligence(workflow),
    request: {
      source,
      triggerNodeId,
      payload: sharedPayload,
    },
    sourceId,
    middleId,
    targetId,
  };
}

function getNodePatch(result: WorkflowRunResult, nodeId: string) {
  return result.nodePatches.find((patch) => patch.nodeId === nodeId) ?? null;
}

function getPatchedConfig(result: WorkflowRunResult, nodeId: string) {
  return (getNodePatch(result, nodeId)?.data.config ?? {}) as Record<string, unknown>;
}

function isBranchingNodeType(nodeType?: NodeTypeId) {
  return nodeType === "action_if" || nodeType === "action_switch";
}

function validateNodeSemantics(
  nodeType: NodeTypeId,
  result: WorkflowRunResult,
  workflow: Workflow,
  nodeId: string,
) {
  const snapshot = result.nodeSnapshots[nodeId];
  const node = workflow.nodes.find((candidate) => candidate.id === nodeId);
  const config = getPatchedConfig(result, nodeId);
  const preview =
    snapshot?.outputPreview && typeof snapshot.outputPreview === "object"
      ? (snapshot.outputPreview as Record<string, unknown>)
      : null;
  const checks: string[] = [];

  if (!snapshot || snapshot.status === "error") {
    return { ok: false, checks: ["node did not finish successfully"] };
  }

  if (snapshot.status === "idle") {
    return { ok: false, checks: ["node remained idle"] };
  }

  switch (nodeType) {
    case "analytics_store": {
      const storeName = String(node?.data.parameters?.["Store Name"] ?? "");
      const ok = storeName.length > 0 && storeName in result.updatedStore.collections;
      checks.push(ok ? `store available: ${storeName}` : "store was not populated");
      return { ok, checks };
    }
    case "analytics_compare": {
      const sources = Array.isArray(preview?.sources) ? preview.sources : [];
      const ok =
        typeof preview?.total === "number" &&
        typeof preview?.sourceCount === "number" &&
        Array.isArray(sources);
      checks.push(ok ? `comparison sources: ${sources.length}` : "comparison payload missing sources");
      return { ok, checks };
    }
    case "monitor_alert": {
      const ok = typeof preview?.triggered === "boolean";
      checks.push(ok ? "alert payload generated" : "alert payload missing");
      return { ok, checks };
    }
    case "monitor_revenue": {
      const ok = typeof preview?.total === "number";
      checks.push(ok ? "revenue total generated" : "revenue total missing");
      return { ok, checks };
    }
    case "viz_metric": {
      const ok = "value" in config;
      checks.push(ok ? `metric value: ${String(config.value ?? "")}` : "metric config.value missing");
      return { ok, checks };
    }
    case "viz_chart": {
      const series = Array.isArray(config.series) ? config.series : [];
      const ok = Array.isArray(config.series);
      checks.push(ok ? `chart series: ${series.length}` : "chart config.series missing");
      return { ok, checks };
    }
    case "viz_table": {
      const rows = Array.isArray(config.rows) ? config.rows : [];
      const columns = typeof config.columns === "string" ? config.columns : "";
      const ok = "rows" in config && columns.length >= 0;
      checks.push(ok ? `table rows: ${rows.length}` : "table rows/columns missing");
      return { ok, checks };
    }
    case "viz_report": {
      const reportItems = Array.isArray(config.reportItems) ? config.reportItems : [];
      const ok = Array.isArray(config.reportItems);
      checks.push(ok ? `report items: ${reportItems.length}` : "report items missing");
      return { ok, checks };
    }
    case "viz_funnel": {
      const stages = Array.isArray(config.stages) ? config.stages : [];
      const ok = Array.isArray(config.stages);
      checks.push(ok ? `funnel stages: ${stages.length}` : "funnel stages missing");
      return { ok, checks };
    }
    default: {
      const ok =
        preview !== null ||
        Boolean(snapshot.summary) ||
        Boolean((getNodePatch(result, nodeId) as RuntimeNodePatch | null)?.data.notes);
      checks.push(ok ? "generic output available" : "no output preview or patch found");
      return { ok, checks };
    }
  }
}

async function verifyFlow(
  sourceType: NodeTypeId,
  targetType: NodeTypeId,
  middleType?: NodeTypeId,
): Promise<CompatibilityResult> {
  const { workflow, request, sourceId, middleId, targetId } = buildWorkflow(
    sourceType,
    targetType,
    middleType,
  );

  try {
    const result = await executeWorkflowRun({
      project: makeProject(),
      workflow,
      request,
      store: getEmptyProjectStore(),
    });

    const sourceSnapshot = result.nodeSnapshots[sourceId];
    const middleSnapshot = middleId ? result.nodeSnapshots[middleId] : undefined;
    const targetSnapshot = result.nodeSnapshots[targetId];

    if (!targetSnapshot) {
      return {
        flowKind: middleType ? "triple" : "pair",
        sourceType,
        middleType,
        targetType,
        ok: false,
        executionStatus: result.executionStatus,
        sourceStatus: sourceSnapshot?.status,
        middleStatus: middleSnapshot?.status,
        sourceSummary: sourceSnapshot?.summary,
        middleSummary: middleSnapshot?.summary,
        error: "Target node did not execute",
      };
    }

    const isMiddleBranchSkip =
      targetSnapshot.status === "idle" &&
      isBranchingNodeType(middleType) &&
      middleSnapshot?.status === "success" &&
      (middleSnapshot.summary === "Condition failed" ||
        middleSnapshot.summary?.startsWith("Matched ") ||
        middleSnapshot.summary === "No switch case matched");
    const semanticTarget = isMiddleBranchSkip
      ? { ok: true, checks: ["branch path not selected"] }
      : validateNodeSemantics(targetType, result, workflow, targetId);
    const semanticMiddle =
      middleType && middleId
        ? validateNodeSemantics(middleType, result, workflow, middleId)
        : { ok: true, checks: [] as string[] };

    const ok =
      result.executionStatus === "success" &&
      sourceSnapshot?.status !== "error" &&
      middleSnapshot?.status !== "error" &&
      targetSnapshot.status !== "error" &&
      semanticMiddle.ok &&
      semanticTarget.ok;

    return {
      flowKind: middleType ? "triple" : "pair",
      sourceType,
      middleType,
      targetType,
      ok,
      executionStatus: result.executionStatus,
      sourceStatus: sourceSnapshot?.status,
      middleStatus: middleSnapshot?.status,
      targetStatus: targetSnapshot.status,
      sourceSummary: sourceSnapshot?.summary,
      middleSummary: middleSnapshot?.summary,
      targetSummary: targetSnapshot.summary,
      semanticChecks: [...semanticMiddle.checks, ...semanticTarget.checks],
      error: ok
        ? undefined
        : sourceSnapshot?.error ??
          middleSnapshot?.error ??
          targetSnapshot.error ??
          [...semanticMiddle.checks, ...semanticTarget.checks].join("; ") ??
          "Execution failed",
    };
  } catch (error) {
    return {
      flowKind: middleType ? "triple" : "pair",
      sourceType,
      middleType,
      targetType,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyPair(sourceType: NodeTypeId, targetType: NodeTypeId) {
  return verifyFlow(sourceType, targetType);
}

async function verifyTriple(sourceType: NodeTypeId, middleType: NodeTypeId, targetType: NodeTypeId) {
  return verifyFlow(sourceType, targetType, middleType);
}

async function main() {
  Object.assign(globalThis, {
    window: {
      setTimeout: globalThis.setTimeout.bind(globalThis),
    },
  });

  const results: CompatibilityResult[] = [];

  for (const sourceType of allTypes) {
    for (const targetType of targetTypes) {
      const result = await verifyPair(sourceType, targetType);
      results.push(result);
    }
  }

  for (const sourceType of allTypes) {
    for (const middleType of targetTypes) {
      for (const targetType of targetTypes) {
        const result = await verifyTriple(sourceType, middleType, targetType);
        results.push(result);
      }
    }
  }

  const failed = results.filter((result) => !result.ok);
  const pairResults = results.filter((result) => result.flowKind === "pair");
  const tripleResults = results.filter((result) => result.flowKind === "triple");
  const summary = {
    generatedAt: new Date().toISOString(),
    totalPairs: results.length,
    passedPairs: results.length - failed.length,
    failedPairs: failed.length,
    pairwise: {
      total: pairResults.length,
      passed: pairResults.filter((result) => result.ok).length,
      failed: pairResults.filter((result) => !result.ok).length,
    },
    triple: {
      total: tripleResults.length,
      passed: tripleResults.filter((result) => result.ok).length,
      failed: tripleResults.filter((result) => !result.ok).length,
    },
    failures: failed,
  };

  const reportDir = path.join(process.cwd(), "reports");
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, "node-compatibility-report.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  console.log(
    `[compatibility] ${summary.passedPairs}/${summary.totalPairs} flow(s) passed. Pairwise: ${summary.pairwise.passed}/${summary.pairwise.total}. Triple: ${summary.triple.passed}/${summary.triple.total}. Report: reports/node-compatibility-report.json`,
  );

  if (failed.length) {
    console.error("[compatibility] Failed pairs:");
    failed.slice(0, 25).forEach((failure) => {
      console.error(
        `- ${failure.sourceType} -> ${failure.targetType}: ${failure.error ?? failure.targetSummary ?? "unknown failure"}`,
      );
    });
    process.exitCode = 1;
  }
}

await main();
