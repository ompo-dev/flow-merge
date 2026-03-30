import type { AppNode, Workflow } from "@/lib/flow-types";
import type { WorkflowTriggerSource } from "@/lib/runtime-types";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getNodeParameter(node: AppNode, label: string) {
  const parameters = node.data.parameters ?? {};
  const normalizedLabel = normalize(label);
  const match = Object.entries(parameters).find(([key]) => normalize(key) === normalizedLabel);
  return match ? String(match[1] ?? "").trim() : "";
}

function getStoredTestPayload(node: AppNode) {
  const stored = node.data.config?.testPayload;
  if (typeof stored === "string") {
    try {
      return JSON.stringify(JSON.parse(stored), null, 2);
    } catch {
      return stored;
    }
  }

  if (stored && typeof stored === "object") {
    try {
      return JSON.stringify(stored, null, 2);
    } catch {
      return null;
    }
  }

  return null;
}

function collectDownstreamNodes(workflow: Workflow | null | undefined, startNodeId: string) {
  if (!workflow) return [] as AppNode[];

  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const queue = [startNodeId];
  const downstream: AppNode[] = [];

  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    workflow.edges
      .filter((edge) => edge.source === currentId)
      .forEach((edge) => {
        if (visited.has(edge.target)) return;
        const targetNode = nodeMap.get(edge.target);
        if (!targetNode) return;
        downstream.push(targetNode);
        queue.push(targetNode.id);
      });
  }

  return downstream;
}

function findDownstreamNode(
  downstreamNodes: AppNode[],
  nodeType: AppNode["data"]["nodeType"],
) {
  return downstreamNodes.find((node) => node.data.nodeType === nodeType);
}

function extractFunnelStages(downstreamNodes: AppNode[]) {
  const funnelNode = findDownstreamNode(downstreamNodes, "analytics_funnel");
  if (!funnelNode) return [];

  return ["Step 1", "Step 2", "Step 3", "Step 4"]
    .map((label) => getNodeParameter(funnelNode, label))
    .filter(Boolean);
}

function inferExperimentVariant(node: AppNode) {
  return (
    getNodeParameter(node, "Tag Value") ||
    (normalize(node.data.label).includes("variant a")
      ? "variant_a"
      : normalize(node.data.label).includes("variant b")
        ? "variant_b"
        : normalize(node.data.label).includes("variant c")
          ? "variant_c"
          : "")
  );
}

function inferDomainText(node: AppNode, downstreamNodes: AppNode[]) {
  return normalize(
    [
      node.data.label,
      node.data.description,
      getNodeParameter(node, "Path"),
      ...downstreamNodes.flatMap((downstreamNode) => [
        downstreamNode.data.label,
        downstreamNode.data.description,
        downstreamNode.data.nodeType,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function buildLogPayload(node: AppNode, domainText: string) {
  const tagValue = getNodeParameter(node, "Tag Value");
  const sourceArea =
    tagValue ||
    (domainText.includes("frontend")
      ? "frontend"
      : domainText.includes("backend")
        ? "backend"
        : domainText.includes("mobile")
          ? "mobile"
          : "app");

  return {
    event: `${sourceArea}_error`,
    timestamp: new Date().toISOString(),
    sourceArea,
    level: "error",
    message:
      sourceArea === "frontend"
        ? "Unhandled TypeError on checkout page"
        : "Database timeout while processing checkout request",
    route: sourceArea === "frontend" ? "/app/checkout" : "/api/checkout",
    statusCode: 500,
    userId: "usr_1024",
    requestId: "req_test_5001",
    environment: "production",
  };
}

function buildExperimentPayload(node: AppNode, downstreamNodes: AppNode[]) {
  const experimentNode = findDownstreamNode(downstreamNodes, "analytics_ab");
  const variantField =
    (experimentNode && getNodeParameter(experimentNode, "Variant Field")) || "variant";
  const conversionField =
    (experimentNode && getNodeParameter(experimentNode, "Conversion Field")) || "converted";
  const revenueField =
    (experimentNode && getNodeParameter(experimentNode, "Revenue Field")) || "amount";
  const variant = inferExperimentVariant(node) || "variant_a";

  return {
    event: "checkout_completed",
    timestamp: new Date().toISOString(),
    userId: "usr_exp_001",
    sessionId: "sess_exp_001",
    productId: "prod_pro_monthly",
    [variantField]: variant,
    [conversionField]: true,
    [revenueField]: 79,
  };
}

function buildFunnelPayload(downstreamNodes: AppNode[]) {
  const stages = extractFunnelStages(downstreamNodes);
  const selectedStage = stages[1] ?? stages[0] ?? "signup";
  const isPayment = selectedStage.includes("payment") || selectedStage.includes("paid");
  const isTrial = selectedStage.includes("trial");

  return {
    event: selectedStage,
    timestamp: new Date().toISOString(),
    userId: "usr_funnel_001",
    sessionId: "sess_funnel_001",
    plan: "pro",
    channel: "organic",
    country: "BR",
    trialStarted: isTrial || isPayment,
    amount: isPayment ? 149 : 0,
  };
}

function buildRevenuePayload(domainText: string) {
  return {
    event: domainText.includes("refund") ? "refund_issued" : "payment_succeeded",
    timestamp: new Date().toISOString(),
    customerId: "cus_1001",
    invoiceId: "inv_20260330_001",
    subscriptionId: "sub_pro_001",
    amount: 149,
    currency: "BRL",
    plan: "pro",
    status: "paid",
  };
}

function buildGenericPayload(node: AppNode, triggerSource: WorkflowTriggerSource) {
  return {
    event: getNodeParameter(node, "Tag Value") || "sample_event",
    timestamp: new Date().toISOString(),
    source: triggerSource === "webhook" ? "web_app" : triggerSource,
    userId: "usr_1001",
    sessionId: "sess_1001",
    value: 1,
  };
}

export function buildTriggerTestPayload(
  workflow: Workflow | null | undefined,
  node: AppNode,
  triggerSource: WorkflowTriggerSource,
) {
  const storedPayload = getStoredTestPayload(node);
  if (storedPayload) return storedPayload;

  const downstreamNodes = collectDownstreamNodes(workflow, node.id);
  const domainText = inferDomainText(node, downstreamNodes);

  const payload =
    domainText.includes("observabilidade") ||
    domainText.includes("logs") ||
    domainText.includes("error") ||
    domainText.includes("erro")
      ? buildLogPayload(node, domainText)
      : domainText.includes("a/b") ||
          domainText.includes("ab ") ||
          domainText.includes("experiment") ||
          domainText.includes("experimento") ||
          downstreamNodes.some((downstreamNode) => downstreamNode.data.nodeType === "analytics_ab")
        ? buildExperimentPayload(node, downstreamNodes)
        : domainText.includes("funnel") ||
            domainText.includes("funil") ||
            domainText.includes("signup") ||
            domainText.includes("trial") ||
            downstreamNodes.some((downstreamNode) => downstreamNode.data.nodeType === "analytics_funnel") ||
            downstreamNodes.some((downstreamNode) => downstreamNode.data.nodeType === "viz_funnel")
          ? buildFunnelPayload(downstreamNodes)
          : domainText.includes("revenue") ||
              domainText.includes("receita") ||
              domainText.includes("mrr") ||
              domainText.includes("arr") ||
              domainText.includes("billing") ||
              domainText.includes("payment") ||
              domainText.includes("finance")
            ? buildRevenuePayload(domainText)
            : buildGenericPayload(node, triggerSource);

  return JSON.stringify(payload, null, 2);
}
