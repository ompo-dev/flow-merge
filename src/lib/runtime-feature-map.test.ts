import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppNode, Project, Workflow } from "@/lib/flow-types";
import { executeWorkflowRun } from "@/lib/runtime-engine";
import type {
  ProjectRuntimeStore,
  RuntimeCollectionRecord,
  WorkflowRunResult,
} from "@/lib/runtime-types";

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as typeof globalThis & { window?: typeof globalThis }).window;

function getShellType(nodeType: string): AppNode["type"] {
  if (nodeType === "viz_dashboard") return "dashboardNode";
  if (nodeType.startsWith("viz_")) return "vizNode";
  if (nodeType.startsWith("trigger_")) return "triggerNode";
  return "actionNode";
}

function createNode(
  id: string,
  nodeType: string,
  label: string,
  options: {
    position?: { x: number; y: number };
    parameters?: Record<string, string>;
    config?: Record<string, unknown>;
    chartType?: "line" | "bar" | "area";
    vizVariant?: "revenue" | "conversion" | "users" | "errors" | "aov" | "custom";
    type?: AppNode["type"];
  } = {},
) {
  return {
    id,
    type: options.type ?? getShellType(nodeType),
    position: options.position ?? { x: 0, y: 0 },
    data: {
      label,
      nodeType,
      parameters: options.parameters ?? {},
      config: options.config ?? {},
      chartType: options.chartType,
      vizVariant: options.vizVariant,
    },
  } as AppNode;
}

function createEdge(source: string, target: string, sourceHandle?: string) {
  return {
    id: `${source}-${target}${sourceHandle ? `-${sourceHandle}` : ""}`,
    source,
    target,
    sourceHandle,
  };
}

function createProject(id: string, name: string) {
  return {
    id,
    name,
    active: true,
  } as Project;
}

function createWorkflow(
  id: string,
  projectId: string,
  name: string,
  nodes: AppNode[],
  edges: Array<ReturnType<typeof createEdge>>,
) {
  return {
    id,
    projectId,
    name,
    active: true,
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    tags: [],
    nodes,
    edges,
  } as Workflow;
}

function createCollectionRecord(
  id: string,
  sourceNodeId: string,
  payload: Record<string, unknown>,
): RuntimeCollectionRecord {
  return {
    id,
    sourceNodeId,
    payload,
    timestamp: Date.now(),
  };
}

function createStore(
  collections: Record<string, RuntimeCollectionRecord[]> = {},
): ProjectRuntimeStore {
  return {
    collections,
    lastUpdatedAt: null,
  };
}

function getPatchConfig(result: WorkflowRunResult, nodeId: string) {
  return (result.nodePatches.find((patch) => patch.nodeId === nodeId)?.data.config ??
    {}) as Record<string, unknown>;
}

function mockFetchRoutes(
  routes: Record<
    string,
    {
      status?: number;
      body?: unknown;
      text?: string;
    }
  >,
) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) {
      throw new Error(`Unexpected fetch URL in test: ${url}`);
    }

    const body =
      route.text ??
      (route.body === undefined ? "" : JSON.stringify(route.body));
    return new Response(body, {
      status: route.status ?? 200,
      headers: {
        "content-type": route.text ? "text/plain" : "application/json",
      },
    });
  });

  Object.defineProperty(globalThis, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "fetch", {
    value: originalFetch,
    writable: true,
    configurable: true,
  });
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  }
});

