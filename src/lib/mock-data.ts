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
import {
  DEFAULT_LANDING_WORKFLOW_ID,
  LANDING_HOME_ACCESS_NODE_ID,
  LANDING_LEGAL_ACCESS_NODE_ID,
  LANDING_PROJECT_ID,
  LEGAL_LANDING_WORKFLOW_ID,
} from "@/lib/public-pages";

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
        label: "Hero de posicionamento",
        eyebrow: "Flow Merge",
        headline: "Automacao e analytics no mesmo canvas.",
        body: "Capture qualquer dado, transforme em workflow e entenda impacto real no negocio sem trocar de ferramenta. Flow Merge foi feito para founders tecnicos, indie hackers e micro-SaaS que precisam operar e decidir no mesmo lugar.",
        chips: [
          "automation + analytics",
          "desktop + web",
          "local-first",
          "google login",
          "pix simples",
        ],
        focusNodeId: LANDING_HOME_ACCESS_NODE_ID,
        focusWorkflowId: DEFAULT_LANDING_WORKFLOW_ID,
        metrics: [
          {
            value: "1 canvas",
            label: "para operar e analisar",
            detail: "Workflow, metrica e resposta ficam na mesma superficie.",
          },
          {
            value: "14 dias",
            label: "de trial completo",
            detail:
              "Automacao, analytics, funil, A/B e alertas antes da cobranca.",
          },
          {
            value: "local-first",
            label: "dados do produto ficam com voce",
            detail: "Backend guarda so identidade, licenca e cobranca.",
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
        label: "Site / produto",
        eyebrow: "Navigation model",
        meta: "Flow Merge -> Landing",
        description:
          "O mesmo sistema de superficies pode servir a landing, o app e as paginas futuras. O topo organiza o site como projeto e cada pagina publica como workflow vivo.",
        pages: [
          {
            title: "Landing Page",
            slug: "/",
            status: "live",
            summary:
              "Posicionamento, growth cases e acesso ao trial no proprio canvas.",
          },
          {
            title: "Pricing",
            slug: "/pricing",
            status: "next",
            summary:
              "Mensal, vitalicio founder e regras de trial, lock e delecao.",
          },
          {
            title: "Docs",
            slug: "/docs",
            status: "later",
            summary: "Guias de setup, playbooks e templates de operator loops.",
          },
          {
            title: "Termos de Uso",
            slug: "/legal",
            status: "live",
            summary:
              "Termos, responsabilidade operacional e privacidade dentro da mesma shell.",
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
        label: "Comece o trial",
        eyebrow: "Access node",
        meta: "google + trial + pix",
        description:
          "Login com Google libera o workspace local e ja vincula o uso aos termos, responsabilidade operacional e politica de privacidade. O backend segura so identidade, licenca e cobranca; seus workflows e runtime continuam fora do banco.",
      },
    ),
    makeLandingNode(
      "landing-home-difference",
      "landingDifferenceNode",
      { x: 740, y: 960 },
      { width: 960, height: 500 },
      {
        label: "O que esta sendo unido aqui",
        eyebrow: "Positioning",
        meta: "execucao + leitura + acao",
        description:
          "A comparacao com n8n e PostHog ajuda a orientar, mas a proposta nao e copiar duas ferramentas. A proposta e dar uma unica superficie para executar, ler impacto e agir sem troca de contexto.",
        columnsContent: [
          {
            title: "n8n executa",
            summary:
              "Workflows, triggers, branches e integracoes continuam claros e operaveis.",
            bullets: [
              "Automacoes visiveis e rastreaveis",
              "Fluxos e runtime como primeira classe",
              "Execucao legivel para um founder tecnico",
            ],
            meta: "execution plane",
          },
          {
            title: "PostHog analisa",
            summary:
              "Funil, comportamento, experimentos e impacto aparecem perto da operacao.",
            bullets: [
              "Leitura de produto e growth no contexto do fluxo",
              "Sinais de negocio em vez de numero isolado",
              "Impacto em receita junto com o evento",
            ],
            meta: "analytics plane",
          },
          {
            title: "Flow Merge junta",
            summary: "O insight nasce no mesmo canvas que executa a resposta.",
            bullets: [
              "Erro pode virar perda estimada em R$",
              "Funil e A/B podem disparar uma acao no mesmo lugar",
              "Produto local-first com web e desktop na mesma linguagem",
            ],
            meta: "operator plane",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-workflow",
      "landingWorkflowNode",
      { x: 980, y: 2540 },
      { width: 720, height: 520 },
      {
        label: "Casos ancora do lancamento",
        eyebrow: "Growth loops",
        meta: "logs, funnel, behavior",
        description:
          "Os loops abaixo mostram o produto do jeito certo: sinais entram, o impacto aparece e a resposta pode sair do mesmo canvas. Sem prometer magia, sem separar analytics de automacao.",
        lanes: [
          {
            title: "Logs e erros -> impacto em R$",
            subtitle:
              "Log entra, ganha contexto de receita e vira prioridade operacional.",
            steps: ["Log", "Classify", "Map revenue", "Estimate", "Alert"],
            footer:
              "Mostra exatamente porque observabilidade sem impacto de negocio e incompleta.",
          },
          {
            title: "Funil + A/B -> decisao",
            subtitle:
              "Eventos viram comparacao, leitura de queda e ajuste de produto.",
            steps: ["Event", "Segment", "Compare", "Decide", "Ship"],
            footer: "O mesmo fluxo mede conversao e prepara a proxima acao.",
          },
          {
            title: "Padrao comportamental -> acao comercial",
            subtitle:
              "Comportamento de compra vira insight e campanha contextual.",
            steps: ["Cart", "Detect pattern", "Score", "Coupon", "Measure"],
            footer:
              "Bom para mostrar promocoes, nudges e monetizacao guiada por padrao real.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-components",
      "landingComponentsNode",
      { x: 240, y: 3120 },
      { width: 700, height: 520 },
      {
        label: "Linguagem nativa do produto",
        eyebrow: "Native pieces",
        meta: "same operator surface",
        description:
          "A landing nao usa uma fachada separada. Ela expande os mesmos blocos do produto para explicar acesso, casos de uso, prova e monetizacao.",
        examples: [
          {
            title: "Hero node",
            nodeKind: "landingHeroNode",
            summary:
              "Abre a tese de automacao + analytics com metricas e CTA direto para o access node.",
            sample: "headline + proof + CTA",
          },
          {
            title: "Access node",
            nodeKind: "landingAccessNode",
            summary:
              "Mostra login Google, trial, PIX e status comercial sem tirar o visitante do fluxo.",
            sample: "google login + trial + pix",
          },
          {
            title: "Difference node",
            nodeKind: "landingDifferenceNode",
            summary:
              "Enquadra n8n, PostHog e a tese propria do Flow Merge sem depender de slogan vazio.",
            sample: "execute | analyze | act",
          },
          {
            title: "Use case node",
            nodeKind: "landingUseCaseNode",
            summary:
              "Agrupa loops reais para founders de SaaS pequeno sem virar grade generica de cards.",
            sample: "errors | funnel | behavior | revenue",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-usecases",
      "landingUseCaseNode",
      { x: 860, y: 1980 },
      { width: 840, height: 540 },
      {
        label: "O que voce consegue rodar hoje",
        eyebrow: "Use cases",
        meta: "operational analytics",
        description:
          "Os exemplos abaixo ancoram a promessa comercial em trabalho real de indie hacker e micro-SaaS. Tudo parte do mesmo principio: dado entra, impacto aparece, resposta sai.",
        items: [
          {
            title: "Erro tecnico com impacto financeiro",
            body: "Erros de login, checkout ou onboarding entram com log, ganham contexto de receita e viram prioridade baseada no dinheiro em risco.",
            meta: "logs -> classify -> revenue -> alert",
          },
          {
            title: "Funil e A/B no mesmo fluxo",
            body: "Eventos de produto, segmentacao, comparacao entre variantes e decisao operacional sem saltar para outra suite de analytics.",
            meta: "events -> segment -> compare -> ship",
          },
          {
            title: "Cupom na data certa",
            body: "Padroes de carrinho e compra por dia util viram gatilho comercial para desconto, campanha ou follow-up com criterio.",
            meta: "behavior -> score -> coupon -> measure",
          },
          {
            title: "Revenue room para founder tecnico",
            body: "Billing, eventos de produto e alertas de churn convivem no mesmo command center sem stack fragmentado demais cedo.",
            meta: "billing -> enrich -> risk -> act",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-audience",
      "landingAudienceNode",
      { x: 240, y: 2300 },
      { width: 560, height: 540 },
      {
        label: "Quem sente valor primeiro",
        eyebrow: "Audience",
        meta: "founders tecnicos",
        description:
          "O melhor cliente ainda nao quer montar um stack pesado, mas ja precisa operar receita, produto e automacao com disciplina. Ele sente a dor da troca de contexto todos os dias.",
        items: [
          {
            title: "Indie hackers",
            body: "Querem uma superficie unica para entender o negocio e disparar a proxima acao sem engenharia demais.",
            meta: "solo to tiny team",
          },
          {
            title: "Founders de micro-SaaS",
            body: "Precisam ligar billing, ativacao, erro e retencao quando a operacao ainda passa muito pela pessoa fundadora.",
            meta: "0 -> 1 stage",
          },
          {
            title: "Growth e revenue ops enxutos",
            body: "Precisam ligar experimento, funil, insight e follow-up sem quebrar o contexto em quatro ferramentas.",
            meta: "daily decision loop",
          },
          {
            title: "Product engineers operadores",
            body: "Querem ver eventos, integracoes, falhas e impacto comercial na mesma leitura operacional.",
            meta: "technical operators",
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
        label: "Prova do formato",
        eyebrow: "Format check",
        meta: "not static marketing",
        description:
          "A prova principal nao e um slogan. E ver o mesmo canvas explicando acesso, casos, cobranca e superficie operacional sem virar mockup de marketing.",
        metrics: [
          {
            value: "1 login",
            label: "Google",
            detail: "Identidade simples para web e desktop com Better Auth.",
          },
          {
            value: "PIX",
            label: "mensal ou vitalicio",
            detail: "Cobranca direta para o publico Brasil-first do v1.",
          },
          {
            value: "7 + 7",
            label: "prazo e delecao",
            detail:
              "Fluxo comercial claro: trial, cobranca, bloqueio e limpeza final.",
          },
          {
            value: "local",
            label: "workspace nao sobe",
            detail:
              "Banco recebe so identidade, licenca e metadata de billing.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-home-footer",
      "landingFooterNode",
      { x: 700, y: 1460 },
      { width: 1020, height: 420 },
      {
        label: "O site e o produto falam a mesma lingua",
        eyebrow: "Site shell",
        meta: "same surface",
        description:
          "A homepage vende o produto usando a mesma linguagem do app. Isso permite expandir pricing, docs e legal sem cair numa camada de marketing desconectada do que o usuario realmente vai usar.",
        focusNodeId: LANDING_HOME_ACCESS_NODE_ID,
        focusWorkflowId: DEFAULT_LANDING_WORKFLOW_ID,
        pages: [
          {
            title: "Landing Page",
            slug: "/",
            status: "live",
            summary:
              "Posicionamento, casos ancora e acesso ao trial no proprio canvas.",
          },
          {
            title: "Pricing",
            slug: "/pricing",
            status: "next",
            summary:
              "Mensal, vitalicio founder, trial e regras de lock em pagina nativa.",
          },
          {
            title: "Docs",
            slug: "/docs",
            status: "next",
            summary: "Playbooks e templates de workflows para SaaS pequeno.",
          },
          {
            title: "Termos de Uso",
            slug: "/legal",
            status: "live",
            summary:
              "Termos, responsabilidade operacional e privacidade na mesma shell.",
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
          label: "Por que nao separar ferramentas?",
          description:
            "A pergunta da landing comeca aqui: por que juntar automacao e leitura de impacto?",
        },
      ),
      makeNode(
        "action_set",
        { x: 360, y: 120 },
        {
          label: "n8n executa",
          description:
            "Orquestracao, integracoes, branches e steps explicitos.",
          notes: "Excelente para executar fluxos.",
        },
      ),
      makeNode(
        "analytics_compare",
        { x: 360, y: 400 },
        {
          label: "PostHog analisa",
          description: "Funnels, cohorts, retencao e comportamento de produto.",
          notes: "Excelente para interpretar o que aconteceu.",
        },
      ),
      makeNode(
        "action_merge",
        { x: 700, y: 260 },
        {
          label: "Flow Merge junta",
          description:
            "Flow Merge coloca execucao e interpretacao no mesmo grafo operacional.",
          notes: "O operador nao perde a linha entre detectar e agir.",
        },
      ),
      makeNode(
        "viz_table",
        { x: 1040, y: 70 },
        {
          label: "Mapa de categoria",
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
          label: "Fit operacional",
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
          label: "Nota de posicionamento",
          config: {
            reportTitle: "Como explicar",
            reportItems: [
              {
                label: "Clareza de automacao",
                value: "Alta",
                delta: "+n8n DNA",
                positive: true,
              },
              {
                label: "Leitura de produto",
                value: "Alta",
                delta: "+PostHog DNA",
                positive: true,
              },
              {
                label: "Superficie operacional",
                value: "Unificada",
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
          label: "Precisa agir agora?",
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
          label: "Responder dentro do fluxo",
          description: "Alertas, follow-up ou handoff continuam no grafo.",
        },
      ),
      makeNode(
        "monitor_revenue",
        { x: 1990, y: 360 },
        {
          label: "Receita sempre visivel",
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
          label: "Eventos de produto + billing",
          description:
            "Um mesmo fluxo pode receber sinais do produto e do faturamento.",
        },
      ),
      makeNode(
        "analytics_enrich",
        { x: 360, y: 260 },
        {
          label: "Adicionar contexto de conta",
          description:
            "Enriquece cada evento com conta, plano, receita e momento do usuario.",
        },
      ),
      makeNode(
        "analytics_funnel",
        { x: 660, y: 120 },
        {
          label: "Funil de ativacao",
          description:
            "Mostra quedas entre etapa inicial, ativacao e pagamento.",
        },
      ),
      makeNode(
        "monitor_error",
        { x: 660, y: 400 },
        {
          label: "Vigia de incidentes",
          description:
            "Classifica sinais operacionais que afetam a experiencia.",
        },
      ),
      makeNode(
        "action_merge",
        { x: 980, y: 260 },
        {
          label: "Juntar growth + reliability",
          description:
            "Use cases de growth e de operacao convivem no mesmo command center.",
        },
      ),
      makeNode(
        "viz_metric",
        { x: 1290, y: 70 },
        {
          label: "Pulso de MRR",
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
          label: "Signup ate pago",
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
          label: "Loops operacionais",
          config: {
            columns: "Loop,Trigger,Output",
            rows: [
              {
                Loop: "Teste de pricing",
                Trigger: "webhook",
                Output: "relatorio vencedor",
              },
              {
                Loop: "Ativacao",
                Trigger: "events",
                Output: "funil + alerta",
              },
              {
                Loop: "Incidentes",
                Trigger: "schedule",
                Output: "erro + impacto em receita",
              },
            ],
          },
        },
      ),
      makeNode(
        "viz_dashboard",
        { x: 1590, y: 280 },
        {
          label: "Sala diaria",
          config: { title: "Daily Operating Room" },
        },
      ),
      makeNode(
        "action_slack",
        { x: 2190, y: 360 },
        {
          label: "Digest diario",
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
          label: "Revisao diaria",
          description:
            "A landing tambem mostra para quem a superficie faz mais sentido.",
        },
      ),
      makeNode(
        "action_switch",
        { x: 360, y: 260 },
        {
          label: "Quem esta operando?",
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
          label: "Indie hackers + micro-SaaS",
          description:
            "Precisam de leitura de negocio e automacao sem montar uma stack grande demais antes da hora.",
        },
      ),
      makeNode(
        "action_merge",
        { x: 1040, y: 260 },
        {
          label: "Requisito comum",
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

  const wfLandingLegalNodes = [
    makeLandingNode(
      "landing-legal-hero",
      "landingHeroNode",
      { x: 320, y: 180 },
      { width: 880, height: 420 },
      {
        label: "Base legal do produto",
        eyebrow: "Termos de Uso",
        headline: "Termos, responsabilidade e privacidade no mesmo canvas.",
        body: "Ao entrar com Google, o uso do Flow Merge passa a seguir esta pagina para web e desktop. O produto continua local-first: workspace, workflows, nodes e runtime ficam na sua maquina; o backend guarda apenas identidade, sessao, licenca e metadata minima de billing.",
        chips: [
          "google login = aceite",
          "workspace local",
          "pix brasil-first",
          "billing minimo",
        ],
        metrics: [
          {
            value: "14 dias",
            label: "trial completo",
            detail:
              "Automacao, analytics, A/B e funil antes da primeira cobranca.",
          },
          {
            value: "7 + 7",
            label: "prazo + bloqueio",
            detail:
              "Fecha o prazo, abre 7 dias para pagar e depois mais 7 bloqueado antes da delecao total.",
          },
          {
            value: "minimo",
            label: "dados no backend",
            detail:
              "Id, nome, email, imagem, estado comercial e metadata de cobranca.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-legal-acceptance",
      "landingSectionNode",
      { x: 980, y: 2060 },
      { width: 520, height: 500 },
      {
        label: "Aceite e escopo de acesso",
        eyebrow: "Terms of use",
        description:
          "Esta pagina concentra os termos essenciais do v1. O aceite acontece no momento em que a conta Google e usada para criar ou iniciar sessao no Flow Merge.",
        items: [
          {
            title: "Aceite no login Google",
            body: "Criar a conta ou entrar com Google significa aceitar estes termos para usar a versao web e a versao desktop.",
          },
          {
            title: "Escopo do produto",
            body: "O acesso libera a superficie single-user do Flow Merge. Recursos futuros de time, cloud ou comercial podem ter regras separadas.",
          },
          {
            title: "Uso permitido",
            body: "Voce so deve usar a plataforma em fluxos licitos, com base valida para tratar dados e sem violar sistemas, contratos ou direitos de terceiros.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-legal-privacy",
      "landingSectionNode",
      { x: 320, y: 2020 },
      { width: 520, height: 500 },
      {
        label: "Privacidade e dados",
        eyebrow: "Privacy",
        description:
          "O desenho do produto e local-first por padrao. O backend comercial existe para identidade, sessao, licenca e cobranca, nao para guardar o workspace do usuario.",
        items: [
          {
            title: "Workspace fica local",
            body: "Workflows, nodes, runtime stores, logs locais e artefatos continuam no browser ou no app desktop desta maquina.",
          },
          {
            title: "Dados minimos no backend",
            body: "Guardamos somente id, nome, email, image URL, estado de acesso, plano, prazos comerciais e metadata minima das cobrancas PIX.",
          },
          {
            title: "Chaves e integracoes",
            body: "Voce responde pelas chaves, tokens, webhooks e credenciais de terceiros que inserir na plataforma ou em workflows executados por ela.",
          },
          {
            title: "Delecao agressiva no fim do ciclo",
            body: "Se a conta chegar ao estado deleted, os dados comerciais da conta sao removidos do backend e o cliente limpa o workspace local desta instalacao.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-legal-responsibility",
      "landingSectionNode",
      { x: 1240, y: 1380 },
      { width: 520, height: 540 },
      {
        label: "Responsabilidade operacional",
        eyebrow: "Operator responsibility",
        description:
          "Flow Merge ajuda a automatizar e interpretar sinais, mas continua sendo uma ferramenta operada por voce. O usuario responde pelo que executa e pelo que decide automatizar.",
        items: [
          {
            title: "Saidas de IA exigem revisao",
            body: "Sugestoes, textos, hypotheses e acoes propostas pela IA podem errar. Voce deve revisar antes de agir sobre dados, clientes, receita ou incidentes.",
          },
          {
            title: "Nao terceiriza decisao critica",
            body: "Nao use o produto como substituto de analise juridica, fiscal, contabil, medica, securitaria ou qualquer outra revisao especializada exigida pelo seu contexto.",
          },
          {
            title: "Sem abuso ou ataque",
            body: "E proibido usar a plataforma para fraude, spam, scraping abusivo, invasao, exfiltracao de dados, teste ofensivo nao autorizado ou automacao ilicita.",
          },
          {
            title: "Impacto de negocio continua seu",
            body: "A plataforma mostra sinais e impacto estimado, mas a configuracao dos workflows e a decisao final sobre cupons, alerts, pricing e incidentes continuam sob sua responsabilidade.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-legal-billing",
      "landingSectionNode",
      { x: 320, y: 1380 },
      { width: 520, height: 540 },
      {
        label: "Billing, cancelamento e delecao",
        eyebrow: "Commercial lifecycle",
        description:
          "O ciclo comercial do v1 e simples e explicito. O objetivo e evitar ambiguidades sobre trial, renovacao manual, bloqueio e limpeza final da conta.",
        items: [
          {
            title: "Trial e planos",
            body: "O trial dura 14 dias. O plano Pro Mensal custa R$89 por ciclo com PIX manual. O Founder Lifetime custa R$1.068 em pagamento unico por PIX.",
          },
          {
            title: "Atraso de pagamento",
            body: "Se um trial ou ciclo mensal vencer, a conta entra em payment_pending por 7 dias para regularizacao. Se nao houver pagamento, o acesso entra em blocked.",
          },
          {
            title: "Cancelamento",
            body: "Cancelar um plano ativo nao apaga a conta na hora. O cancelamento move a conta para payment_pending com 7 dias para acertar antes do bloqueio.",
          },
          {
            title: "Bloqueio e delecao total",
            body: "Depois do bloqueio, existem mais 7 dias antes da delecao total. No estado deleted, a conta comercial e apagada do backend e o cliente deve limpar o workspace local.",
          },
        ],
      },
    ),
    makeLandingNode(
      "landing-legal-access",
      "landingAccessNode",
      { x: 1340, y: 180 },
      { width: 430, height: 620 },
      {
        label: "Entrar e aceitar",
        eyebrow: "Access node",
        meta: "google + terms + pix",
        description:
          "Entrar com Google inicia o trial e vincula o uso a esta base legal. A sessao vale para web e desktop; o workspace continua local-first.",
      },
    ),
    makeLandingNode(
      "landing-legal-footer",
      "landingFooterNode",
      { x: 320, y: 840 },
      { width: 670, height: 540 },
      {
        label: "Legal e produto na mesma shell",
        eyebrow: "Legal page",
        meta: "public page",
        description:
          "A pagina legal nao vive fora do produto. Ela usa a mesma superficie, a mesma linguagem e o mesmo modelo de pagina do restante do site.",
        focusNodeId: LANDING_LEGAL_ACCESS_NODE_ID,
        focusWorkflowId: LEGAL_LANDING_WORKFLOW_ID,
        pages: [
          {
            title: "Landing Page",
            slug: "/",
            status: "live",
            summary:
              "Posicionamento do produto, casos ancora e acesso ao trial no proprio canvas.",
          },
          {
            title: "Termos de Uso",
            slug: "/legal",
            status: "live",
            summary:
              "Termos de uso, responsabilidade operacional e politica de privacidade em uma pagina unica.",
          },
          {
            title: "Pricing",
            slug: "/pricing",
            status: "next",
            summary:
              "Detalhamento comercial dos planos, renovacao manual via PIX e upgrade para lifetime.",
          },
          {
            title: "Docs",
            slug: "/docs",
            status: "next",
            summary:
              "Guias operacionais, playbooks e templates de workflows para pequenos SaaS.",
          },
        ],
      },
    ),
  ];

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
      id: LEGAL_LANDING_WORKFLOW_ID,
      projectId: LANDING_PROJECT_ID,
      name: "Termos de Uso",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description:
        "Pagina publica com termos de uso, responsabilidade operacional e politica de privacidade.",
      tags: ["landing", "page", "legal", "terms", "privacy"],
      createdAt: nowIso(-86400000),
      updatedAt: nowIso(-1200000),
      nodes: wfLandingLegalNodes,
      edges: [
        edge("landing-legal-hero", "landing-legal-acceptance"),
        edge("landing-legal-hero", "landing-legal-privacy"),
        edge("landing-legal-hero", "landing-legal-access"),
        edge("landing-legal-acceptance", "landing-legal-responsibility"),
        edge("landing-legal-privacy", "landing-legal-billing"),
        edge("landing-legal-access", "landing-legal-billing"),
        edge("landing-legal-responsibility", "landing-legal-footer"),
        edge("landing-legal-billing", "landing-legal-footer"),
      ],
    },
    {
      id: "wf_landing_compare",
      projectId: LANDING_PROJECT_ID,
      name: "Execute, analyze, act",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description:
        "Board comparativo para explicar a tese do produto sem slogan vazio.",
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
      name: "Casos ancora",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description:
        "Fluxos curtos para logs, funnel e comportamento no mesmo plano operacional.",
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
      name: "Quem sente valor primeiro",
      accent: "#58a6ff",
      active: true,
      surface: "landing",
      description: "Board de ICP, timing de compra e fit operacional.",
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
