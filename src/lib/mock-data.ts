import { v4 as uuidv4 } from "uuid";
import type { Edge, XYPosition } from "@xyflow/react";
import { getNodeMeta, type NodeTypeId } from "@/lib/node-catalog";
import { getDefaultNodeConfig, getNodeSchema } from "@/lib/node-config";
import type {
  AppNode,
  Execution,
  Project,
  Workflow,
  WorkflowNodeData,
} from "@/lib/flow-types";

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
  return nodes.map((node, index) => ({
    ...node,
    id: `${prefix}-${index + 1}`,
  }));
}

function makeLandingNode(
  id: string,
  type: AppNode["type"],
  position: XYPosition,
  size: { width: number; height: number },
  data: Partial<WorkflowNodeData>,
): AppNode {
  return {
    id,
    type,
    position,
    width: size.width,
    height: size.height,
    data: {
      label: "",
      nodeType: "viz_report",
      accent: "#58a6ff",
      disabled: false,
      ...data,
    } as WorkflowNodeData,
  };
}

export const LANDING_PROJECT_ID = "proj_landing";
export const DEFAULT_LANDING_WORKFLOW_ID = "wf_landing_overview";

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
    {
      id: LANDING_PROJECT_ID,
      name: "Flow Merge",
      description:
        "Site principal do produto, construindo paginas com o proprio canvas.",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
    },
  ];
}

