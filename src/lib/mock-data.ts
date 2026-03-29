import { v4 as uuidv4 } from "uuid";
import type { Edge, XYPosition } from "@xyflow/react";
import { getNodeMeta, type NodeTypeId } from "@/lib/node-catalog";
import { getDefaultNodeConfig, getNodeSchema } from "@/lib/node-config";
import type { AppNode, Execution, Project, Workflow, WorkflowNodeData } from "@/lib/flow-types";

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function getNodeShellType(nodeType: NodeTypeId): AppNode["type"] {
  return getNodeMeta(nodeType).shellType;
}

function makeNode(
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
    type: getNodeShellType(nodeType),
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
      config: { ...defaultConfig, ...overrides.config },
    },
  };
}

function edge(source: string, target: string, sourceHandle?: string): Edge {
  return {
    id: `${source}-${target}${sourceHandle ? `-${sourceHandle}` : ""}`,
    source,
    target,
    sourceHandle,
    style: { stroke: "#30363d", strokeWidth: 1.5 },
  };
}

function remapIds(nodes: AppNode[], prefix: string) {
  return nodes.map((node, index) => ({ ...node, id: `${prefix}-${index + 1}` }));
}

export function createMockProjects(): Project[] {
  return [
    {
      id: "proj_growth",
      name: "Growth Lab",
      description: "Experimentacao, funis e otimizacao de conversao.",
      accent: "#1f6feb",
      active: true,
    },
    {
      id: "proj_revenue",
      name: "Revenue Ops",
      description: "Receita, dashboards operacionais e metricas financeiras.",
      accent: "#3fb950",
      active: true,
    },
    {
      id: "proj_reliability",
      name: "Reliability",
      description: "Monitoramento, incidentes e impacto tecnico no negocio.",
      accent: "#d29922",
      active: true,
    },
  ];
}

