import { describe, expect, it } from "vitest";
import type { AppNode, Project, Workflow, WorkflowNodeData } from "@/lib/flow-types";
import { executeWorkflowRun } from "@/lib/runtime-engine";
import type { ProjectRuntimeStore, WorkflowRunResult } from "@/lib/runtime-types";

function createActionCodeNode(code: string) {
  return {
    id: "node_action_code",
    type: "default",
    position: { x: 0, y: 0 },
    data: {
      label: "Code",
      nodeType: "action_code",
      parameters: {
        Code: code,
      },
      config: {},
    },
  } as unknown as AppNode;
}

function createProjectFixture() {
  return {
    id: "project_1",
    name: "Project",
    active: true,
  } as Project;
}

function createRuntimeStoreFixture() {
  return {
    collections: {},
    lastUpdatedAt: null,
  } as ProjectRuntimeStore;
}

function createWorkflowFixture(node: AppNode) {
  const project = createProjectFixture();
  const workflow = {
    id: "workflow_1",
    projectId: "project_1",
    name: "Workflow",
    active: true,
    nodes: [node],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  } as Workflow;

  return { project, workflow, store: createRuntimeStoreFixture() };
}

function createAbWorkflowFixture(chartVariant: "conversion" | "revenue" = "conversion") {
  const workflow = {
    id: "1a4353df-eb12-448e-87c5-3a695cacc25e",
    projectId: "1b378933-a3f8-456e-955b-84d76df99775",
    name: "A/B - Cor do botao carrinho",
    accent: "#0ea5e9",
    active: true,
    description:
      "Teste A/B ficticio: botao de carrinho verde vs laranja no checkout CloudCart.",
    tags: ["ab-test", "checkout", "ficticio"],
    createdAt: "2026-03-31T06:45:15.989Z",
    updatedAt: "2026-03-31T06:48:24.447Z",
    nodes: [
      {
        id: "eff71687-432b-4dde-982b-f151744a362e",
        type: "shapeNode",
        position: { x: 40, y: 24 },
        data: {
          label: "titulo_ab",
          nodeType: "viz_report",
          shapeType: "text",
          width: 520,
          height: 56,
          text: "CloudCart (demo) - A/B cor do botao carrinho",
          fill: "#0c4a6e",
          strokeColor: "#0ea5e9",
        },
      },
      {
        id: "abd06d2c-bdb6-4734-bba2-2fb0fba1e7f7",
        type: "triggerNode",
        position: { x: 140, y: 120 },
        data: {
          label: "Webhook - botao verde",
          nodeType: "trigger_webhook",
          description: "Eventos do checkout com CTA verde (#22c55e).",
          parameters: {
            Authentication: "None",
            "HTTP Method": "POST",
            Path: "/ab/cloudcart/cart-btn-verde",
            "Tag Field": "variant",
            "Tag Value": "verde",
          },
          config: {},
        },
      },
      {
        id: "6aafcd43-bc4c-4420-a65b-d06d67936faf",
        type: "triggerNode",
        position: { x: 120, y: 320 },
        data: {
          label: "Webhook - botao laranja",
          nodeType: "trigger_webhook",
          description: "Eventos do checkout com CTA laranja (#f97316).",
          parameters: {
            Authentication: "None",
            "HTTP Method": "POST",
            Path: "/ab/cloudcart/cart-btn-laranja",
            "Tag Field": "variant",
            "Tag Value": "laranja",
          },
          config: {},
        },
      },
      {
        id: "6df1c912-e3c8-4f52-9e66-f21726551e64",
        type: "actionNode",
        position: { x: 500, y: 120 },
        data: {
          label: "Store variante verde",
          nodeType: "analytics_store",
          parameters: {
            "Store Name": "ab_verde",
            "TTL (days)": "30",
          },
          config: {},
        },
      },
      {
        id: "12e60fd5-2ef6-4bcc-9c3c-c1d7921517af",
        type: "actionNode",
        position: { x: 500, y: 320 },
        data: {
          label: "Store variante laranja",
          nodeType: "analytics_store",
          parameters: {
            "Store Name": "ab_laranja",
            "TTL (days)": "30",
          },
          config: {},
        },
      },
      {
        id: "c9253de6-7486-4bd7-a8b3-7a44cc8b566f",
        type: "actionNode",
        position: { x: 880, y: 200 },
        data: {
          label: "verde/laranja Analyzer",
          nodeType: "analytics_ab",
          description:
            "Compara conversao e receita entre cores do botao; desempate por receita se taxa igual.",
          parameters: {
            "Conversion Field": "converted",
            "Minimum Sample": "20",
            "Revenue Field": "amount",
            Significance: "95%",
            "Store Names": "ab_verde,ab_laranja",
            "Variant Field": "variant",
          },
          config: {},
        },
      },
      {
        id: "7a8d8059-9c7f-4ad7-8fe4-3f809006e64a",
        type: "vizNode",
        position: { x: 1420, y: 160 },
        data: {
          label:
            chartVariant === "revenue"
              ? "Receita por cor do botao"
              : "Conversao por cor do botao",
          nodeType: "viz_chart",
          chartType: "bar",
          vizVariant: chartVariant,
          config: {
            variant: chartVariant,
            chartType: "bar",
            timeRange: "Last 14 days",
            xAxisLabel: "Variant",
            yAxisLabel: chartVariant === "revenue" ? "Revenue" : "Conversion %",
          },
        },
      },
      {
        id: "afe0db50-e231-4729-a333-c599a6e563fa",
        type: "vizNode",
        position: { x: 1760, y: 400 },
        data: {
          label: "Indicador lider (receita/conversao)",
          nodeType: "viz_metric",
          vizVariant: "revenue",
          config: {
            variant: "revenue",
            value: "Pending",
            trend: "",
            compareLabel: "Need 20+ users",
            comparisonMetricMode: "leader",
          },
        },
      },
      {
        id: "90606280-e170-4db2-a7b0-650f2c651f40",
        type: "vizNode",
        position: { x: 1760, y: 160 },
        data: {
          label: "Relatorio do vencedor",
          nodeType: "viz_report",
          config: {
            reportTitle: "Variant Winner Report",
            refreshRate: "Every 1h",
            includeAiInsight: "Yes",
            insight: "Tracking 2 active variants: verde, laranja.",
          },
        },
      },
    ] as AppNode[],
    edges: [
      {
        source: "abd06d2c-bdb6-4734-bba2-2fb0fba1e7f7",
        target: "6df1c912-e3c8-4f52-9e66-f21726551e64",
        id: "feee16cd-0aeb-4a7c-bb19-8955212e0f45",
      },
      {
        source: "6aafcd43-bc4c-4420-a65b-d06d67936faf",
        target: "12e60fd5-2ef6-4bcc-9c3c-c1d7921517af",
        id: "b1a0a30f-6bab-494a-8a28-5a1d475c5a50",
      },
      {
        source: "6df1c912-e3c8-4f52-9e66-f21726551e64",
        target: "c9253de6-7486-4bd7-a8b3-7a44cc8b566f",
        id: "69927554-ff5b-43fb-b639-6bd716a0ddc3",
      },
      {
        source: "12e60fd5-2ef6-4bcc-9c3c-c1d7921517af",
        target: "c9253de6-7486-4bd7-a8b3-7a44cc8b566f",
        id: "54c6b513-a683-435b-a48d-fda4424de755",
      },
      {
        source: "c9253de6-7486-4bd7-a8b3-7a44cc8b566f",
        target: "7a8d8059-9c7f-4ad7-8fe4-3f809006e64a",
        id: "bf01690d-14c1-4081-a10f-424e219bb7ae",
      },
      {
        source: "c9253de6-7486-4bd7-a8b3-7a44cc8b566f",
        target: "afe0db50-e231-4729-a333-c599a6e563fa",
        id: "d813ea67-1008-44b5-bf80-643fc87960cd",
      },
      {
        source: "c9253de6-7486-4bd7-a8b3-7a44cc8b566f",
        target: "90606280-e170-4db2-a7b0-650f2c651f40",
        id: "de240661-8ef1-4878-8975-be73808a882b",
      },
    ],
  } as Workflow;

  const project = {
    id: "1b378933-a3f8-456e-955b-84d76df99775",
    name: "CloudCart demo",
    accent: "#0ea5e9",
    active: true,
  } as Project;

  return { project, workflow, store: createRuntimeStoreFixture() };
}

