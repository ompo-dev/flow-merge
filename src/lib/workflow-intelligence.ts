import type {
  AppNode,
  JSONSchemaProperty,
  Workflow,
  WorkflowNodeData,
} from "@/lib/flow-types";

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

function isTriggerNode(node: AppNode) {
  return node.data.nodeType.startsWith("trigger_");
}

function isBuiltinNode(node: AppNode) {
  return (node.data.programmable?.mode ?? "builtin") === "builtin";
}

function getParameter(node: AppNode, label: string) {
  const parameters = node.data.parameters ?? {};
  const match = Object.entries(parameters).find(([key]) => normalizeKey(key) === normalizeKey(label));
  return typeof match?.[1] === "string" ? match[1] : "";
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

type WorkflowEdge = Workflow["edges"][number];

export type WorkflowIntelligenceGraph = {
  nodeById: Map<string, AppNode>;
  activeEdges: WorkflowEdge[];
  candidateEdges: WorkflowEdge[];
  rawIncomingByTarget: Map<string, WorkflowEdge[]>;
  activeIncomingByTarget: Map<string, WorkflowEdge[]>;
  rawOutgoingBySource: Map<string, WorkflowEdge[]>;
  activeOutgoingBySource: Map<string, WorkflowEdge[]>;
  rootNodeIds: Set<string>;
  reachableNodeIds: Set<string>;
  semanticStateByNodeId: Map<string, WorkflowNodeSemanticState>;
};

export type WorkflowNodeSemanticState = {
  nodeId: string;
  isRoot: boolean;
  isActive: boolean;
  manuallyDisabled: boolean;
  autoBlocked: boolean;
  rawIncomingCount: number;
  activeIncomingCount: number;
  rawOutgoingCount: number;
  activeOutgoingCount: number;
  canManuallyEnable: boolean;
  reason: string;
};

export type SwitchCaseEntry = {
  handle: `case_${number}`;
  label: string;
};

export function getSwitchCaseEntries(node: AppNode): SwitchCaseEntry[] {
  if (node.data.nodeType !== "action_switch") return [];

  return Array.from({ length: 4 }, (_, index) => {
    const label = getParameter(node, `Case ${index + 1}`);
    if (!label) return null;

    return {
      handle: `case_${index + 1}` as const,
      label,
    };
  }).filter((entry): entry is SwitchCaseEntry => Boolean(entry));
}

export function getNodeActiveSourceHandles(node: AppNode) {
  if (node.data.nodeType === "action_if") {
    return ["true", "false"];
  }

  if (node.data.nodeType === "action_switch") {
    return [...getSwitchCaseEntries(node).map((entry) => entry.handle), "default"];
  }

  if (node.data.nodeType === "analytics_store") {
    return getParameter(node, "Store Name") ? ["default"] : [];
  }

  return ["default", "right-source", "bottom-source"];
}

function flattenSchemaKeys(
  property: JSONSchemaProperty,
  prefix: string,
  values: Set<string>,
) {
  values.add(prefix);

  if (property.type === "object" && property.properties) {
    Object.entries(property.properties).forEach(([key, child]) => {
      flattenSchemaKeys(child, `${prefix}.${key}`, values);
    });
  }
}

function flattenPreviewKeys(value: unknown, prefix: string, values: Set<string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    values.add(prefix);
    return;
  }

  values.add(prefix);

  Object.entries(value).forEach(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenPreviewKeys(child, nextPrefix, values);
  });
}

function getIncomingFieldKeys(workflow: Workflow, nodeId: string) {
  const incomingNodes = getActiveIncomingNodes(workflow, nodeId);
  const values = new Set<string>();

  incomingNodes.forEach((node) => {
    const schema = node.data.schema?.output;
    Object.entries(schema?.properties ?? {}).forEach(([key, property]) => {
      flattenSchemaKeys(property, key, values);
    });

    const preview = node.data.runtime?.outputPreview;
    if (preview && typeof preview === "object") {
      flattenPreviewKeys(preview, "", values);
    }
  });

  return values;
}

function getVariantTagValue(node: AppNode) {
  const explicit = getParameter(node, "Tag Value");
  if (explicit) return explicit;

  const label = node.data.label;
  const variantMatch = label.match(/variant\s*([a-z0-9]+)/i);
  if (variantMatch) {
    return `variant_${slugify(variantMatch[1])}`;
  }

  return slugify(label);
}

function getVariantTagField(node: AppNode) {
  return getParameter(node, "Tag Field") || "variant";
}

