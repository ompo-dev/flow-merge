export type NodeTypeId =
  | "trigger_webhook"
  | "trigger_schedule"
  | "trigger_manual"
  | "action_http"
  | "action_code"
  | "action_set"
  | "action_if"
  | "action_switch"
  | "action_merge"
  | "action_split"
  | "action_email"
  | "action_slack"
  | "action_notion"
  | "action_github"
  | "action_openai"
  | "action_function"
  | "action_filter"
  | "action_wait"
  | "action_respond"
  | "analytics_store"
  | "analytics_aggregate"
  | "analytics_compare"
  | "analytics_ab"
  | "analytics_funnel"
  | "analytics_segment"
  | "analytics_enrich"
  | "monitor_error"
  | "monitor_alert"
  | "monitor_revenue"
  | "viz_metric"
  | "viz_chart"
  | "viz_table"
  | "viz_report"
  | "viz_funnel"
  | "viz_dashboard";

export type FlowShellType =
  | "triggerNode"
  | "actionNode"
  | "vizNode"
  | "dashboardNode";

export interface NodeParameterOption {
  value: string;
  label: string;
}

export interface NodeParameterField {
  label: string;
  type: "text" | "number" | "textarea" | "select";
  placeholder: string;
  helpText?: string;
  options?: NodeParameterOption[];
}

export interface NodeCatalogItem {
  type: NodeTypeId;
  label: string;
  description: string;
  icon: string;
  category:
    | "Triggers"
    | "Core"
    | "Analytics"
    | "Monitoring"
    | "Visualization"
    | "Integrations";
  shellType: FlowShellType;
  badge: string;
  accent: string;
  subtle: string;
  chartType?: "line" | "bar" | "area";
  vizVariant?: "revenue" | "conversion" | "users" | "errors" | "aov" | "custom";
}

const httpMethodOptions: NodeParameterOption[] = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

const authOptions: NodeParameterOption[] = [
  { value: "None", label: "Nenhuma" },
  { value: "Bearer Token", label: "Token Bearer" },
  { value: "Secret Token", label: "Token Secreto" },
  { value: "Basic Auth", label: "Auth Básica" },
];

const scheduleOptions: NodeParameterOption[] = [
  { value: "Every 5 minutes", label: "A cada 5 minutos" },
  { value: "Every 15 minutes", label: "A cada 15 minutos" },
  { value: "Every hour", label: "A cada hora" },
  { value: "Every day", label: "Todo dia" },
];

const responseFormatOptions: NodeParameterOption[] = [
  { value: "JSON", label: "JSON" },
  { value: "Text", label: "Texto" },
  { value: "Raw", label: "Bruto" },
];

const languageOptions: NodeParameterOption[] = [
  { value: "JavaScript", label: "JavaScript" },
];

const compareOptions: NodeParameterOption[] = [
  { value: "equals", label: "igual a" },
  { value: "not equals", label: "diferente de" },
  { value: "greater than", label: "maior que" },
  { value: "greater or equal", label: "maior ou igual" },
  { value: "less than", label: "menor que" },
  { value: "less or equal", label: "menor ou igual" },
  { value: "contains", label: "contém" },
];

const mergeModeOptions: NodeParameterOption[] = [
  { value: "Merge by Field", label: "Unir por campo" },
  { value: "Append Rows", label: "Anexar linhas" },
  { value: "Keep First", label: "Manter primeiro" },
];

const notionOperationOptions: NodeParameterOption[] = [
  { value: "Create", label: "Criar página" },
  { value: "Update", label: "Atualizar página" },
  { value: "Query", label: "Consultar base" },
];

const githubOperationOptions: NodeParameterOption[] = [
  { value: "Get Pull Request", label: "Buscar pull request" },
  { value: "Create Issue", label: "Criar issue" },
  { value: "Create Comment", label: "Criar comentário" },
];

const openAiModelOptions: NodeParameterOption[] = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { value: "deepseek-chat", label: "deepseek-chat" },
];