function cloneWorkflow<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getPatchForNode(result: WorkflowRunResult, nodeId: string) {
  return result.nodePatches.find((patch) => patch.nodeId === nodeId)?.data ?? null;
}

async function runAbFixture(
  workflow: Workflow,
  project: Project,
  store: ProjectRuntimeStore,
) {
  let nextStore = store;
  let result: WorkflowRunResult | null = null;

  for (let index = 0; index < 5; index += 1) {
    result = await executeWorkflowRun({
      project,
      workflow,
      store: nextStore,
      request: {
        source: "webhook",
        triggerNodeId: "abd06d2c-bdb6-4734-bba2-2fb0fba1e7f7",
        payload: {
          event: "checkout_completed",
          timestamp: "2026-03-31T06:47:29.357Z",
          userId: `usr_green_${index + 1}`,
          sessionId: `sess_green_${index + 1}`,
          productId: "prod_pro_monthly",
          variant: "verde",
          converted: true,
          amount: 79,
        },
      },
    });
    nextStore = result.updatedStore;
  }

  result = await executeWorkflowRun({
    project,
    workflow,
    store: nextStore,
    request: {
      source: "webhook",
      triggerNodeId: "6aafcd43-bc4c-4420-a65b-d06d67936faf",
      payload: {
        event: "checkout_completed",
        timestamp: "2026-03-31T06:47:57.124Z",
        userId: "usr_orange_1",
        sessionId: "sess_orange_1",
        productId: "prod_pro_monthly",
        variant: "laranja",
        converted: true,
        amount: 79,
      },
    },
  });

  return result;
}