export function createMockWorkflows(): Workflow[] {
  const wfCartNodes = remapIds(
    [
      makeNode("trigger_webhook", { x: 80, y: 220 }, { label: "Cart Event" }),
      makeNode("analytics_enrich", { x: 360, y: 220 }, { label: "Enrich User" }),
      makeNode("analytics_store", { x: 660, y: 220 }, { label: "Event Store" }),
      makeNode("analytics_aggregate", { x: 960, y: 220 }, { label: "Group by Day" }),
      makeNode("viz_metric", { x: 1280, y: 60 }, { label: "Total Revenue", vizVariant: "revenue" }),
      makeNode("viz_metric", { x: 1280, y: 260 }, { label: "Conversion Rate", vizVariant: "conversion" }),
      makeNode("viz_chart", { x: 1560, y: 60 }, { label: "Daily Revenue", chartType: "line", vizVariant: "revenue" }),
      makeNode("viz_table", { x: 1560, y: 340 }, { label: "Top Products" }),
      makeNode("action_openai", { x: 960, y: 460 }, { label: "AI Insights" }),
      makeNode("monitor_alert", { x: 1280, y: 480 }, { label: "Revenue Alert" }),
    ],
    "cart",
  );

  const wfAbNodes = remapIds(
    [
      makeNode("trigger_webhook", { x: 80, y: 120 }, { label: "Variant A" }),
      makeNode("trigger_webhook", { x: 80, y: 360 }, { label: "Variant B" }),
      makeNode("analytics_store", { x: 360, y: 120 }, { label: "Store A" }),
      makeNode("analytics_store", { x: 360, y: 360 }, { label: "Store B" }),
      makeNode("analytics_ab", { x: 680, y: 240 }, { label: "A/B Analyzer" }),
      makeNode("viz_chart", { x: 980, y: 80 }, { label: "Conversion A vs B", chartType: "bar", vizVariant: "conversion" }),
      makeNode("viz_report", { x: 980, y: 340 }, { label: "Winner Report" }),
      makeNode("action_if", { x: 1280, y: 240 }, { label: "Winner Found?" }),
      makeNode("action_slack", { x: 1540, y: 120 }, { label: "Announce Winner" }),
      makeNode("action_email", { x: 1540, y: 360 }, { label: "Notify Team" }),
    ],
    "ab",
  );

  const wfErrorNodes = remapIds(
    [
      makeNode("trigger_schedule", { x: 80, y: 220 }, { label: "Every 5 min" }),
      makeNode("action_http", { x: 360, y: 220 }, { label: "Fetch Error Logs" }),
      makeNode("monitor_error", { x: 660, y: 220 }, { label: "Parse & Classify" }),
      makeNode("monitor_revenue", { x: 960, y: 220 }, { label: "Revenue Lookup" }),
      makeNode("analytics_compare", { x: 1260, y: 220 }, { label: "Errors vs Revenue" }),
      makeNode("viz_metric", { x: 1560, y: 60 }, { label: "Error Rate", vizVariant: "errors" }),
      makeNode("viz_chart", { x: 1560, y: 280 }, { label: "Impact Overlay", chartType: "area", vizVariant: "errors" }),
      makeNode("monitor_alert", { x: 1860, y: 140 }, { label: "P0 Alert" }),
      makeNode("action_slack", { x: 1860, y: 360 }, { label: "Incident Channel" }),
    ],
    "err",
  );

  const wfFunnelNodes = remapIds(
    [
      makeNode("trigger_webhook", { x: 80, y: 220 }, { label: "Page View Event" }),
      makeNode("analytics_segment", { x: 360, y: 220 }, { label: "Identify Stage" }),
      makeNode("analytics_funnel", { x: 660, y: 220 }, { label: "Funnel Builder" }),
      makeNode("viz_funnel", { x: 980, y: 220 }, { label: "Signup to Paid Funnel" }),
      makeNode("viz_metric", { x: 1280, y: 90 }, { label: "Activation Rate", vizVariant: "conversion" }),
      makeNode("viz_report", { x: 1280, y: 310 }, { label: "Funnel Report" }),
      makeNode("action_if", { x: 980, y: 470 }, { label: "Drop-off?" }),
      makeNode("action_openai", { x: 1280, y: 520 }, { label: "Personalized Copy" }),
      makeNode("action_email", { x: 1560, y: 520 }, { label: "Re-engagement Email" }),
    ],
    "fun",
  );

  const wfDashboardNodes = remapIds(
    [
      makeNode("trigger_schedule", { x: 80, y: 260 }, { label: "Daily Sync" }),
      makeNode("action_http", { x: 360, y: 260 }, { label: "Fetch SaaS Metrics" }),
      makeNode("analytics_aggregate", { x: 660, y: 260 }, { label: "Blend KPIs" }),
      makeNode("viz_dashboard", { x: 980, y: 90 }, { label: "Operator Dashboard" }),
      makeNode("viz_metric", { x: 1600, y: 80 }, { label: "MRR Snapshot", vizVariant: "revenue" }),
      makeNode("viz_chart", { x: 1600, y: 320 }, { label: "Weekly Growth", chartType: "line", vizVariant: "users" }),
    ],
    "dash",
  );

  return [
    {
      id: "wf_cart",
      projectId: "proj_revenue",
      name: "SaaS Cart Analytics",
      accent: "#3fb950",
      active: true,
      description: "Captura eventos de carrinho, agrega receita e gera métricas no canvas.",
      tags: ["analytics", "revenue", "saas"],
      createdAt: nowIso(-86400000 * 7),
      updatedAt: nowIso(-3600000),
      nodes: wfCartNodes,
      edges: [
        edge("cart-1", "cart-2"),
        edge("cart-2", "cart-3"),
        edge("cart-3", "cart-4"),
        edge("cart-4", "cart-5"),
        edge("cart-4", "cart-6"),
        edge("cart-4", "cart-7"),
        edge("cart-4", "cart-8"),
        edge("cart-3", "cart-9"),
        edge("cart-9", "cart-10"),
      ],
    },
    {
      id: "wf_ab",
      projectId: "proj_growth",
      name: "A/B Test Pricing",
      accent: "#1f6feb",
      active: true,
      description: "Compara variantes de pricing e decide vencedor automaticamente.",
      tags: ["ab-test", "pricing", "conversion"],
      createdAt: nowIso(-86400000 * 14),
      updatedAt: nowIso(-5400000),
      nodes: wfAbNodes,
      edges: [
        edge("ab-1", "ab-3"),
        edge("ab-2", "ab-4"),
        edge("ab-3", "ab-5"),
        edge("ab-4", "ab-5"),
        edge("ab-5", "ab-6"),
        edge("ab-5", "ab-7"),
        edge("ab-7", "ab-8"),
        edge("ab-8", "ab-9", "true"),
        edge("ab-8", "ab-10", "false"),
      ],
    },
    {
      id: "wf_errors",
      projectId: "proj_reliability",
      name: "Error to Revenue Impact",
      accent: "#d29922",
      active: true,
      description: "Relaciona erros da aplicação com impacto em receita e incidentes.",
      tags: ["monitoring", "errors", "revenue"],
      createdAt: nowIso(-86400000 * 5),
      updatedAt: nowIso(-2400000),
      nodes: wfErrorNodes,
      edges: [
        edge("err-1", "err-2"),
        edge("err-2", "err-3"),
        edge("err-3", "err-4"),
        edge("err-4", "err-5"),
        edge("err-5", "err-6"),
        edge("err-5", "err-7"),
        edge("err-6", "err-8"),
        edge("err-8", "err-9"),
      ],
    },
    {
      id: "wf_funnel",
      projectId: "proj_growth",
      name: "User Funnel Signup to Paid",
      accent: "#58a6ff",
      active: false,
      description: "Monitora jornada do usuário do primeiro evento até pagamento.",
      tags: ["funnel", "activation", "growth"],
      createdAt: nowIso(-86400000 * 21),
      updatedAt: nowIso(-86400000 * 2),
      nodes: wfFunnelNodes,
      edges: [
        edge("fun-1", "fun-2"),
        edge("fun-2", "fun-3"),
        edge("fun-3", "fun-4"),
        edge("fun-3", "fun-5"),
        edge("fun-3", "fun-6"),
        edge("fun-2", "fun-7"),
        edge("fun-7", "fun-8", "true"),
        edge("fun-8", "fun-9"),
      ],
    },
    {
      id: "wf_dashboard",
      projectId: "proj_revenue",
      name: "Growth Command Center",
      accent: "#a371f7",
      active: true,
      description: "Mistura o canvas analítico do A com o dashboard interativo do B.",
      tags: ["dashboard", "operators", "hybrid"],
      createdAt: nowIso(-86400000 * 3),
      updatedAt: nowIso(-1800000),
      nodes: wfDashboardNodes,
      edges: [
        edge("dash-1", "dash-2"),
        edge("dash-2", "dash-3"),
        edge("dash-3", "dash-4"),
        edge("dash-3", "dash-5"),
        edge("dash-3", "dash-6"),
      ],
    },
  ];
}

export function createMockExecutions(workflows: Workflow[]): Execution[] {
  const statuses: Execution["status"][] = ["success", "success", "success", "error", "running"];
  return workflows.flatMap((workflow, workflowIndex) =>
    Array.from({ length: 4 }, (_, index) => {
      const startedAt = new Date(Date.now() - (workflowIndex * 4 + index + 1) * 5400000);
      return {
        id: uuidv4(),
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: statuses[(workflowIndex + index) % statuses.length],
        startedAt: startedAt.toISOString(),
        duration: 600 + (workflowIndex + 1) * (index + 1) * 230,
        itemsProcessed: 18 + workflowIndex * 140 + index * 37,
      };
    }),
  );
}