const filterRuleOptions: NodeParameterOption[] = compareOptions;

const waitUnitOptions: NodeParameterOption[] = [
  { value: "Seconds", label: "Segundos" },
  { value: "Minutes", label: "Minutos" },
  { value: "Hours", label: "Horas" },
  { value: "Days", label: "Dias" },
];

const respondWithOptions: NodeParameterOption[] = [
  { value: "JSON payload", label: "Payload JSON" },
  { value: "Plain text", label: "Texto puro" },
  { value: "Empty 204", label: "204 vazio" },
];

const aggregationOptions: NodeParameterOption[] = [
  { value: "Sum", label: "Soma" },
  { value: "Count", label: "Contagem" },
  { value: "Average", label: "Média" },
  { value: "Min", label: "Min" },
  { value: "Max", label: "Max" },
];

const significanceOptions: NodeParameterOption[] = [
  { value: "90%", label: "90%" },
  { value: "95%", label: "95%" },
  { value: "99%", label: "99%" },
];

const sourceOptions: NodeParameterOption[] = [
  { value: "Data Store", label: "Data Store" },
  { value: "Previous Node", label: "Node anterior" },
  { value: "Webhook Body", label: "Corpo do Webhook" },
];

const errorLevelOptions: NodeParameterOption[] = [
  { value: "ERROR + FATAL", label: "ERRO + FATAL" },
  { value: "WARN + ERROR + FATAL", label: "WARN + ERRO + FATAL" },
  { value: "All levels", label: "Todos os níveis" },
];

const alertChannelOptions: NodeParameterOption[] = [
  { value: "Slack", label: "Slack" },
  { value: "Email", label: "Email" },
  { value: "Webhook", label: "Webhook" },
];

const revenueMetricOptions: NodeParameterOption[] = [
  { value: "MRR", label: "MRR" },
  { value: "ARR", label: "ARR" },
  { value: "Revenue", label: "Receita" },
  { value: "Average Order Value", label: "Ticket médio" },
];

const currencyOptions: NodeParameterOption[] = [
  { value: "USD", label: "USD" },
  { value: "BRL", label: "BRL" },
  { value: "EUR", label: "EUR" },
];

const chartTypeOptions: NodeParameterOption[] = [
  { value: "Line", label: "Linha" },
  { value: "Bar", label: "Barras" },
  { value: "Area", label: "Área" },
];

const refreshOptions: NodeParameterOption[] = [
  { value: "Every 15m", label: "A cada 15 min" },
  { value: "Every 1h", label: "A cada 1h" },
  { value: "Every 6h", label: "A cada 6h" },
  { value: "Daily", label: "Diário" },
];

const layoutOptions: NodeParameterOption[] = [
  { value: "4 columns", label: "4 colunas" },
  { value: "6 columns", label: "6 colunas" },
  { value: "8 columns", label: "8 colunas" },
];