describe("feature-map workflow fixtures", () => {
  it("executa um fluxo de checkout por webhook com enrich, aggregate, viz e alerta", async () => {
    mockFetchRoutes({
      "https://ai.example.com/chat": {
        body: {
          choices: [
            {
              message: {
                content: "Checkout revenue looks healthy and the product starter is leading.",
              },
            },
          ],
        },
      },
    });

    const project = createProject("proj_checkout", "Checkout Revenue");
    const workflow = createWorkflow(
      "wf_checkout",
      project.id,
      "Receita por webhook de checkout",
      [
        createNode("checkout-1", "trigger_webhook", "Checkout Event"),
        createNode("checkout-2", "analytics_enrich", "Enrich User", {
          parameters: {
            Source: "crm_profiles",
            "Join Field": "user_id",
          },
        }),
        createNode("checkout-3", "analytics_store", "Event Store", {
          parameters: { "Store Name": "checkout_events" },
        }),
        createNode("checkout-4", "analytics_aggregate", "Revenue by Product", {
          parameters: {
            "Group By": "{{ $json.productId }}",
            Aggregation: "sum",
            Field: "{{ $json.amount }}",
          },
        }),
        createNode("checkout-5", "viz_metric", "Total Revenue", {
          vizVariant: "revenue",
          config: { variant: "revenue" },
        }),
        createNode("checkout-6", "viz_chart", "Revenue by Product Chart", {
          chartType: "bar",
          vizVariant: "revenue",
          config: { variant: "revenue", chartType: "bar" },
        }),
        createNode("checkout-7", "viz_table", "Top Products", {
          config: { variant: "revenue" },
        }),
        createNode("checkout-8", "action_openai", "AI Insights", {
          parameters: {
            "API Key": "test-openai-key",
            "API Base URL": "https://ai.example.com/chat",
            Model: "deepseek-chat",
            Prompt: "Summarize the revenue movement.",
          },
        }),
        createNode("checkout-9", "monitor_alert", "Revenue Alert", {
          parameters: {
            Threshold: "100",
            Field: "{{ $json.value }}",
            Channel: "log",
          },
        }),
        createNode("checkout-10", "viz_dashboard", "Operator Dashboard", {
          type: "dashboardNode",
          config: {
            title: "Checkout Overview",
            layout: "6 columns",
          },
        }),
      ],
      [
        createEdge("checkout-1", "checkout-2"),
        createEdge("checkout-2", "checkout-3"),
        createEdge("checkout-3", "checkout-4"),
        createEdge("checkout-4", "checkout-5"),
        createEdge("checkout-4", "checkout-6"),
        createEdge("checkout-4", "checkout-7"),
        createEdge("checkout-4", "checkout-8"),
        createEdge("checkout-4", "checkout-9"),
        createEdge("checkout-4", "checkout-10"),
      ],
    );
    const store = createStore({
      crm_profiles: [
        createCollectionRecord("profile-1", "seed", {
          user_id: "usr_checkout_1",
          plan: "pro",
          country: "BR",
        }),
      ],
    });

    const result = await executeWorkflowRun({
      project,
      workflow,
      store,
      request: {
        source: "webhook",
        triggerNodeId: "checkout-1",
        payload: {
          user_id: "usr_checkout_1",
          productId: "starter",
          amount: 149,
          converted: true,
        },
      },
    });

    expect(result.executionStatus).toBe("success");
    expect(result.updatedStore.collections.checkout_events).toHaveLength(1);
    expect(result.nodeSnapshots["checkout-2"]?.status).toBe("success");
    expect(result.nodeSnapshots["checkout-8"]?.summary).toBe("AI insight generated");
    expect(result.nodeSnapshots["checkout-9"]?.outputPreview).toEqual(
      expect.objectContaining({
        triggered: true,
        threshold: 100,
      }),
    );
    expect(getPatchConfig(result, "checkout-6").series).toEqual([
      { label: "starter", value: 149 },
    ]);
    expect(getPatchConfig(result, "checkout-7").rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "starter",
          value: 149,
        }),
      ]),
    );
  });

  it("executa um fluxo schedule de erros para impacto financeiro e comparacao de fontes", async () => {
    const project = createProject("proj_errors", "Error Impact");
    const workflow = createWorkflow(
      "wf_errors_feature",
      project.id,
      "Erro para impacto em receita",
      [
        createNode("errors-1", "trigger_schedule", "Every 5 min"),
        createNode("errors-2", "action_function", "Load Error Batch", {
          parameters: {
            Code: `
              return [
                { level: "error", message: "checkout timeout", amount: 320, sourceArea: "checkout" },
                { level: "fatal", message: "db timeout", amount: 180, sourceArea: "database" },
                { level: "info", message: "warm cache", amount: 0, sourceArea: "cache" },
              ];
            `,
          },
        }),
        createNode("errors-3", "monitor_error", "Parse & Classify", {
          parameters: {
            "Level Filter": "error + fatal",
            Pattern: "timeout|db",
          },
        }),
        createNode("errors-4", "analytics_store", "Error Events", {
          parameters: { "Store Name": "obs_errors" },
        }),
        createNode("errors-5", "monitor_revenue", "Revenue Impact", {
          parameters: {
            Metric: "mrr",
            Currency: "BRL",
          },
        }),
        createNode("errors-6", "analytics_store", "Revenue Impact Store", {
          parameters: { "Store Name": "obs_revenue" },
        }),
        createNode("errors-7", "analytics_compare", "Errors vs Revenue"),
        createNode("errors-8", "viz_metric", "Top Source", {
          vizVariant: "revenue",
          config: { comparisonMetricMode: "leader", variant: "revenue" },
        }),
        createNode("errors-9", "viz_chart", "Impact Overlay", {
          chartType: "bar",
          vizVariant: "errors",
          config: { chartType: "bar", variant: "errors" },
        }),
        createNode("errors-10", "monitor_alert", "P0 Alert", {
          parameters: {
            Threshold: "1",
            Field: "{{ input.first.total }}",
            Channel: "log",
          },
        }),
        createNode("errors-11", "action_slack", "Incident Channel"),
      ],
      [
        createEdge("errors-1", "errors-2"),
        createEdge("errors-2", "errors-3"),
        createEdge("errors-3", "errors-4"),
        createEdge("errors-3", "errors-5"),
        createEdge("errors-5", "errors-6"),
        createEdge("errors-4", "errors-7"),
        createEdge("errors-6", "errors-7"),
        createEdge("errors-7", "errors-8"),
        createEdge("errors-7", "errors-9"),
        createEdge("errors-7", "errors-10"),
        createEdge("errors-10", "errors-11"),
      ],
    );

    const result = await executeWorkflowRun({
      project,
      workflow,
      store: createStore(),
      request: {
        source: "schedule",
        triggerNodeId: "errors-1",
      },
    });

    expect(result.executionStatus).toBe("success");
    expect(result.nodeSnapshots["errors-3"]?.summary).toBe("2 error(s) classified");
    expect(result.nodeSnapshots["errors-7"]?.outputPreview).toEqual(
      expect.objectContaining({
        leader: "Revenue Impact Store",
        sourceCount: 2,
      }),
    );
    expect(getPatchConfig(result, "errors-8")).toEqual(
      expect.objectContaining({
        value: "Revenue Impact Store",
      }),
    );
    expect(getPatchConfig(result, "errors-9").series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Error Events" }),
        expect.objectContaining({ label: "Revenue Impact Store" }),
      ]),
    );
    expect(result.nodeSnapshots["errors-11"]?.summary).toBe("Slack payload prepared");
  });

  it("executa um fluxo manual de funnel e segmentacao com viz no proprio canvas", async () => {
    const project = createProject("proj_funnel", "Funnel");
    const workflow = createWorkflow(
      "wf_funnel_feature",
      project.id,
      "Funnel de trial para paid",
      [
        createNode("funnel-1", "trigger_manual", "Manual Trigger"),
        createNode("funnel-2", "action_set", "Set Campaign", {
          parameters: {
            "Field Name": "campaign",
            "Field Value": "spring_launch",
          },
        }),
        createNode("funnel-3", "action_function", "Generate Events", {
          parameters: {
            Code: `
              return [
                { event: "page_view", segment: "trial", campaign: items[0].json.campaign },
                { event: "page_view", segment: "trial", campaign: items[0].json.campaign },
                { event: "page_view", segment: "trial", campaign: items[0].json.campaign },
                { event: "signup", segment: "trial", campaign: items[0].json.campaign },
                { event: "signup", segment: "trial", campaign: items[0].json.campaign },
                { event: "paid", segment: "paid", campaign: items[0].json.campaign },
              ];
            `,
          },
        }),
        createNode("funnel-4", "analytics_segment", "Identify Stage", {
          parameters: {
            "Segment Field": "{{ $json.segment }}",
            Values: "trial,paid",
          },
        }),
        createNode("funnel-5", "viz_table", "Segment Table"),
        createNode("funnel-6", "analytics_funnel", "Funnel Builder", {
          parameters: {
            "Step 1": "page_view",
            "Step 2": "signup",
            "Step 3": "paid",
          },
        }),
        createNode("funnel-7", "viz_funnel", "Signup to Paid Funnel"),
        createNode("funnel-8", "viz_metric", "Activation Rate", {
          vizVariant: "conversion",
          config: { variant: "conversion" },
        }),
        createNode("funnel-9", "viz_report", "Funnel Report"),
        createNode("funnel-10", "action_if", "Drop-off?", {
          parameters: {
            "Value 1": "{{ $json.value }}",
            Operation: "less than",
            "Value 2": "10",
          },
        }),
        createNode("funnel-11", "action_email", "Re-engagement Email"),
      ],
      [
        createEdge("funnel-1", "funnel-2"),
        createEdge("funnel-2", "funnel-3"),
        createEdge("funnel-3", "funnel-4"),
        createEdge("funnel-4", "funnel-5"),
        createEdge("funnel-3", "funnel-6"),
        createEdge("funnel-6", "funnel-7"),
        createEdge("funnel-6", "funnel-8"),
        createEdge("funnel-6", "funnel-9"),
        createEdge("funnel-6", "funnel-10"),
        createEdge("funnel-10", "funnel-11", "true"),
      ],
    );

    const result = await executeWorkflowRun({
      project,
      workflow,
      store: createStore(),
      request: {
        source: "manual",
        triggerNodeId: "funnel-1",
        payload: {
          operator: "maicon",
        },
      },
    });

    expect(result.executionStatus).toBe("success");
    expect(getPatchConfig(result, "funnel-5").rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "trial", value: 5 }),
        expect.objectContaining({ label: "paid", value: 1 }),
      ]),
    );
    expect(getPatchConfig(result, "funnel-7").stages).toEqual([
      { label: "page_view", value: 3 },
      { label: "signup", value: 2 },
      { label: "paid", value: 1 },
    ]);
    expect(result.nodeSnapshots["funnel-10"]?.summary).toBe("Condition matched");
    expect(result.nodeSnapshots["funnel-11"]?.summary).toBe("Email payload prepared");
  });

  it("executa um fluxo HTTP + integracoes com switch, filtro, wait e respond", async () => {
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
      configurable: true,
    });
    mockFetchRoutes({
      "https://api.example.com/status": {
        body: {
          ok: true,
          jobs: 3,
        },
      },
      "https://api.github.com/repos/acme/repo/pulls": {
        body: [{ number: 42, title: "Improve checkout" }],
      },
      "https://api.notion.com/v1/pages": {
        body: { id: "page_1" },
      },
      "https://ai.example.com/chat": {
        body: {
          choices: [
            {
              message: {
                content: "All systems synced and ready for the operator.",
              },
            },
          ],
        },
      },
      "https://api.resend.com/emails": {
        body: { id: "email_1" },
      },
    });

    const project = createProject("proj_integrations", "Integrations");
    const workflow = createWorkflow(
      "wf_integrations_feature",
      project.id,
      "HTTP e integracoes",
      [
        createNode("integrations-1", "trigger_manual", "Manual Trigger"),
        createNode("integrations-2", "action_http", "Fetch SaaS Metrics", {
          parameters: {
            Method: "GET",
            URL: "https://api.example.com/status",
            "Response Format": "json",
          },
        }),
        createNode("integrations-3", "action_filter", "Only Success", {
          parameters: {
            Field: "{{ $json.status }}",
            Rule: "greater or equal",
            Value: "200",
          },
        }),
        createNode("integrations-4", "action_switch", "Status Switch", {
          parameters: {
            Value: "{{ $json.status }}",
            "Case 1": "200",
          },
        }),
        createNode("integrations-5", "action_github", "GitHub PR", {
          parameters: {
            Token: "gh_test",
            Owner: "acme",
            Repository: "repo",
            Operation: "get pull request",
          },
        }),
        createNode("integrations-6", "action_notion", "Notion Sync", {
          parameters: {
            Token: "notion_test",
            "Database ID": "db_123",
            Operation: "create",
          },
        }),
        createNode("integrations-7", "action_openai", "AI Summary", {
          parameters: {
            "API Key": "openai_test",
            "API Base URL": "https://ai.example.com/chat",
            Prompt: "Summarize the sync state.",
          },
        }),
        createNode("integrations-8", "action_email", "Notify Team", {
          parameters: {
            "API Key": "resend_test",
            From: "ops@flowmerge.app",
            To: "team@flowmerge.app",
            Subject: "Sync completed",
          },
        }),
        createNode("integrations-9", "action_wait", "Wait a bit", {
          parameters: {
            Amount: "0",
            Unit: "seconds",
          },
        }),
        createNode("integrations-10", "action_respond", "Return Response", {
          parameters: {
            "Response Code": "202",
            "Respond With": "json payload",
          },
        }),
      ],
      [
        createEdge("integrations-1", "integrations-2"),
        createEdge("integrations-2", "integrations-3"),
        createEdge("integrations-3", "integrations-4"),
        createEdge("integrations-4", "integrations-5", "case_1"),
        createEdge("integrations-5", "integrations-6"),
        createEdge("integrations-6", "integrations-7"),
        createEdge("integrations-7", "integrations-8"),
        createEdge("integrations-8", "integrations-9"),
        createEdge("integrations-9", "integrations-10"),
      ],
    );

    const result = await executeWorkflowRun({
      project,
      workflow,
      store: createStore(),
      request: {
        source: "manual",
        triggerNodeId: "integrations-1",
      },
    });

    expect(result.executionStatus).toBe("success");
    expect(result.nodeSnapshots["integrations-2"]?.summary).toBe(
      "GET https://api.example.com/status",
    );
    expect(result.nodeSnapshots["integrations-4"]?.summary).toBe("Matched 200");
    expect(result.nodeSnapshots["integrations-5"]?.summary).toBe(
      "GitHub get pull request completed",
    );
    expect(result.nodeSnapshots["integrations-6"]?.summary).toBe("Notion create completed");
    expect(result.nodeSnapshots["integrations-7"]?.summary).toBe("AI insight generated");
    expect(result.nodeSnapshots["integrations-8"]?.summary).toBe("Email request sent");
    expect(result.nodeSnapshots["integrations-9"]?.summary).toBe("Waited 0s");
    expect(result.response).toEqual(
      expect.objectContaining({
        status: 202,
      }),
    );
  });

  it("executa um fluxo core com merge e split para validar batches e tabela final", async () => {
    const project = createProject("proj_core", "Core Operators");
    const workflow = createWorkflow(
      "wf_core_feature",
      project.id,
      "Core merge and split",
      [
        createNode("core-1", "trigger_manual", "Trigger A"),
        createNode("core-2", "trigger_manual", "Trigger B"),
        createNode("core-3", "action_set", "Set Control", {
          parameters: {
            "Field Name": "lane",
            "Field Value": "control",
          },
        }),
        createNode("core-4", "action_set", "Set Treatment", {
          parameters: {
            "Field Name": "lane",
            "Field Value": "treatment",
          },
        }),
        createNode("core-5", "action_merge", "Merge Lanes"),
        createNode("core-6", "action_function", "Add Ordinal", {
          parameters: {
            Code: `
              return items.map((item, index) => ({
                ...item.json,
                ordinal: index + 1,
              }));
            `,
          },
        }),
        createNode("core-7", "action_split", "Split In Batches", {
          parameters: {
            "Batch Size": "1",
          },
        }),
        createNode("core-8", "viz_table", "Batch Table"),
      ],
      [
        createEdge("core-1", "core-3"),
        createEdge("core-2", "core-4"),
        createEdge("core-3", "core-5"),
        createEdge("core-4", "core-5"),
        createEdge("core-5", "core-6"),
        createEdge("core-6", "core-7"),
        createEdge("core-7", "core-8"),
      ],
    );

    const result = await executeWorkflowRun({
      project,
      workflow,
      store: createStore(),
      request: {
        source: "manual",
      },
    });

    expect(result.executionStatus).toBe("success");
    expect(result.nodeSnapshots["core-5"]?.summary).toBe("Merged 2 items");
    expect(result.nodeSnapshots["core-7"]?.summary).toBe("2 batch(es) from 2 item(s)");
    expect(getPatchConfig(result, "core-8").rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lane: "control",
          ordinal: 1,
          batchIndex: 0,
        }),
        expect.objectContaining({
          lane: "treatment",
          ordinal: 2,
          batchIndex: 1,
        }),
      ]),
    );
  });
});