export function createMockWorkflows(): Workflow[] {
  const wfCartNodes = remapIds(
    [
      makeNode("trigger_webhook", { x: 80, y: 220 }, { label: "Cart Event" }),
      makeNode(
        "analytics_enrich",
        { x: 360, y: 220 },
        { label: "Enrich User" },
      ),
      makeNode("analytics_store", { x: 660, y: 220 }, { label: "Event Store" }),
      makeNode(
        "analytics_aggregate",
        { x: 960, y: 220 },
        { label: "Group by Day" },
      ),
      makeNode(
        "viz_metric",
        { x: 1280, y: 60 },
        { label: "Total Revenue", vizVariant: "revenue" },
      ),
      makeNode(
        "viz_metric",
        { x: 1280, y: 260 },
        { label: "Conversion Rate", vizVariant: "conversion" },
      ),
      makeNode(
        "viz_chart",
        { x: 1560, y: 60 },
        { label: "Daily Revenue", chartType: "line", vizVariant: "revenue" },
      ),
      makeNode("viz_table", { x: 1560, y: 340 }, { label: "Top Products" }),
      makeNode("action_openai", { x: 960, y: 460 }, { label: "AI Insights" }),
      makeNode(
        "monitor_alert",
        { x: 1280, y: 480 },
        { label: "Revenue Alert" },
      ),
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
      makeNode(
        "viz_chart",
        { x: 980, y: 80 },
        {
          label: "Conversion A vs B",
          chartType: "bar",
          vizVariant: "conversion",
        },
      ),
      makeNode("viz_report", { x: 980, y: 340 }, { label: "Winner Report" }),
      makeNode("action_if", { x: 1280, y: 240 }, { label: "Winner Found?" }),
      makeNode(
        "action_slack",
        { x: 1540, y: 120 },
        { label: "Announce Winner" },
      ),
      makeNode("action_email", { x: 1540, y: 360 }, { label: "Notify Team" }),
    ],
    "ab",
  );

  const wfErrorNodes = remapIds(
    [
      makeNode("trigger_schedule", { x: 80, y: 220 }, { label: "Every 5 min" }),
      makeNode(
        "action_http",
        { x: 360, y: 220 },
        { label: "Fetch Error Logs" },
      ),
      makeNode(
        "monitor_error",
        { x: 660, y: 220 },
        { label: "Parse & Classify" },
      ),
      makeNode(
        "monitor_revenue",
        { x: 960, y: 220 },
        { label: "Revenue Lookup" },
      ),
      makeNode(
        "analytics_compare",
        { x: 1260, y: 220 },
        { label: "Errors vs Revenue" },
      ),
      makeNode(
        "viz_metric",
        { x: 1560, y: 60 },
        { label: "Error Rate", vizVariant: "errors" },
      ),
      makeNode(
        "viz_chart",
        { x: 1560, y: 280 },
        { label: "Impact Overlay", chartType: "area", vizVariant: "errors" },
      ),
      makeNode("monitor_alert", { x: 1860, y: 140 }, { label: "P0 Alert" }),
      makeNode(
        "action_slack",
        { x: 1860, y: 360 },
        { label: "Incident Channel" },
      ),
    ],
    "err",
  );

  const wfFunnelNodes = remapIds(
    [
      makeNode(
        "trigger_webhook",
        { x: 80, y: 220 },
        { label: "Page View Event" },
      ),
      makeNode(
        "analytics_segment",
        { x: 360, y: 220 },
        { label: "Identify Stage" },
      ),
      makeNode(
        "analytics_funnel",
        { x: 660, y: 220 },
        { label: "Funnel Builder" },
      ),
      makeNode(
        "viz_funnel",
        { x: 980, y: 220 },
        { label: "Signup to Paid Funnel" },
      ),
      makeNode(
        "viz_metric",
        { x: 1280, y: 90 },
        { label: "Activation Rate", vizVariant: "conversion" },
      ),
      makeNode("viz_report", { x: 1280, y: 310 }, { label: "Funnel Report" }),
      makeNode("action_if", { x: 980, y: 470 }, { label: "Drop-off?" }),
      makeNode(
        "action_openai",
        { x: 1280, y: 520 },
        { label: "Personalized Copy" },
      ),
      makeNode(
        "action_email",
        { x: 1560, y: 520 },
        { label: "Re-engagement Email" },
      ),
    ],
    "fun",
  );

  const wfDashboardNodes = remapIds(
    [
      makeNode("trigger_schedule", { x: 80, y: 260 }, { label: "Daily Sync" }),
      makeNode(
        "action_http",
        { x: 360, y: 260 },
        { label: "Fetch SaaS Metrics" },
      ),
      makeNode(
        "analytics_aggregate",
        { x: 660, y: 260 },
        { label: "Blend KPIs" },
      ),
      makeNode(
        "viz_dashboard",
        { x: 980, y: 90 },
        { label: "Operator Dashboard" },
      ),
      makeNode(
        "viz_metric",
        { x: 1600, y: 80 },
        { label: "MRR Snapshot", vizVariant: "revenue" },
      ),
      makeNode(
        "viz_chart",
        { x: 1600, y: 320 },
        { label: "Weekly Growth", chartType: "line", vizVariant: "users" },
      ),
    ],
    "dash",
  );

  const wfLandingOverviewNodes: AppNode[] = [
    {
      id: "landing-band-hero",
      type: "shapeNode",
      position: { x: 20, y: 40 },
      data: {
        label: "landing-band-hero",
        nodeType: "viz_report",
        shapeType: "rect",
        width: 1700,
        height: 660,
        fill: "rgba(31,111,235,0.04)",
        strokeColor: "rgba(31,111,235,0.12)",
      },
      zIndex: -3,
    },
    {
      id: "landing-band-map",
      type: "shapeNode",
      position: { x: 20, y: 720 },
      data: {
        label: "landing-band-map",
        nodeType: "viz_report",
        shapeType: "rect",
        width: 1700,
        height: 620,
        fill: "rgba(63,185,80,0.03)",
        strokeColor: "rgba(63,185,80,0.12)",
      },
      zIndex: -3,
    },
    {
      id: "landing-band-components",
      type: "shapeNode",
      position: { x: 20, y: 1380 },
      data: {
        label: "landing-band-components",
        nodeType: "viz_report",
        shapeType: "rect",
        width: 1700,
        height: 620,
        fill: "rgba(31,111,235,0.03)",
        strokeColor: "rgba(31,111,235,0.1)",
      },
      zIndex: -3,
    },
    {
      id: "landing-band-usecases",
      type: "shapeNode",
      position: { x: 20, y: 2040 },
      data: {
        label: "landing-band-usecases",
        nodeType: "viz_report",
        shapeType: "rect",
        width: 1700,
        height: 620,
        fill: "rgba(210,153,34,0.03)",
        strokeColor: "rgba(210,153,34,0.12)",
      },
      zIndex: -3,
    },
    {
      id: "landing-band-footer",
      type: "shapeNode",
      position: { x: 20, y: 2700 },
      data: {
        label: "landing-band-footer",
        nodeType: "viz_report",
        shapeType: "rect",
        width: 1700,
        height: 560,
        fill: "rgba(31,111,235,0.03)",
        strokeColor: "rgba(31,111,235,0.09)",
      },
      zIndex: -3,
    },
    makeLandingNode(
      "landing-home-hero",
      "landingHeroNode",
      { x: 220, y: 160 },
      { width: 880, height: 420 },
      {
        label: "Homepage hero",
        eyebrow: "Flow Merge",
        headline: "One canvas for automation, analytics and AI.",
        body: "A homepage nao imita o produto. Ela ja e o produto em modo pagina. O visitante move nodes, apaga rabiscos, exporta o board e entende o operating model antes do login.",
        chips: [
          "desktop-first",
          "move + delete + export",
          "n8n workflows",
          "PostHog thinking",
          "operator surface",
        ],
        focusNodeId: "landing-home-access",
        metrics: [
          {
            value: "1 surface",
            label: "for execute + understand",
            detail: "Workflow, metric and response live in the same plane.",
          },
          {
            value: "real canvas",
            label: "not a static mockup",
            detail:
              "Nodes, drawing tools and export stay active on the landing.",
          },
          {
            value: "site-native",
            label: "ready for more pages",
            detail: "Landing today, policies, terms and blog later.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-map",
      "landingPageMapNode",
      { x: 220, y: 800 },
      { width: 440, height: 500 },
      {
        label: "Site / pages",
        eyebrow: "Navigation model",
        meta: "Flow Merge -> Landing Page",
        description:
          "No topo, o primeiro dropdown deixa de ser um projeto qualquer e vira o proprio site Flow Merge. O segundo dropdown vira a lista de paginas desse site.",
        pages: [
          {
            title: "Landing Page",
            slug: "/",
            status: "live now",
            summary:
              "Homepage interativa, com hero, thesis, examples, access and export.",
          },
          {
            title: "Policies",
            slug: "/policies",
            status: "later",
            summary:
              "Politicas como pagina do mesmo canvas language, sem trocar a shell.",
          },
          {
            title: "Terms of Use",
            slug: "/terms",
            status: "later",
            summary:
              "Termos e contratos podendo usar nodes de texto, anexos e referencias.",
          },
          {
            title: "Blog",
            slug: "/blog",
            status: "later",
            summary:
              "Posts e historias de operadores vivendo no mesmo sistema de paginas.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-access",
      "landingAccessNode",
      { x: 1260, y: 160 },
      { width: 430, height: 540 },
      {
        label: "Open workspace",
        eyebrow: "Access node",
        meta: "login in the graph",
        description:
          "O login tambem vive como node para provar que a homepage e so uma pagina do mesmo sistema de interface.",
      },
    ),
    makeLandingNode(
      "landing-home-difference",
      "landingDifferenceNode",
      { x: 740, y: 800 },
      { width: 960, height: 500 },
      {
        label: "What is actually being merged",
        eyebrow: "Positioning",
        meta: "n8n + PostHog + operator UX",
        description:
          "A landing precisa explicar com clareza o porque do produto existir. O argumento principal e unir execucao e leitura, nao empilhar features soltas.",
        columnsContent: [
          {
            title: "n8n energy",
            summary:
              "Execucao explicita, steps visiveis e automacao que o operador consegue rastrear.",
            bullets: [
              "Triggers, actions and branches no mesmo board",
              "Integracoes e runtime de fluxo como primeira classe",
              "O ato de operar continua legivel para o time",
            ],
            meta: "execution plane",
          },
          {
            title: "PostHog energy",
            summary:
              "Leitura de comportamento, impacto e produto sem depender de dashboards isolados.",
            bullets: [
              "Funnels, cohorts e sinais de produto perto da acao",
              "Interpretacao do que mudou em vez de numero solto",
              "Visao de impacto para growth, product e revenue",
            ],
            meta: "reading plane",
          },
          {
            title: "Flow Merge",
            summary:
              "As duas camadas cabem na mesma superficie operavel e local.",
            bullets: [
              "O insight ja nasce no contexto do workflow",
              "A resposta pode acontecer no mesmo canvas",
              "Homepage, app e futuras paginas usam a mesma linguagem",
            ],
            meta: "operator plane",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-workflow",
      "landingWorkflowNode",
      { x: 240, y: 2320 },
      { width: 720, height: 520 },
      {
        label: "Simple idea flows",
        eyebrow: "Examples",
        meta: "clear loops",
        description:
          "Nao e necessario fingir uma suite inteira para a landing. O visitante so precisa enxergar loops simples que mostrem como o produto pensa.",
        lanes: [
          {
            title: "Revenue pulse",
            subtitle:
              "Sinais de billing entram, ganham contexto e viram decisao.",
            steps: ["Webhook", "Enrich account", "Store", "Metric", "Alert"],
            footer:
              "Bom para mostrar receita, sinais de conta e risco no mesmo board.",
          },
          {
            title: "Activation watch",
            subtitle: "Eventos de produto viram funil e resposta operacional.",
            steps: ["Event", "Segment", "Funnel", "Insight", "Follow-up"],
            footer:
              "Mostra crescimento e produto sem separar a analise do fluxo.",
          },
          {
            title: "Incident overlay",
            subtitle: "Erro tecnico e impacto de negocio aparecem juntos.",
            steps: [
              "Schedule",
              "Fetch logs",
              "Classify",
              "Revenue impact",
              "Escalate",
            ],
            footer:
              "Bom para explicar porque operator canvas importa para times tecnicos.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-components",
      "landingComponentsNode",
      { x: 1020, y: 2320 },
      { width: 700, height: 520 },
      {
        label: "Component language on display",
        eyebrow: "Native pieces",
        meta: "same building blocks",
        description:
          "A homepage precisa mostrar nossos componentes de verdade, nao um layout que so parece com eles de longe.",
        examples: [
          {
            title: "Hero node",
            nodeKind: "landingHeroNode",
            summary:
              "Abre a pagina com brand, thesis, CTA e signal cards dentro do proprio node.",
            sample: "headline + body + chips + metrics + CTA",
          },
          {
            title: "Access node",
            nodeKind: "landingAccessNode",
            summary:
              "O login deixa de ser modal solto e vira bloco de interface no grafo.",
            sample: "tabs de entrar/criar + formulario + seguranca local",
          },
          {
            title: "Difference node",
            nodeKind: "landingDifferenceNode",
            summary:
              "Explica a fusao n8n/PostHog/Flow Merge com colunas legiveis.",
            sample: "execution plane | reading plane | operator plane",
          },
          {
            title: "Use case node",
            nodeKind: "landingUseCaseNode",
            summary:
              "Agrupa cenarios reais sem transformar tudo em um dashboard de cards genericos.",
            sample: "revenue ops | activation | incidents | client operations",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-usecases",
      "landingUseCaseNode",
      { x: 860, y: 1840 },
      { width: 840, height: 540 },
      {
        label: "Who can run this today",
        eyebrow: "Use cases",
        meta: "operator loops",
        description:
          "Cada bloco abaixo explica um caso de uso simples, com cara de trabalho real e sem parecer slide de produto.",
        items: [
          {
            title: "Revenue ops room",
            body: "Webhook de billing, enriquecimento por conta, visualizacao de MRR e alerta quando churn risk aparece no mesmo board.",
            meta: "billing -> enrich -> metric -> alert",
          },
          {
            title: "Experiment command",
            body: "Evento de pagina, segmentacao, leitura de funil e follow-up de copy ou canal sem trocar de ferramenta.",
            meta: "events -> segment -> funnel -> action",
          },
          {
            title: "Incident with business impact",
            body: "Erro operacional entra, ganha contexto de receita e vira decisao de resposta em vez de numero isolado.",
            meta: "logs -> classify -> impact -> escalate",
          },
          {
            title: "Agency operating board",
            body: "Fluxos de clientes viram canvases explicaveis, editaveis e exportaveis para colaboracao rapida.",
            meta: "client ops -> board -> export",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-audience",
      "landingAudienceNode",
      { x: 240, y: 3080 },
      { width: 560, height: 540 },
      {
        label: "Best fit first",
        eyebrow: "Audience",
        meta: "small technical teams",
        description:
          "O melhor cliente sente dor de contexto quebrado. Ele nao quer uma automacao num lugar e a leitura em outro.",
        items: [
          {
            title: "Founder-led SaaS",
            body: "Quer operar produto, receita e automacao sem montar um stack pesado cedo demais.",
            meta: "2-12 people",
          },
          {
            title: "Growth + revenue ops",
            body: "Precisa ligar teste, funil, insight e resposta sem pular entre automacao e analytics.",
            meta: "daily operator loop",
          },
          {
            title: "Product engineers",
            body: "Quer um plano unico para eventos, integracoes, erros e impacto de negocio.",
            meta: "technical operators",
          },
          {
            title: "Service teams",
            body: "Podem transformar setups de clientes em command centers que realmente se explicam.",
            meta: "multi-client boards",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-proof",
      "landingProofNode",
      { x: 240, y: 1700 },
      { width: 400, height: 420 },
      {
        label: "Proof by interaction",
        eyebrow: "Format check",
        meta: "not static marketing",
        description:
          "A prova principal da landing e mostrar o produto acontecendo na frente do visitante.",
        metrics: [
          {
            value: "drag",
            label: "move the nodes",
            detail: "A homepage nao trava o canvas. Ela convida a explorar.",
          },
          {
            value: "delete",
            label: "erase what you dislike",
            detail:
              "Nodes e desenhos podem sair do board se o visitante quiser.",
          },
          {
            value: "draw",
            label: "annotate in place",
            detail: "Ferramentas de desenho seguem ativas para ideacao rapida.",
          },
          {
            value: "export",
            label: "share exact intent",
            detail:
              "O JSON exportado vira referencia objetiva para a proxima iteracao.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-footer",
      "landingFooterNode",
      { x: 700, y: 1360 },
      { width: 1020, height: 420 },
      {
        label: "Page system ready to expand",
        eyebrow: "Roadmap pages",
        meta: "site shell",
        description:
          "Hoje a landing page e a primeira pagina publica desse site. O proximo passo e adicionar outras paginas no mesmo modelo, sem voltar para uma UX separada.",
        focusNodeId: "landing-home-access",
        pages: [
          {
            title: "Landing Page",
            slug: "/",
            status: "live",
            summary:
              "A homepage interativa que ja demonstra o canvas, os nodes e a narrativa central.",
          },
          {
            title: "Policies",
            slug: "/policies",
            status: "next",
            summary:
              "Conteudo juridico ainda usando a mesma shell de pagina e o mesmo menu.",
          },
          {
            title: "Terms",
            slug: "/terms",
            status: "next",
            summary:
              "Termos de uso em modo canvas/page, sem sair do ecossistema visual do produto.",
          },
          {
            title: "Blog",
            slug: "/blog",
            status: "later",
            summary:
              "Historias, operadores e walkthroughs como paginas navegaveis do mesmo site.",
          },
        ],
      },
    ),
  ];

  const wfLandingComparisonNodes = remapIds(
    [
      makeNode(
        "trigger_manual",
        { x: 80, y: 260 },
        {
          label: "Why not split tools?",
          description:
            "A pergunta da landing comeca aqui: por que juntar automacao e leitura de impacto?",
        },
      ),
      makeNode(
        "action_set",
        { x: 360, y: 120 },
        {
          label: "n8n strength",
          description:
            "Orquestracao, integracoes, branches e steps explicitos.",
          notes: "Excelente para executar fluxos.",
        },
      ),
      makeNode(
        "analytics_compare",
        { x: 360, y: 400 },
        {
          label: "PostHog strength",
          description: "Funnels, cohorts, retencao e comportamento de produto.",
          notes: "Excelente para interpretar o que aconteceu.",
        },
      ),
      makeNode(
        "action_merge",
        { x: 700, y: 260 },
        {
          label: "Merge the planes",
          description:
            "Flow Merge coloca execucao e interpretacao no mesmo grafo operacional.",
          notes: "O operador nao perde a linha entre detectar e agir.",
        },
      ),
      makeNode(
        "viz_table",
        { x: 1040, y: 70 },
        {
          label: "Category map",
          config: {
            columns: "Plane,n8n,PostHog,Flow Merge",
            rows: [
              {
                Plane: "Automation",
                n8n: "Deep",
                PostHog: "Light",
                "Flow Merge": "Deep",
              },
              {
                Plane: "Product analytics",
                n8n: "Thin",
                PostHog: "Deep",
                "Flow Merge": "Embedded",
              },
              {
                Plane: "Operator surface",
                n8n: "Split",
                PostHog: "Split",
                "Flow Merge": "Unified",
              },
              {
                Plane: "Desktop local",
                n8n: "No",
                PostHog: "No",
                "Flow Merge": "Yes",
              },
            ],
          },
        },
      ),
      makeNode(
        "viz_chart",
        { x: 1040, y: 370 },
        {
          label: "Operator fit",
          chartType: "bar",
          vizVariant: "users",
          config: {
            chartType: "Bar",
            yAxisLabel: "Fit score",
            series: [
              { label: "n8n", value: 46 },
              { label: "PostHog", value: 58 },
              { label: "Flow Merge", value: 92 },
            ],
          },
        },
      ),
      makeNode(
        "viz_report",
        { x: 1380, y: 220 },
        {
          label: "Positioning note",
          config: {
            reportTitle: "How to explain it",
            reportItems: [
              {
                label: "Automation clarity",
                value: "Strong",
                delta: "+n8n DNA",
                positive: true,
              },
              {
                label: "Product reading",
                value: "Strong",
                delta: "+PostHog DNA",
                positive: true,
              },
              {
                label: "Operator surface",
                value: "Unified",
                delta: "+Flow Merge",
                positive: true,
              },
            ],
            insight:
              "A narrativa certa nao e substituir n8n ou PostHog linha por linha. E entregar uma superficie unica para quem precisa executar e entender no mesmo lugar.",
          },
        },
      ),
      makeNode(
        "action_if",
        { x: 1720, y: 220 },
        {
          label: "Need action now?",
          description:
            "Se o insight pede resposta imediata, o operador continua no mesmo canvas.",
          parameters: {
            "Value 1": "operator_signal",
            Operation: "greater than",
            "Value 2": "0",
          },
        },
      ),
      makeNode(
        "action_slack",
        { x: 1990, y: 110 },
        {
          label: "Respond inside flow",
          description: "Alertas, follow-up ou handoff continuam no grafo.",
        },
      ),
      makeNode(
        "monitor_revenue",
        { x: 1990, y: 360 },
        {
          label: "Keep revenue in view",
          description:
            "Mesmo uma decisao de operacao continua ancorada em impacto.",
        },
      ),
    ],
    "landing-compare",
  );

  const wfLandingUseCaseNodes = remapIds(
    [
      makeNode(
        "trigger_webhook",
        { x: 80, y: 260 },
        {
          label: "Product + billing events",
          description:
            "Um mesmo fluxo pode receber sinais do produto e do faturamento.",
        },
      ),
      makeNode(
        "analytics_enrich",
        { x: 360, y: 260 },
        {
          label: "Add plan + account context",
          description:
            "Enriquece cada evento com conta, plano, receita e momento do usuario.",
        },
      ),
      makeNode(
        "analytics_funnel",
        { x: 660, y: 120 },
        {
          label: "Activation funnel",
          description:
            "Mostra quedas entre etapa inicial, ativacao e pagamento.",
        },
      ),
      makeNode(
        "monitor_error",
        { x: 660, y: 400 },
        {
          label: "Incident watch",
          description:
            "Classifica sinais operacionais que afetam a experiencia.",
        },
      ),
      makeNode(
        "action_merge",
        { x: 980, y: 260 },
        {
          label: "Merge growth + reliability",
          description:
            "Use cases de growth e de operacao convivem no mesmo command center.",
        },
      ),
      makeNode(
        "viz_metric",
        { x: 1290, y: 70 },
        {
          label: "MRR pulse",
          vizVariant: "revenue",
          runtime: {
            status: "success",
            summary: "O mesmo fluxo mostra receita e saude operacional.",
          },
          config: {
            value: "$128k",
            trend: "+14.2%",
            compareLabel: "vs last 30d",
            variant: "revenue",
          },
        },
      ),
      makeNode(
        "viz_funnel",
        { x: 1290, y: 270 },
        {
          label: "Signup to paid",
          vizVariant: "conversion",
          config: {
            stages: [
              { label: "Visit", value: 42000 },
              { label: "Signup", value: 7600 },
              { label: "Activated", value: 2800 },
              { label: "Paid", value: 980 },
            ],
          },
        },
      ),
      makeNode(
        "viz_table",
        { x: 1590, y: 40 },
        {
          label: "Operator loops",
          config: {
            columns: "Loop,Trigger,Output",
            rows: [
              {
                Loop: "Pricing tests",
                Trigger: "webhook",
                Output: "winner report",
              },
              {
                Loop: "Activation",
                Trigger: "events",
                Output: "funnel + alert",
              },
              {
                Loop: "Incidents",
                Trigger: "schedule",
                Output: "error + revenue overlay",
              },
            ],
          },
        },
      ),
      makeNode(
        "viz_dashboard",
        { x: 1590, y: 280 },
        {
          label: "Daily room",
          config: { title: "Daily Operating Room" },
        },
      ),
      makeNode(
        "action_slack",
        { x: 2190, y: 360 },
        {
          label: "Daily digest",
          description:
            "O fechamento do fluxo ja pode acionar o time sem mudar de contexto.",
        },
      ),
    ],
    "landing-cases",
  );

  const wfLandingAudienceNodes = remapIds(
    [
      makeNode(
        "trigger_schedule",
        { x: 80, y: 260 },
        {
          label: "Daily operator review",
          description:
            "A landing tambem mostra para quem a superficie faz mais sentido.",
        },
      ),
      makeNode(
        "action_switch",
        { x: 360, y: 260 },
        {
          label: "Who is operating?",
          description:
            "Cada perfil chega por necessidades diferentes, mas busca a mesma coisa: menos troca de contexto.",
          parameters: {
            Value: "team_profile",
            Operation: "equals",
            "Case 1": "founder",
            "Case 2": "growth_ops",
            "Case 3": "product_engineering",
          },
        },
      ),
      makeNode(
        "analytics_segment",
        { x: 700, y: 90 },
        {
          label: "Founders + revenue ops",
          description:
            "Precisam operar receita, integracoes e experimentos sem montar um stack fragmentado cedo demais.",
        },
      ),
      makeNode(
        "analytics_segment",
        { x: 700, y: 260 },
        {
          label: "Growth + product teams",
          description:
            "Querem ligar funil, cohortes, testes e acao operacional no mesmo lugar.",
        },
      ),
      makeNode(
        "analytics_segment",
        { x: 700, y: 430 },
        {
          label: "Agencies + operators",
          description:
            "Transformam automacoes de clientes em command centers legiveis para o dia a dia.",
        },
      ),
      makeNode(
        "action_merge",
        { x: 1040, y: 260 },
        {
          label: "Shared requirement",
          description:
            "Todos precisam decidir com o workflow na frente, e nao com contexto espalhado.",
        },
      ),
      makeNode(
        "viz_table",
        { x: 1370, y: 60 },
        {
          label: "Best fit",
          config: {
            columns: "Team,Why it clicks,What they run",
            rows: [
              {
                Team: "Founder-led SaaS",
                "Why it clicks": "one local command center",
                "What they run": "revenue + ops",
              },
              {
                Team: "Growth ops",
                "Why it clicks": "test + insight + response",
                "What they run": "funnels + experiments",
              },
              {
                Team: "Product engineers",
                "Why it clicks": "events + runtime visibility",
                "What they run": "integrations + monitoring",
              },
            ],
          },
        },
      ),
      makeNode(
        "viz_metric",
        { x: 1370, y: 320 },
        {
          label: "Ideal stage",
          vizVariant: "users",
          config: {
            value: "2-20 people",
            trend: "+technical operators",
            compareLabel: "per workspace",
            variant: "users",
          },
        },
      ),
      makeNode(
        "viz_report",
        { x: 1660, y: 190 },
        {
          label: "Adoption note",
          config: {
            reportTitle: "When to adopt",
            reportItems: [
              {
                label: "Need one operator plane",
                value: "Yes",
                delta: "strong fit",
                positive: true,
              },
              {
                label: "Need local desktop",
                value: "Yes",
                delta: "native",
                positive: true,
              },
              {
                label: "Need static dashboards only",
                value: "No",
                delta: "weak fit",
                positive: false,
              },
            ],
            insight:
              "Flow Merge faz mais sentido quando a equipe ainda e pequena, tecnica e precisa decidir em cima do proprio fluxo todos os dias.",
          },
        },
      ),
      makeNode(
        "monitor_alert",
        { x: 1950, y: 190 },
        {
          label: "Decision cadence",
          description:
            "Os melhores clientes sao os que precisam agir varias vezes por dia, nao so consultar um dashboard passivo.",
        },
      ),
    ],
    "landing-audience",
  );

  return [
    {
      id: "wf_cart",
      projectId: "proj_revenue",
      name: "SaaS Cart Analytics",
      accent: "#3fb950",
      active: true,
      description:
        "Captura eventos de carrinho, agrega receita e gera métricas no canvas.",
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
      description:
        "Compara variantes de pricing e decide vencedor automaticamente.",
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
      description:
        "Relaciona erros da aplicação com impacto em receita e incidentes.",
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
      description:
        "Monitora jornada do usuário do primeiro evento até pagamento.",
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
      description:
        "Mistura o canvas analítico do A com o dashboard interativo do B.",
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
    {
      id: DEFAULT_LANDING_WORKFLOW_ID,
      projectId: LANDING_PROJECT_ID,
      name: "Landing Page",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description:
        "Homepage interativa montada com nodes reais do proprio produto.",
      tags: ["landing", "page", "homepage", "canvas"],
      createdAt: nowIso(-86400000),
      updatedAt: nowIso(-1800000),
      nodes: wfLandingOverviewNodes,
      edges: [
        edge("landing-home-hero", "landing-home-map"),
        edge("landing-home-hero", "landing-home-access"),
        edge("landing-home-map", "landing-home-difference"),
        edge("landing-home-map", "landing-home-proof"),
        edge("landing-home-access", "landing-home-difference"),
        edge("landing-home-difference", "landing-home-footer"),
        edge("landing-home-footer", "landing-home-proof"),
        edge("landing-home-footer", "landing-home-usecases"),
        edge("landing-home-proof", "landing-home-usecases"),
        edge("landing-home-usecases", "landing-home-workflow"),
        edge("landing-home-usecases", "landing-home-components"),
        edge("landing-home-workflow", "landing-home-audience"),
      ],
    },
    {
      id: "wf_landing_compare",
      projectId: LANDING_PROJECT_ID,
      name: "n8n x PostHog x Flow Merge",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description: "Board de posicionamento comparativo em nodes reais.",
      tags: ["landing", "positioning", "compare"],
      createdAt: nowIso(-86400000),
      updatedAt: nowIso(-2400000),
      nodes: wfLandingComparisonNodes,
      edges: [
        edge("landing-compare-1", "landing-compare-2"),
        edge("landing-compare-1", "landing-compare-3"),
        edge("landing-compare-2", "landing-compare-4"),
        edge("landing-compare-3", "landing-compare-4"),
        edge("landing-compare-4", "landing-compare-5"),
        edge("landing-compare-4", "landing-compare-6"),
        edge("landing-compare-4", "landing-compare-7"),
        edge("landing-compare-4", "landing-compare-8"),
        edge("landing-compare-8", "landing-compare-9", "true"),
        edge("landing-compare-8", "landing-compare-10", "false"),
      ],
    },
    {
      id: "wf_landing_use_cases",
      projectId: LANDING_PROJECT_ID,
      name: "Use Cases on Canvas",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description:
        "Fluxos curtos mostrando revenue, activation e operations no mesmo plano.",
      tags: ["landing", "use-cases", "ops"],
      createdAt: nowIso(-86400000),
      updatedAt: nowIso(-3000000),
      nodes: wfLandingUseCaseNodes,
      edges: [
        edge("landing-cases-1", "landing-cases-2"),
        edge("landing-cases-2", "landing-cases-3"),
        edge("landing-cases-2", "landing-cases-4"),
        edge("landing-cases-3", "landing-cases-5"),
        edge("landing-cases-4", "landing-cases-5"),
        edge("landing-cases-5", "landing-cases-6"),
        edge("landing-cases-5", "landing-cases-7"),
        edge("landing-cases-5", "landing-cases-8"),
        edge("landing-cases-5", "landing-cases-9"),
        edge("landing-cases-9", "landing-cases-10"),
      ],
    },
    {
      id: "wf_landing_audience",
      projectId: LANDING_PROJECT_ID,
      name: "Who It Fits",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description: "Board de publico alvo, timing e fit operacional.",
      tags: ["landing", "audience", "fit"],
      createdAt: nowIso(-86400000),
      updatedAt: nowIso(-3600000),
      nodes: wfLandingAudienceNodes,
      edges: [
        edge("landing-audience-1", "landing-audience-2"),
        edge("landing-audience-2", "landing-audience-3", "case_1"),
        edge("landing-audience-2", "landing-audience-4", "case_2"),
        edge("landing-audience-2", "landing-audience-5", "case_3"),
        edge("landing-audience-3", "landing-audience-6"),
        edge("landing-audience-4", "landing-audience-6"),
        edge("landing-audience-5", "landing-audience-6"),
        edge("landing-audience-6", "landing-audience-7"),
        edge("landing-audience-6", "landing-audience-8"),
        edge("landing-audience-6", "landing-audience-9"),
        edge("landing-audience-6", "landing-audience-10"),
      ],
    },
  ];
}

export function createMockExecutions(workflows: Workflow[]): Execution[] {
  const statuses: Execution["status"][] = [
    "success",
    "success",
    "success",
    "error",
    "running",
  ];
  return workflows.flatMap((workflow, workflowIndex) =>
    workflow.surface === "landing"
      ? []
      : Array.from({ length: 4 }, (_, index) => {
          const startedAt = new Date(
            Date.now() - (workflowIndex * 4 + index + 1) * 5400000,
          );
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