export const nodeCategories: Array<{
  id: string;
  label: NodeCatalogItem["category"];
  items: NodeCatalogItem[];
}> = [
  {
    id: "triggers",
    label: "Triggers",
    items: [
      {
        type: "trigger_manual",
        label: "Manual Trigger",
        description: "Dispara o workflow manualmente.",
        icon: "Play",
        category: "Triggers",
        shellType: "triggerNode",
        badge: "TRIGGER",
        accent: "#d29922",
        subtle: "#2b2200",
      },
      {
        type: "trigger_webhook",
        label: "Webhook",
        description: "Recebe eventos via HTTP e inicia o fluxo.",
        icon: "Globe",
        category: "Triggers",
        shellType: "triggerNode",
        badge: "TRIGGER",
        accent: "#d29922",
        subtle: "#2b2200",
      },
      {
        type: "trigger_schedule",
        label: "Schedule",
        description: "Executa em intervalos de tempo definidos.",
        icon: "Clock3",
        category: "Triggers",
        shellType: "triggerNode",
        badge: "TRIGGER",
        accent: "#d29922",
        subtle: "#2b2200",
      },
    ],
  },
  {
    id: "core",
    label: "Core",
    items: [
      {
        type: "action_if",
        label: "If",
        description: "Divide o fluxo com base em uma condição.",
        icon: "GitBranch",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_switch",
        label: "Switch",
        description: "Roteia para múltiplos caminhos por valor.",
        icon: "GitBranch",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_merge",
        label: "Merge",
        description: "Combina streams de dados.",
        icon: "GitMerge",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_split",
        label: "Split In Batches",
        description: "Divide a entrada em lotes processáveis.",
        icon: "Rows3",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_set",
        label: "Set",
        description: "Define ou altera campos do payload.",
        icon: "Equal",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_filter",
        label: "Filter",
        description: "Filtra itens com base em regras.",
        icon: "Filter",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_code",
        label: "Code",
        description: "Executa lógica customizada em código.",
        icon: "Code2",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_function",
        label: "Function",
        description: "Aplica uma função curta sobre o dado.",
        icon: "Braces",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_wait",
        label: "Wait",
        description: "Pausa o fluxo por um período.",
        icon: "TimerReset",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_http",
        label: "HTTP Request",
        description: "Consulta APIs e serviços externos.",
        icon: "Globe",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
      {
        type: "action_respond",
        label: "Respond",
        description: "Responde ao chamador do webhook.",
        icon: "Reply",
        category: "Core",
        shellType: "actionNode",
        badge: "ACTION",
        accent: "#1f6feb",
        subtle: "#0c1a2e",
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      {
        type: "analytics_store",
        label: "Data Store",
        description: "Armazena eventos e resultados.",
        icon: "Database",
        category: "Analytics",
        shellType: "actionNode",
        badge: "ANALYTICS",
        accent: "#58a6ff",
        subtle: "#0c1a2e",
      },
      {
        type: "analytics_aggregate",
        label: "Aggregate",
        description: "Agrupa, soma, conta e resume dados.",
        icon: "Sigma",
        category: "Analytics",
        shellType: "actionNode",
        badge: "ANALYTICS",
        accent: "#58a6ff",
        subtle: "#0c1a2e",
      },
      {
        type: "analytics_compare",
        label: "Compare",
        description: "Compara duas fontes lado a lado.",
        icon: "Scale",
        category: "Analytics",
        shellType: "actionNode",
        badge: "ANALYTICS",
        accent: "#58a6ff",
        subtle: "#0c1a2e",
      },
      {
        type: "analytics_ab",
        label: "A/B Analyzer",
        description: "Decide vencedor de testes e variantes.",
        icon: "TestTube2",
        category: "Analytics",
        shellType: "actionNode",
        badge: "ANALYTICS",
        accent: "#58a6ff",
        subtle: "#0c1a2e",
      },
      {
        type: "analytics_funnel",
        label: "Funnel Builder",
        description: "Monta funis de conversão a partir de eventos.",
        icon: "Funnel",
        category: "Analytics",
        shellType: "actionNode",
        badge: "ANALYTICS",
        accent: "#58a6ff",
        subtle: "#0c1a2e",
      },
      {
        type: "analytics_segment",
        label: "Segment",
        description: "Segmenta usuários por coorte e comportamento.",
        icon: "Users",
        category: "Analytics",
        shellType: "actionNode",
        badge: "ANALYTICS",
        accent: "#58a6ff",
        subtle: "#0c1a2e",
      },
      {
        type: "analytics_enrich",
        label: "Enrich Data",
        description: "Enriquece eventos com contexto adicional.",
        icon: "ScanSearch",
        category: "Analytics",
        shellType: "actionNode",
        badge: "ANALYTICS",
        accent: "#58a6ff",
        subtle: "#0c1a2e",
      },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    items: [
      {
        type: "monitor_error",
        label: "Error Monitor",
        description: "Classifica e acompanha eventos de erro.",
        icon: "Bug",
        category: "Monitoring",
        shellType: "actionNode",
        badge: "MONITOR",
        accent: "#d29922",
        subtle: "#2b2200",
      },
      {
        type: "monitor_alert",
        label: "Alert",
        description: "Dispara alertas por limiar ou condição.",
        icon: "BellRing",
        category: "Monitoring",
        shellType: "actionNode",
        badge: "MONITOR",
        accent: "#d29922",
        subtle: "#2b2200",
      },
      {
        type: "monitor_revenue",
        label: "Revenue Tracker",
        description: "Monitora impacto de receita e MRR.",
        icon: "DollarSign",
        category: "Monitoring",
        shellType: "actionNode",
        badge: "MONITOR",
        accent: "#d29922",
        subtle: "#2b2200",
      },
    ],
  },
  {
    id: "visualization",
    label: "Visualization",
    items: [
      {
        type: "viz_metric",
        label: "Metric Card",
        description: "Mostra um KPI direto no canvas.",
        icon: "Gauge",
        category: "Visualization",
        shellType: "vizNode",
        badge: "VIZ",
        accent: "#3fb950",
        subtle: "#1b2b1f",
        vizVariant: "revenue",
      },
      {
        type: "viz_chart",
        label: "Chart",
        description: "Renderiza séries, barras e áreas inline.",
        icon: "LineChart",
        category: "Visualization",
        shellType: "vizNode",
        badge: "VIZ",
        accent: "#3fb950",
        subtle: "#1b2b1f",
        chartType: "line",
        vizVariant: "revenue",
      },
      {
        type: "viz_table",
        label: "Table",
        description: "Exibe tabelas operacionais no fluxo.",
        icon: "Table2",
        category: "Visualization",
        shellType: "vizNode",
        badge: "VIZ",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
      {
        type: "viz_report",
        label: "Report",
        description: "Gera relatórios resumidos e insights.",
        icon: "FileText",
        category: "Visualization",
        shellType: "vizNode",
        badge: "VIZ",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
      {
        type: "viz_funnel",
        label: "Funnel Chart",
        description: "Visualiza etapas e conversões do funil.",
        icon: "ChartColumn",
        category: "Visualization",
        shellType: "vizNode",
        badge: "VIZ",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
      {
        type: "viz_dashboard",
        label: "Dashboard Canvas",
        description: "Node painel com widgets arrastáveis estilo B.",
        icon: "LayoutDashboard",
        category: "Visualization",
        shellType: "dashboardNode",
        badge: "VIZ",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      {
        type: "action_email",
        label: "Send Email",
        description: "Dispara emails e sequências automáticas.",
        icon: "Mail",
        category: "Integrations",
        shellType: "actionNode",
        badge: "INTEGRATION",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
      {
        type: "action_slack",
        label: "Slack",
        description: "Envia mensagens e alertas para canais.",
        icon: "MessageSquare",
        category: "Integrations",
        shellType: "actionNode",
        badge: "INTEGRATION",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
      {
        type: "action_notion",
        label: "Notion",
        description: "Lê e escreve páginas e bases no Notion.",
        icon: "FileText",
        category: "Integrations",
        shellType: "actionNode",
        badge: "INTEGRATION",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
      {
        type: "action_github",
        label: "GitHub",
        description: "Trabalha com PRs, repos e automações de release.",
        icon: "Github",
        category: "Integrations",
        shellType: "actionNode",
        badge: "INTEGRATION",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
      {
        type: "action_openai",
        label: "OpenAI",
        description: "Aplica IA em decisões, resumo e geração.",
        icon: "Sparkles",
        category: "Integrations",
        shellType: "actionNode",
        badge: "INTEGRATION",
        accent: "#3fb950",
        subtle: "#1b2b1f",
      },
    ],
  },
];

export const nodeCatalog = nodeCategories.flatMap((category) => category.items);

export const nodeCatalogMap: Record<NodeTypeId, NodeCatalogItem> = Object.fromEntries(
  nodeCatalog.map((item) => [item.type, item]),
) as Record<NodeTypeId, NodeCatalogItem>;

export const parameterDefaults: Record<NodeTypeId, NodeParameterField[]> = {
  trigger_webhook: [
    {
      label: "HTTP Method",
      type: "select",
      placeholder: "POST",
      helpText: "Como o seu app vai enviar eventos para este trigger.",
      options: httpMethodOptions,
    },
    {
      label: "Path",
      type: "text",
      placeholder: "/webhook/cart",
      helpText: "Rota pública que o seu produto vai chamar.",
    },
    {
      label: "Authentication",
      type: "select",
      placeholder: "Nenhuma",
      helpText: "Proteja este webhook se ele for receber tráfego de produção.",
      options: authOptions,
    },
    {
      label: "Secret Token",
      type: "text",
      placeholder: "Segredo compartilhado opcional",
      helpText: "Usado só quando a autenticação exigir um token.",
    },
    {
      label: "Tag Field",
      type: "text",
      placeholder: "variant",
      helpText: "Nome de campo opcional adicionado automaticamente aos eventos recebidos.",
    },
    {
      label: "Tag Value",
      type: "text",
      placeholder: "variant_a",
      helpText: "Valor opcional usado para marcar eventos desta origem.",
    },
  ],
  trigger_schedule: [
    {
      label: "Trigger Interval",
      type: "select",
      placeholder: "A cada 5 minutos",
      helpText: "Escolha com que frequência este workflow deve rodar automaticamente.",
      options: scheduleOptions,
    },
    {
      label: "Timezone",
      type: "text",
      placeholder: "UTC",
      helpText: "Fuso horário usado para interpretar o agendamento.",
    },
  ],
  trigger_manual: [],
  action_http: [
    {
      label: "Method",
      type: "select",
      placeholder: "GET",
      helpText: "Método HTTP usado para a chamada externa.",
      options: httpMethodOptions,
    },
    {
      label: "URL",
      type: "text",
      placeholder: "https://api.example.com/data",
      helpText: "URL de destino que este node deve chamar.",
    },
    {
      label: "Response Format",
      type: "select",
      placeholder: "JSON",
      helpText: "Como a resposta deve ser interpretada antes de seguir no fluxo.",
      options: responseFormatOptions,
    },
  ],
  action_code: [
    {
      label: "Language",
      type: "select",
      placeholder: "JavaScript",
      options: languageOptions,
    },
    {
      label: "Code",
      type: "textarea",
      placeholder: "return items;",
      helpText: "Só no modo avançado. Use o editor completo abaixo para lógica customizada.",
    },
  ],
  action_set: [
    {
      label: "Field Name",
      type: "text",
      placeholder: "revenue_delta",
      helpText: "Nome do campo que você quer adicionar ou sobrescrever.",
    },
    {
      label: "Field Value",
      type: "text",
      placeholder: "{{ $json.value }}",
      helpText: "Valor fixo ou valor mapeado do payload de entrada.",
    },
  ],
  action_if: [
    {
      label: "Value 1",
      type: "text",
      placeholder: "{{ $json.status }}",
      helpText: "Lado esquerdo da comparação.",
    },
    {
      label: "Operation",
      type: "select",
      placeholder: "igual a",
      helpText: "Regra usada para comparar os dois valores.",
      options: compareOptions,
    },
    {
      label: "Value 2",
      type: "text",
      placeholder: "active",
      helpText: "Valor esperado para a condição bater.",
    },
  ],
  action_switch: [
    {
      label: "Value",
      type: "text",
      placeholder: "{{ $json.segment }}",
      helpText: "Campo que decide qual saída será usada.",
    },
    {
      label: "Operation",
      type: "select",
      placeholder: "igual a",
      helpText: "Regra de comparação usada em todos os casos abaixo.",
      options: compareOptions,
    },
    { label: "Case 1", type: "text", placeholder: "controle", helpText: "Primeira rota correspondente." },
    {
      label: "Case 2",
      type: "text",
      placeholder: "treatment_a",
      helpText: "Segunda rota correspondente.",
    },
    {
      label: "Case 3",
      type: "text",
      placeholder: "treatment_b",
      helpText: "Terceira rota correspondente.",
    },
    { label: "Case 4", type: "text", placeholder: "fallback", helpText: "Quarta rota correspondente." },
  ],
  action_merge: [
    {
      label: "Mode",
      type: "select",
      placeholder: "Unir por campo",
      helpText: "Escolha como múltiplas entradas devem ser combinadas.",
      options: mergeModeOptions,
    },
    {
      label: "Join Field",
      type: "text",
      placeholder: "user_id",
      helpText: "Chave compartilhada usada ao unir por campo.",
    },
  ],
  action_split: [
    {
      label: "Batch Size",
      type: "number",
      placeholder: "100",
      helpText: "Quantos itens devem seguir em cada lote.",
    },
  ],
  action_email: [
    { label: "API Key", type: "text", placeholder: "re_..." },
    { label: "From", type: "text", placeholder: "Flow Merge <alerts@company.com>" },
    { label: "To", type: "text", placeholder: "team@company.com" },
    { label: "Subject", type: "text", placeholder: "Weekly report" },
    { label: "Message", type: "textarea", placeholder: "Resumo do workflow..." },
  ],
  action_slack: [
    { label: "Webhook URL", type: "text", placeholder: "https://hooks.slack.com/services/..." },
    { label: "Channel", type: "text", placeholder: "#growth" },
    { label: "Message", type: "textarea", placeholder: "Novo alerta de receita." },
  ],
  action_notion: [
    { label: "Token", type: "text", placeholder: "secret_xxx" },
    { label: "Database ID", type: "text", placeholder: "notion-db-id" },
    {
      label: "Operation",
      type: "select",
      placeholder: "Create",
      options: notionOperationOptions,
    },
  ],
  action_github: [
    { label: "Token", type: "text", placeholder: "github_pat_xxx" },
    { label: "Owner", type: "text", placeholder: "acme" },
    { label: "Repository", type: "text", placeholder: "saas-app" },
    {
      label: "Operation",
      type: "select",
      placeholder: "Buscar pull request",
      options: githubOperationOptions,
    },
  ],
  action_openai: [
    { label: "API Key", type: "text", placeholder: "sk-..." },
    { label: "API Base URL", type: "text", placeholder: "https://api.deepseek.com/v1/chat/completions" },
    {
      label: "Model",
      type: "select",
      placeholder: "gpt-4o-mini",
      options: openAiModelOptions,
    },
    { label: "Prompt", type: "textarea", placeholder: "Resuma as métricas do dia..." },
  ],
  action_function: [{ label: "Code", type: "textarea", placeholder: "return transform(input);" }],
  action_filter: [
    { label: "Field", type: "text", placeholder: "{{ $json.mrr }}" },
    {
      label: "Rule",
      type: "select",
      placeholder: "maior que",
      options: filterRuleOptions,
    },
    { label: "Value", type: "text", placeholder: "1000" },
  ],
  action_wait: [
    {
      label: "Unit",
      type: "select",
      placeholder: "Minutos",
      options: waitUnitOptions,
    },
    { label: "Amount", type: "number", placeholder: "30" },
  ],
  action_respond: [
    { label: "Response Code", type: "number", placeholder: "200" },
    {
      label: "Respond With",
      type: "select",
      placeholder: "Payload JSON",
      options: respondWithOptions,
    },
  ],
  analytics_store: [
    { label: "Store Name", type: "text", placeholder: "events_store" },
    { label: "TTL (days)", type: "number", placeholder: "90" },
  ],
  analytics_aggregate: [
    { label: "Group By", type: "text", placeholder: "{{ $json.date }}" },
    {
      label: "Aggregation",
      type: "select",
      placeholder: "Soma",
      options: aggregationOptions,
    },
    { label: "Field", type: "text", placeholder: "{{ $json.amount }}" },
  ],
  analytics_compare: [
    { label: "Input A Label", type: "text", placeholder: "Control" },
    { label: "Input B Label", type: "text", placeholder: "Treatment" },
    { label: "Metric", type: "text", placeholder: "Conversion Rate" },
  ],
  analytics_ab: [
    { label: "Store Names", type: "text", placeholder: "ab_variant_a,ab_variant_b" },
    { label: "Variant Field", type: "text", placeholder: "variant" },
    { label: "Conversion Field", type: "text", placeholder: "converted" },
    { label: "Revenue Field", type: "text", placeholder: "amount" },
    {
      label: "Significance",
      type: "select",
      placeholder: "95%",
      options: significanceOptions,
    },
    { label: "Minimum Sample", type: "number", placeholder: "100" },
  ],
  analytics_funnel: [
    { label: "Step 1", type: "text", placeholder: "page_view" },
    { label: "Step 2", type: "text", placeholder: "signup" },
    { label: "Step 3", type: "text", placeholder: "paid" },
  ],
  analytics_segment: [
    { label: "Segment Field", type: "text", placeholder: "{{ $json.plan }}" },
    { label: "Values", type: "text", placeholder: "free,pro,enterprise" },
  ],
  analytics_enrich: [
    {
      label: "Source",
      type: "select",
      placeholder: "Data Store",
      options: sourceOptions,
    },
    { label: "Join Field", type: "text", placeholder: "user_id" },
  ],
  monitor_error: [
    {
      label: "Level Filter",
      type: "select",
      placeholder: "ERRO + FATAL",
      options: errorLevelOptions,
    },
    { label: "Pattern", type: "text", placeholder: "Exception|Timeout" },
  ],
  monitor_alert: [
    { label: "Threshold", type: "number", placeholder: "0.05" },
    { label: "Field", type: "text", placeholder: "{{ $json.error_rate }}" },
    {
      label: "Channel",
      type: "select",
      placeholder: "Slack",
      options: alertChannelOptions,
    },
  ],
  monitor_revenue: [
    {
      label: "Metric",
      type: "select",
      placeholder: "MRR",
      options: revenueMetricOptions,
    },
    {
      label: "Currency",
      type: "select",
      placeholder: "USD",
      options: currencyOptions,
    },
  ],
  viz_metric: [
    { label: "Metric Label", type: "text", placeholder: "MRR" },
    { label: "Data Field", type: "text", placeholder: "{{ $json.total }}" },
  ],
  viz_chart: [
    {
      label: "Chart Type",
      type: "select",
      placeholder: "Linha",
      options: chartTypeOptions,
    },
    { label: "X Axis", type: "text", placeholder: "{{ $json.date }}" },
    { label: "Y Axis", type: "text", placeholder: "{{ $json.value }}" },
  ],
  viz_table: [
    { label: "Columns", type: "text", placeholder: "name,value,change" },
    { label: "Max Rows", type: "number", placeholder: "10" },
  ],
  viz_report: [
    { label: "Title", type: "text", placeholder: "Weekly Summary" },
    {
      label: "Refresh",
      type: "select",
      placeholder: "A cada 1h",
      options: refreshOptions,
    },
  ],
  viz_funnel: [
    { label: "Stage 1", type: "text", placeholder: "Page View" },
    { label: "Stage 2", type: "text", placeholder: "Sign Up" },
    { label: "Stage 3", type: "text", placeholder: "Paid" },
  ],
  viz_dashboard: [
    {
      label: "Layout",
      type: "select",
      placeholder: "6 colunas",
      options: layoutOptions,
    },
    { label: "Title", type: "text", placeholder: "Growth Command Center" },
  ],
};

export const allowedAiNodeTypes = nodeCatalog.map((item) => item.type);

export function getNodeMeta(nodeType: NodeTypeId) {
  return nodeCatalogMap[nodeType];
}

export function isTriggerNodeType(nodeType: NodeTypeId) {
  return nodeType.startsWith("trigger_");
}