describe("executeWorkflowRun", () => {
  it("mantem o workflow funcional com action_code seguro", async () => {
    const node = createActionCodeNode(`
      return items.map((item) => ({
        echoedEvent: item.json.event,
      }));
    `);
    const { project, workflow, store } = createWorkflowFixture(node);

    const result = await executeWorkflowRun({
      project,
      workflow,
      store,
      request: {
        source: "manual",
      },
    });

    expect(result.executionStatus).toBe("success");
    expect(result.nodeSnapshots[node.id]?.status).toBe("success");
    expect(result.itemsProcessed).toBeGreaterThan(0);
  });

  it("marca erro quando action_code tenta usar capacidades bloqueadas", async () => {
    const node = createActionCodeNode(`
      return localStorage.getItem("token");
    `);
    const { project, workflow, store } = createWorkflowFixture(node);

    const result = await executeWorkflowRun({
      project,
      workflow,
      store,
      request: {
        source: "manual",
      },
    });

    expect(result.executionStatus).toBe("error");
    expect(result.nodeSnapshots[node.id]?.status).toBe("error");
    expect(result.nodeSnapshots[node.id]?.summary).toMatch(/capacidades bloqueadas/i);
  });

  it("usa um workflow JSON customizado para validar A/B com lideranca financeira real", async () => {
    const { project, workflow, store } = createAbWorkflowFixture();
    const result = await runAbFixture(workflow, project, store);

    expect(result.executionStatus).toBe("success");

    const analyzerPreview = result.nodeSnapshots["c9253de6-7486-4bd7-a8b3-7a44cc8b566f"]
      ?.outputPreview as
      | {
          winner: string;
          minimumSample: number;
          variants: Array<{ label: string; users: number; revenue: number; conversionRate: number }>;
        }
      | undefined;
    expect(analyzerPreview?.winner).toBe("insufficient_sample");
    expect(analyzerPreview?.minimumSample).toBe(20);
    expect(analyzerPreview?.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "verde",
          users: 5,
          revenue: 395,
          conversionRate: 100,
        }),
        expect.objectContaining({
          label: "laranja",
          users: 1,
          revenue: 79,
          conversionRate: 100,
        }),
      ]),
    );

    const metricPatch = getPatchForNode(result, "afe0db50-e231-4729-a333-c599a6e563fa") as
      | Partial<WorkflowNodeData>
      | null;
    expect(metricPatch?.config).toEqual(
      expect.objectContaining({
        value: "verde",
        compareLabel: "Need 20+ users",
      }),
    );
    expect(String((metricPatch?.config as Record<string, unknown>)?.trend ?? "")).toContain(
      "R$",
    );

    const reportPatch = getPatchForNode(result, "90606280-e170-4db2-a7b0-650f2c651f40") as
      | Partial<WorkflowNodeData>
      | null;
    const reportConfig = (reportPatch?.config ?? {}) as Record<string, unknown>;
    expect(String(reportConfig.insight ?? "")).toContain("Need at least 20 users");
    expect(String(reportConfig.insight ?? "")).toContain("verde currently leads revenue");

    const reportItems = Array.isArray(reportConfig.reportItems)
      ? (reportConfig.reportItems as Array<Record<string, unknown>>)
      : [];
    expect(reportItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "verde",
          value: "100.00% conv",
          delta: expect.stringContaining("R$"),
        }),
        expect.objectContaining({
          label: "laranja",
          value: "100.00% conv",
          delta: expect.stringContaining("R$"),
        }),
      ]),
    );
  });

  it("respeita o variant configurado no chart quando o dataset A/B pede receita", async () => {
    const { project, workflow, store } = createAbWorkflowFixture("revenue");
    const result = await runAbFixture(cloneWorkflow(workflow), project, store);

    const chartPatch = getPatchForNode(result, "7a8d8059-9c7f-4ad7-8fe4-3f809006e64a") as
      | Partial<WorkflowNodeData>
      | null;
    const chartConfig = (chartPatch?.config ?? {}) as Record<string, unknown>;
    const series = Array.isArray(chartConfig.series)
      ? (chartConfig.series as Array<Record<string, unknown>>)
      : [];

    expect(series).toEqual([
      { label: "verde", value: 395 },
      { label: "laranja", value: 79 },
    ]);
  });
});