function formatVariantLabel(value: string) {
  const normalized = value.replace(/^ab_/, "");

  if (/^variant_[a-z0-9]+$/i.test(normalized)) {
    return `Variant ${normalized.slice("variant_".length).toUpperCase()}`;
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function trimStoreLabel(label: string) {
  return label
    .replace(/^store\s*:\s*/i, "")
    .replace(/^store\s+/i, "")
    .trim();
}

function deriveGenericStoreName(node: AppNode, incomingNodes: AppNode[]) {
  const labelCandidates = [
    trimStoreLabel(node.data.label || ""),
    ...incomingNodes.map((incomingNode) => trimStoreLabel(incomingNode.data.label || "")),
  ];

  const seededLabel = labelCandidates.find((candidate) => slugify(candidate)) || "store_data";
  const slug = slugify(seededLabel);

  if (!slug || slug === "store") {
    return "store_data";
  }

  return slug;
}

type CompareSourceSummary = {
  key: string;
  label: string;
  storeName: string;
  value: number;
  count: number;
  share: number;
};

function mapStoreNodesToCompareSources(storeNodes: AppNode[]) {
  return storeNodes
    .map((storeNode) => {
      const storeName = getParameter(storeNode, "Store Name");
      const label = trimStoreLabel(storeNode.data.label || storeName);
      return {
        key: slugify(storeName.replace(/^obs_/i, "").replace(/^ab_/i, "") || label),
        label,
        storeName,
        value: 0,
        count: 0,
        share: 0,
      };
    })
    .filter((source) => source.storeName);
}

type AbVariantSummary = {
  storeName: string;
  key: string;
  label: string;
  users: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
};

function getAnalyzerStoreNames(node: AppNode) {
  return getParameter(node, "Store Names")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAnalyticsAbVariants(node: AppNode): AbVariantSummary[] {
  const storeNames = getAnalyzerStoreNames(node);
  const preview =
    node.data.runtime?.outputPreview &&
    typeof node.data.runtime.outputPreview === "object" &&
    !Array.isArray(node.data.runtime.outputPreview)
      ? (node.data.runtime.outputPreview as Record<string, unknown>)
      : {};
  const previewVariants = Array.isArray(preview.variants)
    ? (preview.variants as Array<Record<string, unknown>>)
    : [];
  const previewByKey = new Map(
    previewVariants.map((variant) => {
      const label = String(variant.label ?? variant.name ?? "");
      return [slugify(label), variant] as const;
    }),
  );

  return storeNames.map((storeName) => {
    const key = storeName.replace(/^ab_/, "");
    const previewVariant =
      previewByKey.get(slugify(key)) ??
      previewByKey.get(slugify(formatVariantLabel(key))) ??
      null;

    return {
      storeName,
      key,
      label: String(previewVariant?.label ?? formatVariantLabel(key)),
      users: toNumber(previewVariant?.users),
      conversions: toNumber(previewVariant?.conversions),
      conversionRate: toNumber(previewVariant?.conversionRate),
      revenue: toNumber(previewVariant?.revenue),
    };
  });
}

function getUpstreamAnalyzerNode(workflow: Workflow, nodeId: string) {
  return getActiveIncomingNodes(workflow, nodeId).find(
    (incomingNode) => incomingNode.data.nodeType === "analytics_ab",
  );
}

function getUpstreamCompareNode(workflow: Workflow, nodeId: string) {
  return getActiveIncomingNodes(workflow, nodeId).find(
    (incomingNode) => incomingNode.data.nodeType === "analytics_compare",
  );
}

function getAnalyticsCompareSources(workflow: Workflow, node: AppNode): CompareSourceSummary[] {
  const preview =
    node.data.runtime?.outputPreview &&
    typeof node.data.runtime.outputPreview === "object" &&
    !Array.isArray(node.data.runtime.outputPreview)
      ? (node.data.runtime.outputPreview as Record<string, unknown>)
      : {};
  const previewSources = Array.isArray(preview.sources)
    ? (preview.sources as Array<Record<string, unknown>>)
    : [];

  if (previewSources.length) {
    return previewSources.map((source, index) => ({
      key: String(source.key ?? `source_${index + 1}`),
      label: String(source.label ?? `Source ${index + 1}`),
      storeName: String(source.storeName ?? ""),
      value: toNumber(source.value),
      count: toNumber(source.count),
      share: toNumber(source.share),
    }));
  }

  return mapStoreNodesToCompareSources(
    getActiveIncomingNodes(workflow, node.id).filter(
      (incomingNode) => incomingNode.data.nodeType === "analytics_store",
    ),
  );
}

function getCompareMetric(node: AppNode, sources: CompareSourceSummary[]) {
  const explicit = getParameter(node, "Metric");
  if (explicit) return explicit;

  const combined = `${node.data.label} ${node.data.description ?? ""} ${sources
    .map((source) => source.label)
    .join(" ")}`;
  const normalized = normalizeKey(combined);

  if (normalized.includes("error") || normalized.includes("erro")) return "Error Logs";
  if (normalized.includes("revenue") || normalized.includes("receita")) return "Revenue";
  return "Volume";
}

function getCompareMetricVariant(metric: string) {
  const normalized = normalizeKey(metric);
  if (normalized.includes("error") || normalized.includes("erro")) return "errors";
  if (normalized.includes("revenue") || normalized.includes("receita")) return "revenue";
  if (normalized.includes("user") || normalized.includes("usuario")) return "users";
  return "custom";
}

export function buildWorkflowIntelligenceGraph(workflow: Workflow): WorkflowIntelligenceGraph {
  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const rawIncomingByTarget = new Map<string, typeof workflow.edges>();
  const rawOutgoingBySource = new Map<string, typeof workflow.edges>();
  const activeIncomingByTarget = new Map<string, typeof workflow.edges>();
  const activeOutgoingBySource = new Map<string, typeof workflow.edges>();

  workflow.edges.forEach((edge) => {
    const currentIncoming = rawIncomingByTarget.get(edge.target) ?? [];
    rawIncomingByTarget.set(edge.target, [...currentIncoming, edge]);

    const currentOutgoing = rawOutgoingBySource.get(edge.source) ?? [];
    rawOutgoingBySource.set(edge.source, [...currentOutgoing, edge]);
  });

  const isEdgeCandidate = (edge: WorkflowEdge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return false;

    if (sourceNode.data.disabled) return false;
    if (targetNode.data.disabled) return false;

    const activeHandles = getNodeActiveSourceHandles(sourceNode);

    if (sourceNode.data.nodeType === "action_if" || sourceNode.data.nodeType === "action_switch") {
      const handle = edge.sourceHandle ?? "default";
      if (!activeHandles.includes(handle)) return false;
    } else if (edge.sourceHandle && !activeHandles.includes(edge.sourceHandle)) {
      return false;
    }

    if (sourceNode.data.nodeType === "analytics_store") {
      return getParameter(sourceNode, "Store Name") !== "";
    }

    return true;
  };

  const candidateEdges = workflow.edges.filter((edge) => isEdgeCandidate(edge));

  const triggerRootIds = workflow.nodes
    .filter((node) => isTriggerNode(node))
    .filter((node) => !node.data.disabled)
    .filter((node) => getNodeActiveSourceHandles(node).length > 0)
    .map((node) => node.id);
  const rootIds = triggerRootIds.length
    ? triggerRootIds
    : workflow.nodes
        .filter((node) => (rawIncomingByTarget.get(node.id)?.length ?? 0) === 0)
        .filter((node) => !node.data.disabled)
        .filter((node) => getNodeActiveSourceHandles(node).length > 0)
        .map((node) => node.id);
  const rootNodeIds = new Set(rootIds);
  const reachableNodeIds = new Set(rootIds);
  const activeEdges: WorkflowEdge[] = [];
  const queue = [...rootIds];

  const isReachableCompareSourceEdge = (
    edge: WorkflowEdge,
    currentReachableNodeIds: Set<string>,
  ) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return false;

    if (sourceNode.data.nodeType !== "analytics_compare") return true;

    const comparisonSourceKey =
      typeof targetNode.data.config?.comparisonSourceKey === "string"
        ? String(targetNode.data.config?.comparisonSourceKey)
        : "";

    if (!comparisonSourceKey) return true;

    const reachableStores = (rawIncomingByTarget.get(sourceNode.id) ?? [])
      .map((incomingEdge) => nodeById.get(incomingEdge.source))
      .filter((incomingNode): incomingNode is AppNode => {
        if (!incomingNode) return false;

        return (
          currentReachableNodeIds.has(incomingNode.id) &&
          incomingNode.data.nodeType === "analytics_store" &&
          !incomingNode.data.disabled &&
          getParameter(incomingNode, "Store Name") !== ""
        );
      });

    return mapStoreNodesToCompareSources(reachableStores).some(
      (candidateSource) => candidateSource.key === comparisonSourceKey,
    );
  };

  while (queue.length) {
    const currentNodeId = queue.shift();
    if (!currentNodeId) continue;

    candidateEdges
      .filter((edge) => edge.source === currentNodeId)
      .filter((edge) => isReachableCompareSourceEdge(edge, reachableNodeIds))
      .forEach((edge) => {
        activeEdges.push(edge);

        const currentIncoming = activeIncomingByTarget.get(edge.target) ?? [];
        activeIncomingByTarget.set(edge.target, [...currentIncoming, edge]);

        const currentOutgoing = activeOutgoingBySource.get(edge.source) ?? [];
        activeOutgoingBySource.set(edge.source, [...currentOutgoing, edge]);

        if (reachableNodeIds.has(edge.target)) return;
        reachableNodeIds.add(edge.target);
        queue.push(edge.target);
      });
  }

  const semanticStateByNodeId = new Map<string, WorkflowNodeSemanticState>();

  const canRawEdgeDeliverData = (edge: WorkflowEdge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return false;

    if (sourceNode.data.disabled) return false;
    if (!reachableNodeIds.has(sourceNode.id)) return false;
    if (!isReachableCompareSourceEdge(edge, reachableNodeIds)) return false;

    const activeHandles = getNodeActiveSourceHandles(sourceNode);

    if (sourceNode.data.nodeType === "action_if" || sourceNode.data.nodeType === "action_switch") {
      const handle = edge.sourceHandle ?? "default";
      if (!activeHandles.includes(handle)) return false;
    } else if (edge.sourceHandle && !activeHandles.includes(edge.sourceHandle)) {
      return false;
    }

    if (sourceNode.data.nodeType === "analytics_store") {
      return getParameter(sourceNode, "Store Name") !== "";
    }

    return true;
  };

  workflow.nodes.forEach((node) => {
    const rawIncomingEdges = rawIncomingByTarget.get(node.id) ?? [];
    const rawIncomingCount = rawIncomingByTarget.get(node.id)?.length ?? 0;
    const activeIncomingCount = activeIncomingByTarget.get(node.id)?.length ?? 0;
    const rawOutgoingCount = rawOutgoingBySource.get(node.id)?.length ?? 0;
    const activeOutgoingCount = activeOutgoingBySource.get(node.id)?.length ?? 0;
    const isRoot = rootNodeIds.has(node.id);
    const manuallyDisabled = Boolean(node.data.disabled);
    const isActive = reachableNodeIds.has(node.id);
    const hasDeliverableUpstream = rawIncomingEdges.some((edge) => canRawEdgeDeliverData(edge));
    const autoBlocked =
      !manuallyDisabled &&
      !isRoot &&
      rawIncomingCount > 0 &&
      activeIncomingCount === 0;
    const canManuallyEnable =
      manuallyDisabled && (isRoot || hasDeliverableUpstream || rawIncomingCount === 0);

    let reason = "Participando normalmente do fluxo.";
    if (manuallyDisabled && canManuallyEnable) {
      reason = "Desativado manualmente. Reative este node para voltar a emitir dados.";
    } else if (manuallyDisabled) {
      reason =
        "Desativado manualmente e sem entrada ativa. Reative um node anterior antes de tentar ligar este bloco.";
    } else if (autoBlocked) {
      reason =
        "Sem entrada ativa chegando neste node. Ele continua no canvas, mas fica bloqueado ate algum node anterior voltar a emitir dados.";
    } else if (isRoot) {
      reason = "Ativo como ponto de entrada do fluxo.";
    } else if (activeIncomingCount > 0 && rawIncomingCount > activeIncomingCount) {
      reason = `Ativo com ${activeIncomingCount} de ${rawIncomingCount} entrada(s) ativas.`;
    }

    semanticStateByNodeId.set(node.id, {
      nodeId: node.id,
      isRoot,
      isActive,
      manuallyDisabled,
      autoBlocked,
      rawIncomingCount,
      activeIncomingCount,
      rawOutgoingCount,
      activeOutgoingCount,
      canManuallyEnable,
      reason,
    });
  });

  return {
    nodeById,
    activeEdges,
    candidateEdges,
    rawIncomingByTarget,
    activeIncomingByTarget,
    rawOutgoingBySource,
    activeOutgoingBySource,
    rootNodeIds,
    reachableNodeIds,
    semanticStateByNodeId,
  };
}

export function getActiveIncomingNodes(workflow: Workflow, nodeId: string) {
  const graph = buildWorkflowIntelligenceGraph(workflow);
  const incomingEdges = graph.activeIncomingByTarget.get(nodeId) ?? [];
  const incomingIds = incomingEdges.map((edge) => edge.source);

  return workflow.nodes.filter((node) => incomingIds.includes(node.id));
}

export function getActiveIncomingEdges(workflow: Workflow, nodeId: string) {
  return buildWorkflowIntelligenceGraph(workflow).activeIncomingByTarget.get(nodeId) ?? [];
}

export function getActiveOutgoingEdges(workflow: Workflow, nodeId: string) {
  return buildWorkflowIntelligenceGraph(workflow).activeEdges.filter(
    (edge) => edge.source === nodeId,
  );
}

export function isNodeSemanticallyActive(workflow: Workflow, nodeId: string) {
  return buildWorkflowIntelligenceGraph(workflow).reachableNodeIds.has(nodeId);
}

export function getNodeSemanticState(workflow: Workflow, nodeId: string): WorkflowNodeSemanticState {
  return (
    buildWorkflowIntelligenceGraph(workflow).semanticStateByNodeId.get(nodeId) ?? {
      nodeId,
      isRoot: false,
      isActive: false,
      manuallyDisabled: false,
      autoBlocked: false,
      rawIncomingCount: 0,
      activeIncomingCount: 0,
      rawOutgoingCount: 0,
      activeOutgoingCount: 0,
      canManuallyEnable: false,
      reason: "Node fora do fluxo atual.",
    }
  );
}

function getSwitchCaseValue(node: AppNode, sourceHandle: string | null | undefined) {
  if (!sourceHandle?.startsWith("case_")) return "";

  const caseNumber = sourceHandle.replace("case_", "");
  return getParameter(node, `Case ${caseNumber}`);
}

function inferSwitchParameters(workflow: Workflow, node: AppNode) {
  const incomingNodes = getActiveIncomingNodes(workflow, node.id);
  const triggerSources = incomingNodes.filter((incomingNode) => isTriggerNode(incomingNode));

  const variants = Array.from(
    new Set(
      triggerSources
        .map((triggerNode) => getVariantTagValue(triggerNode))
        .filter(Boolean),
    ),
  );

  if (!variants.length) return null;

  const dominantTagField =
    triggerSources
      .map((triggerNode) => getVariantTagField(triggerNode))
      .find(Boolean) ?? "variant";

  const nextParameters: Record<string, string> = {
    ...(node.data.parameters ?? {}),
    Value: `{{ input.first.${dominantTagField} }}`,
    Operation: getParameter(node, "Operation") || "equals",
    "Case 1": variants[0] ?? "",
    "Case 2": variants[1] ?? "",
    "Case 3": variants[2] ?? "",
    "Case 4": variants[3] ?? "",
  };

  return nextParameters;
}

function inferAnalyticsStoreParameters(workflow: Workflow, node: AppNode) {
  const currentStoreName = getParameter(node, "Store Name");
  const incomingEdges = workflow.edges.filter((edge) => edge.target === node.id);
  const activeIncomingNodes = getActiveIncomingNodes(workflow, node.id);
  const incomingTriggerEdge = incomingEdges.find((edge) => {
    const sourceNode = workflow.nodes.find((candidate) => candidate.id === edge.source);
    return sourceNode ? isTriggerNode(sourceNode) : false;
  });
  const incomingSwitchEdge = incomingEdges.find((edge) => {
    const sourceNode = workflow.nodes.find((candidate) => candidate.id === edge.source);
    return sourceNode?.data.nodeType === "action_switch";
  });

  let derivedStoreName = "";

  if (incomingTriggerEdge) {
    const triggerNode = workflow.nodes.find((candidate) => candidate.id === incomingTriggerEdge.source);
    const tagValue = triggerNode ? getVariantTagValue(triggerNode) : "";
    derivedStoreName = tagValue ? `ab_${tagValue}` : "";
  }

  if (!derivedStoreName && incomingSwitchEdge) {
    const switchNode = workflow.nodes.find((candidate) => candidate.id === incomingSwitchEdge.source);
    const caseValue = switchNode
      ? getSwitchCaseValue(switchNode, incomingSwitchEdge.sourceHandle)
      : "";
    derivedStoreName = caseValue ? `ab_${slugify(caseValue)}` : "";
  }

  if (!derivedStoreName) {
    derivedStoreName = currentStoreName;
  }

  if (!derivedStoreName) {
    derivedStoreName = deriveGenericStoreName(node, activeIncomingNodes);
  }

  return {
    ...(node.data.parameters ?? {}),
    "Store Name": derivedStoreName,
  };
}

function inferAnalyticsAbParameters(workflow: Workflow, node: AppNode) {
  const incomingStores = getActiveIncomingNodes(workflow, node.id).filter(
    (incomingNode) => incomingNode.data.nodeType === "analytics_store",
  );

  if (!incomingStores.length) return null;

  const storeNames = incomingStores
    .map((storeNode) => getParameter(storeNode, "Store Name"))
    .filter(Boolean);

  if (!storeNames.length) return null;

  return {
    ...(node.data.parameters ?? {}),
    "Store Names": storeNames.join(","),
    "Variant Field": getParameter(node, "Variant Field") || "variant",
    "Conversion Field": getParameter(node, "Conversion Field") || "converted",
    "Revenue Field": getParameter(node, "Revenue Field") || "amount",
    Significance: getParameter(node, "Significance") || "95%",
    "Minimum Sample": getParameter(node, "Minimum Sample") || "100",
  };
}

function inferAnalyticsCompareParameters(workflow: Workflow, node: AppNode) {
  const sources = getAnalyticsCompareSources(workflow, node);
  if (!sources.length) return null;

  return {
    ...(node.data.parameters ?? {}),
    "Input A Label": sources[0]?.label ?? "",
    "Input B Label": sources[1]?.label ?? "",
    Metric: getCompareMetric(node, sources),
  };
}

function inferIfParameters(workflow: Workflow, node: AppNode) {
  const keys = getIncomingFieldKeys(workflow, node.id);
  const label = normalizeKey(node.data.label ?? "");
  const currentValue1 = getParameter(node, "Value 1");

  if (
    keys.has("winner") &&
    (!currentValue1 || currentValue1.includes("winner") || label.includes("winner"))
  ) {
    return {
      ...(node.data.parameters ?? {}),
      "Value 1": "{{ input.first.winner }}",
      Operation: "not equals",
      "Value 2": "insufficient_sample",
    };
  }

  if (
    keys.has("converted") &&
    (!currentValue1 || currentValue1.includes("converted") || label.includes("convert"))
  ) {
    return {
      ...(node.data.parameters ?? {}),
      "Value 1": "{{ input.first.converted }}",
      Operation: "equals",
      "Value 2": "true",
    };
  }

  if (
    keys.has("success") &&
    (!currentValue1 || currentValue1.includes("success") || label.includes("success"))
  ) {
    return {
      ...(node.data.parameters ?? {}),
      "Value 1": "{{ input.first.success }}",
      Operation: "equals",
      "Value 2": "true",
    };
  }

  return null;
}

function inferChartConfig(workflow: Workflow, node: AppNode) {
  const compareNode = getUpstreamCompareNode(workflow, node.id);
  if (compareNode) {
    const sources = getAnalyticsCompareSources(workflow, compareNode);
    const metric = getCompareMetric(compareNode, sources);
    if (!sources.length) return null;

    return {
      ...(node.data.config ?? {}),
      variant: getCompareMetricVariant(metric),
      chartType: "bar",
      xAxisLabel: "Source",
      yAxisLabel: metric,
      series: sources.map((source) => ({
        label: source.label,
        value: source.value,
      })),
    };
  }

  const analyzerNode = getUpstreamAnalyzerNode(workflow, node.id);
  if (!analyzerNode) return null;
  const variants = getAnalyticsAbVariants(analyzerNode);
  if (!variants.length) return null;

  return {
    ...(node.data.config ?? {}),
    variant: "conversion",
    chartType: "bar",
    xAxisLabel: "Variant",
    yAxisLabel: "Conversion %",
    series: variants.map((variant) => ({
      label: variant.label,
      value: variant.conversionRate,
    })),
  };
}

function inferTableConfig(workflow: Workflow, node: AppNode) {
  const analyzerNode = getUpstreamAnalyzerNode(workflow, node.id);
  if (!analyzerNode) return null;
  const variants = getAnalyticsAbVariants(analyzerNode);
  if (!variants.length) return null;

  return {
    ...(node.data.config ?? {}),
    variant: "conversion",
    columns: "label,users,conversions,conversionRate,revenue",
    sortBy: "conversionRate",
    rows: variants.map((variant) => ({
      label: variant.label,
      users: variant.users,
      conversions: variant.conversions,
      conversionRate: `${variant.conversionRate.toFixed(2)}%`,
      revenue: variant.revenue,
    })),
  };
}

function inferReportConfig(workflow: Workflow, node: AppNode) {
  const compareNode = getUpstreamCompareNode(workflow, node.id);
  if (compareNode) {
    const sources = getAnalyticsCompareSources(workflow, compareNode);
    const metric = getCompareMetric(compareNode, sources);
    if (!sources.length) return null;

    const leader = [...sources].sort((left, right) => right.value - left.value)[0];
    const insight =
      sources.length === 1
        ? `Tracking 1 active source: ${sources[0]?.label}.`
        : `${leader?.label ?? "Top source"} currently leads ${metric.toLowerCase()} volume across ${sources.length} active sources.`;

    return {
      ...(node.data.config ?? {}),
      reportTitle: node.data.label || "Comparison Report",
      refreshRate: "Every 5m",
      includeAiInsight: "Yes",
      insight,
      reportItems: sources.map((source) => ({
        label: source.label,
        value: `${source.value.toLocaleString()}`,
        delta: `${(source.share * 100).toFixed(1)}% share`,
        positive: source.label === leader?.label,
      })),
    };
  }

  const analyzerNode = getUpstreamAnalyzerNode(workflow, node.id);
  if (!analyzerNode) return null;
  const variants = getAnalyticsAbVariants(analyzerNode);
  if (!variants.length) return null;
  const preview =
    analyzerNode.data.runtime?.outputPreview &&
    typeof analyzerNode.data.runtime.outputPreview === "object" &&
    !Array.isArray(analyzerNode.data.runtime.outputPreview)
      ? (analyzerNode.data.runtime.outputPreview as Record<string, unknown>)
      : {};
  const winner = String(preview.winner ?? "");
  const insight =
    winner && winner !== "insufficient_sample"
      ? `${formatVariantLabel(winner)} currently leads this experiment.`
      : `Tracking ${variants.length} active variant${variants.length === 1 ? "" : "s"}: ${variants
          .map((variant) => variant.label)
          .join(", ")}.`;

  return {
    ...(node.data.config ?? {}),
    reportTitle: "Variant Winner Report",
    refreshRate: "Every 1h",
    includeAiInsight: "Yes",
    insight,
    reportItems: variants.map((variant) => ({
      label: variant.label,
      value: `${variant.conversionRate.toFixed(2)}%`,
      delta: `${variant.conversions}/${variant.users} conv`,
      positive: winner ? slugify(winner) === slugify(variant.key) : true,
    })),
  };
}

function inferMetricConfig(workflow: Workflow, node: AppNode) {
  const compareNode = getUpstreamCompareNode(workflow, node.id);
  if (compareNode) {
    const sources = getAnalyticsCompareSources(workflow, compareNode);
    const metric = getCompareMetric(compareNode, sources);
    const variant = getCompareMetricVariant(metric);
    if (!sources.length) return null;

    const leader = [...sources].sort((left, right) => right.value - left.value)[0];
    const total = sources.reduce((sum, source) => sum + source.value, 0);
    const normalizedLabel = normalizeKey(node.data.label ?? "");
    const configuredSourceKey =
      typeof node.data.config?.comparisonSourceKey === "string"
        ? String(node.data.config?.comparisonSourceKey)
        : "";
    const configuredMode =
      typeof node.data.config?.comparisonMetricMode === "string"
        ? normalizeKey(String(node.data.config?.comparisonMetricMode))
        : "";
    const matchedSource =
      sources.find((source) => source.key === configuredSourceKey) ??
      sources.find((source) => normalizedLabel.includes(normalizeKey(source.label))) ??
      null;

    if (matchedSource) {
      return {
        ...(node.data.config ?? {}),
        variant,
        comparisonMetricMode: "source",
        comparisonSourceKey: matchedSource.key,
        value: `${matchedSource.value.toLocaleString()}`,
        trend: `${(matchedSource.share * 100).toFixed(1)}% of total`,
        compareLabel: metric.toLowerCase(),
      };
    }

    if (
      configuredMode === "total" ||
      normalizedLabel.includes("total") ||
      normalizedLabel.includes("geral")
    ) {
      return {
        ...(node.data.config ?? {}),
        variant,
        comparisonMetricMode: "total",
        value: `${total.toLocaleString()}`,
        trend: `${sources.length} active source${sources.length === 1 ? "" : "s"}`,
        compareLabel: metric.toLowerCase(),
      };
    }

    if (
      configuredMode === "leader" ||
      normalizedLabel.includes("leader") ||
      normalizedLabel.includes("top source") ||
      normalizedLabel.includes("mais erro")
    ) {
      return {
        ...(node.data.config ?? {}),
        variant,
        comparisonMetricMode: "leader",
        value: leader?.label ?? "Pending",
        trend: leader ? `${leader.value.toLocaleString()} ${metric.toLowerCase()}` : "",
        compareLabel: "top source",
      };
    }

    return {
      ...(node.data.config ?? {}),
      variant,
      comparisonMetricMode: "total",
      value: `${total.toLocaleString()}`,
      trend: `${sources.length} active source${sources.length === 1 ? "" : "s"}`,
      compareLabel: metric.toLowerCase(),
    };
  }

  const analyzerNode = getUpstreamAnalyzerNode(workflow, node.id);
  const label = normalizeKey(node.data.label ?? "");

  if (!analyzerNode || !(label.includes("winner") || label.includes("winning"))) {
    return null;
  }
  const preview =
    analyzerNode.data.runtime?.outputPreview &&
    typeof analyzerNode.data.runtime.outputPreview === "object" &&
    !Array.isArray(analyzerNode.data.runtime.outputPreview)
      ? (analyzerNode.data.runtime.outputPreview as Record<string, unknown>)
      : {};
  const winner = String(preview.winner ?? "");
  const winningRate = toNumber(preview.winningRate);
  const hasWinner = Boolean(winner) && winner !== "insufficient_sample";

  return {
    ...(node.data.config ?? {}),
    variant: "custom",
    value: hasWinner ? formatVariantLabel(winner) : "Pending",
    trend: hasWinner ? `+${winningRate.toFixed(2)}%` : "",
    compareLabel: hasWinner ? "Best current variant" : "Waiting for sample",
  };
}

function inferAlertParameters(workflow: Workflow, node: AppNode) {
  const compareNode = getUpstreamCompareNode(workflow, node.id);
  if (compareNode) {
    return {
      ...(node.data.parameters ?? {}),
      Threshold: getParameter(node, "Threshold") || "100",
      Field: getParameter(node, "Field") || "{{ input.first.total }}",
      Channel: getParameter(node, "Channel") || "Slack",
    };
  }

  return null;
}

function inferNotificationParameters(workflow: Workflow, node: AppNode) {
  const incomingNodes = getActiveIncomingNodes(workflow, node.id);
  const hasWinnerCheck = incomingNodes.some((incomingNode) => {
    if (incomingNode.data.nodeType !== "action_if") return false;
    const value1 = getParameter(incomingNode, "Value 1");
    return value1.includes("winner");
  });

  if (!hasWinnerCheck) return null;

  if (node.data.nodeType === "action_slack") {
    return {
      ...(node.data.parameters ?? {}),
      Message:
        getParameter(node, "Message") ||
        "Winner {{ input.first.winner }} with {{ input.first.winningRate }}% conversion.",
    };
  }

  if (node.data.nodeType === "action_email") {
    return {
      ...(node.data.parameters ?? {}),
      Subject: getParameter(node, "Subject") || "A/B test winner detected",
      Message:
        getParameter(node, "Message") ||
        "Winner {{ input.first.winner }} with {{ input.first.winningRate }}% conversion. Review the winner report in Flow Merge.",
    };
  }

  return null;
}

function getExperimentShortLabel(variants: AbVariantSummary[]) {
  const labels = variants.map((variant) => {
    const match = variant.key.match(/^variant_([a-z0-9]+)$/i);
    if (!match) return variant.label;
    return match[1].toUpperCase();
  });

  return labels.join("/");
}

function patchNodeData(node: AppNode, patch: Partial<WorkflowNodeData>) {
  return {
    ...node,
    data: {
      ...node.data,
      ...patch,
      parameters: patch.parameters ?? node.data.parameters,
      config: patch.config ?? node.data.config,
    },
  };
}

function applyWorkflowIntelligencePass(workflow: Workflow): Workflow {
  const nextNodes = workflow.nodes.map((node) => {
    if (!isBuiltinNode(node)) return node;

    switch (node.data.nodeType) {
      case "action_switch": {
        const parameters = inferSwitchParameters(workflow, node);
        return parameters ? patchNodeData(node, { parameters }) : node;
      }
      case "analytics_store": {
        const parameters = inferAnalyticsStoreParameters(workflow, node);
        return parameters ? patchNodeData(node, { parameters }) : node;
      }
      case "analytics_ab": {
        const parameters = inferAnalyticsAbParameters(workflow, node);
        if (!parameters) return node;
        const variants = getAnalyticsAbVariants(
          patchNodeData(node, { parameters }),
        );
        const experimentLabel = getExperimentShortLabel(variants);
        return patchNodeData(node, {
          parameters,
          label: experimentLabel ? `${experimentLabel} Analyzer` : node.data.label,
        });
      }
      case "analytics_compare": {
        const parameters = inferAnalyticsCompareParameters(workflow, node);
        if (!parameters) return node;
        const sources = getAnalyticsCompareSources(workflow, patchNodeData(node, { parameters }));
        const metric = getCompareMetric(patchNodeData(node, { parameters }), sources);
        const sourceLabel =
          sources.length > 1
            ? `${sources.map((source) => source.label).join(" vs ")}`
            : sources[0]?.label ?? node.data.label;

        return patchNodeData(node, {
          parameters,
          label:
            metric.toLowerCase().includes("error") || metric.toLowerCase().includes("erro")
              ? `${sourceLabel} Error Compare`
              : node.data.label,
        });
      }
      case "action_if": {
        const parameters = inferIfParameters(workflow, node);
        return parameters ? patchNodeData(node, { parameters }) : node;
      }
      case "viz_chart": {
        const config = inferChartConfig(workflow, node);
        if (!config) return node;
        const compareNode = getUpstreamCompareNode(workflow, node.id);
        if (compareNode) {
          return patchNodeData(node, {
            config,
            chartType: "bar",
            vizVariant:
              config.variant === "errors" ||
              config.variant === "revenue" ||
              config.variant === "users" ||
              config.variant === "conversion" ||
              config.variant === "aov"
                ? config.variant
                : "custom",
            label:
              normalizeKey(node.data.label).includes("compar") ||
              normalizeKey(node.data.label).includes("error") ||
              normalizeKey(node.data.label).includes("erro")
                ? "Error Volume by Source"
                : node.data.label,
          });
        }
        const analyzerNode = getUpstreamAnalyzerNode(workflow, node.id);
        const variants = analyzerNode ? getAnalyticsAbVariants(analyzerNode) : [];
        const experimentLabel = getExperimentShortLabel(variants);
        return patchNodeData(node, {
          config,
          chartType: "bar",
          vizVariant: "conversion",
          label:
            experimentLabel && normalizeKey(node.data.label).includes("conversion")
              ? `${experimentLabel} Conversion Rate`
              : node.data.label,
        });
      }
      case "viz_table": {
        const config = inferTableConfig(workflow, node);
        return config ? patchNodeData(node, { config, vizVariant: "conversion" }) : node;
      }
      case "viz_report": {
        const config = inferReportConfig(workflow, node);
        if (!config) return node;
        const compareNode = getUpstreamCompareNode(workflow, node.id);
        return patchNodeData(node, {
          config,
          ...(compareNode ? { label: "Error Source Report" } : {}),
        });
      }
      case "viz_metric": {
        const config = inferMetricConfig(workflow, node);
        if (!config) return node;
        const compareNode = getUpstreamCompareNode(workflow, node.id);
        return patchNodeData(node, {
          config,
          vizVariant:
            compareNode &&
            (config.variant === "errors" ||
              config.variant === "revenue" ||
              config.variant === "users" ||
              config.variant === "conversion" ||
              config.variant === "aov")
              ? config.variant
              : "custom",
        });
      }
      case "monitor_alert": {
        const parameters = inferAlertParameters(workflow, node);
        return parameters ? patchNodeData(node, { parameters }) : node;
      }
      case "action_slack":
      case "action_email": {
        const parameters = inferNotificationParameters(workflow, node);
        return parameters ? patchNodeData(node, { parameters }) : node;
      }
      default:
        return node;
    }
  });

  return {
    ...workflow,
    nodes: nextNodes,
  };
}

function areWorkflowsEqual(left: Workflow, right: Workflow) {
  return JSON.stringify(left.nodes) === JSON.stringify(right.nodes) &&
    JSON.stringify(left.edges) === JSON.stringify(right.edges);
}

export function applyWorkflowIntelligence(workflow: Workflow): Workflow {
  let nextWorkflow = workflow;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const updatedWorkflow = applyWorkflowIntelligencePass(nextWorkflow);
    if (areWorkflowsEqual(updatedWorkflow, nextWorkflow)) {
      return updatedWorkflow;
    }
    nextWorkflow = updatedWorkflow;
  }

  return nextWorkflow;
}
