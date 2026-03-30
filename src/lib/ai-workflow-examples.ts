type WorkflowExample = {
  id: string;
  title: string;
  category:
    | "marketing"
    | "experiments"
    | "monitoring"
    | "metrics"
    | "finance"
    | "automation";
  keywords: string[];
  prompt: string;
  topology: string[];
  programming: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const workflowExamples: WorkflowExample[] = [
  {
    id: "logs_frontend_backend",
    title: "Frontend vs Backend Error Logs",
    category: "monitoring",
    keywords: ["observabilidade", "logs", "frontend", "backend", "error", "erro"],
    prompt:
      "Gerar fluxo de observabilidade com triggers de frontend e backend para comparar qual lado gera mais logs de erro.",
    topology: [
      "trigger_webhook frontend -> analytics_store frontend",
      "trigger_webhook backend -> analytics_store backend",
      "analytics_compare with active sources",
      "viz_metric por fonte + viz_metric total + viz_chart bar + viz_report + monitor_alert",
    ],
    programming: [
      "Contar eventos por fonte ativa, nunca tratar como A/B test",
      "Alertar em cima de total ou leaderValue, não de campo fake",
    ],
  },
  {
    id: "api_latency_regions",
    title: "API Latency by Region",
    category: "monitoring",
    keywords: ["latencia", "latency", "api", "region", "regiao", "endpoint"],
    prompt:
      "Criar fluxo para comparar latência da API por região e alertar quando uma região disparar.",
    topology: [
      "trigger_webhook por região ou gateway -> analytics_store por região",
      "analytics_compare para p95 / response time",
      "viz_chart line or bar + viz_report + monitor_alert",
    ],
    programming: [
      "Somar ou agregar latência em vez de contar itens cegamente",
      "Destacar leader e delta entre regiões",
    ],
  },
  {
    id: "payment_failures_gateway",
    title: "Payment Failure Monitor by Gateway",
    category: "monitoring",
    keywords: ["payment", "pagamento", "stripe", "gateway", "falha", "failure", "checkout"],
    prompt:
      "Fluxo para monitorar falhas de pagamento e comparar por gateway.",
    topology: [
      "trigger_webhook payments -> action_filter only failures",
      "analytics_store por gateway",
      "analytics_compare + viz_metric top failing gateway + viz_chart + monitor_alert",
    ],
    programming: [
      "Filtrar status failed antes de persistir",
      "Mostrar gateway com maior volume de falhas",
    ],
  },
  {
    id: "queue_failures",
    title: "Background Job Failure Monitor",
    category: "monitoring",
    keywords: ["queue", "fila", "job", "worker", "background", "retry"],
    prompt:
      "Criar fluxo para acompanhar jobs com falha por worker ou fila.",
    topology: [
      "trigger_webhook worker events -> analytics_store por fila",
      "analytics_compare por fila",
      "viz_chart + viz_report + monitor_alert",
    ],
    programming: [
      "Usar status do job para classificar sucesso e falha",
      "Alertar quando retries ou failures passarem do limite",
    ],
  },
  {
    id: "uptime_services",
    title: "Uptime and Incident View by Service",
    category: "monitoring",
    keywords: ["uptime", "incidente", "incident", "service", "servico", "status page"],
    prompt:
      "Gerar fluxo de uptime com comparação entre serviços e alerta de indisponibilidade.",
    topology: [
      "trigger_schedule / trigger_webhook health checks",
      "analytics_store por serviço",
      "analytics_compare + viz_chart + viz_metric + monitor_alert",
    ],
    programming: [
      "Calcular disponibilidade ou incident count por serviço",
      "Expor leader, total e delta entre serviços",
    ],
  },
  {
    id: "ab_pricing",
    title: "Pricing Page A/B Test",
    category: "experiments",
    keywords: ["pricing", "preco", "ab", "a/b", "teste", "variant"],
    prompt:
      "Criar fluxo de A/B test para pricing page com winner detection e notificações.",
    topology: [
      "trigger_webhook por variante com Tag Field/Value",
      "action_switch router -> analytics_store por variante",
      "analytics_ab -> viz_chart + viz_report + viz_metric + action_if + notifications",
    ],
    programming: [
      "Nunca randomizar com action_split",
      "Usar winner e winningRate para decisões downstream",
    ],
  },
  {
    id: "ab_onboarding",
    title: "Onboarding Experiment",
    category: "experiments",
    keywords: ["onboarding", "activation", "ab", "a/b", "signup", "trial"],
    prompt:
      "Testar duas ou três variantes de onboarding e decidir vencedor por ativação.",
    topology: [
      "trigger_webhook por variante",
      "action_switch -> analytics_store",
      "analytics_ab com conversion field activation",
      "winner metric + report + alert",
    ],
    programming: [
      "Converter boolean de ativação em conversion field",
      "Diferenciar conversion rate de volume bruto",
    ],
  },
  {
    id: "checkout_multivariate",
    title: "Checkout Multivariate Test",
    category: "experiments",
    keywords: ["checkout", "multivari", "variant", "payment", "upsell"],
    prompt:
      "Criar fluxo multivariado de checkout com comparação de conversão e receita.",
    topology: [
      "3+ triggers por variante",
      "action_switch -> analytics_store por variante",
      "analytics_ab -> chart/report/metric -> winner -> notifications",
    ],
    programming: [
      "Usar Revenue Field e Conversion Field juntos",
      "Mostrar winner apenas com sample mínimo",
    ],
  },
  {
    id: "feature_flag_rollout",
    title: "Feature Rollout Compare",
    category: "experiments",
    keywords: ["feature flag", "rollout", "beta", "segment", "adoption"],
    prompt:
      "Comparar adoção e erro entre usuários com feature ligada e desligada.",
    topology: [
      "trigger_webhook flag_on + trigger_webhook flag_off",
      "analytics_store por grupo",
      "analytics_compare ou analytics_ab conforme métrica",
      "viz_metric + viz_chart + monitor_alert",
    ],
    programming: [
      "Se a métrica for erro ou volume usar analytics_compare",
      "Se a métrica for conversão usar analytics_ab",
    ],
  },
  {
    id: "campaign_attribution",
    title: "Campaign Attribution",
    category: "marketing",
    keywords: ["utm", "campaign", "ads", "attribution", "marketing", "lead"],
    prompt:
      "Montar fluxo para comparar campanhas por leads e conversão.",
    topology: [
      "trigger_webhook lead events",
      "action_set normalize utm_source / utm_campaign",
      "analytics_store por campanha",
      "analytics_compare + chart/report/metric",
    ],
    programming: [
      "Normalizar utm antes de agregar",
      "Comparar sources ativas, não labels fixas",
    ],
  },
  {
    id: "lead_capture_crm",
    title: "Lead Capture to CRM",
    category: "marketing",
    keywords: ["lead", "crm", "form", "newsletter", "signup"],
    prompt:
      "Automação para capturar leads, enriquecer e enviar para CRM com alertas.",
    topology: [
      "trigger_webhook lead form",
      "action_set normalize fields",
      "analytics_store leads",
      "action_http or action_email / slack for routing",
    ],
    programming: [
      "Preparar payload limpo para CRM",
      "Separar persistência de notificação",
    ],
  },
  {
    id: "waitlist_funnel",
    title: "Waitlist Funnel",
    category: "marketing",
    keywords: ["waitlist", "launch", "landing page", "signup", "funnel"],
    prompt:
      "Criar fluxo para acompanhar waitlist e funil da landing page.",
    topology: [
      "trigger_webhook page events",
      "analytics_store page views + signups",
      "analytics_funnel + viz_metric + viz_report",
    ],
    programming: [
      "Separar page_view, join_waitlist e activation",
      "Gerar funil em vez de comparação A/B",
    ],
  },
  {
    id: "email_campaign_performance",
    title: "Email Campaign Performance",
    category: "marketing",
    keywords: ["email", "open", "click", "campaign", "broadcast", "mail"],
    prompt:
      "Comparar campanhas de email por open rate e click rate.",
    topology: [
      "trigger_webhook por campanha ou batch",
      "analytics_store por campanha",
      "analytics_compare ou table + chart + report",
    ],
    programming: [
      "Agregação por campanha, opens e clicks",
      "Mostrar source leader e delta",
    ],
  },
  {
    id: "affiliate_tracking",
    title: "Affiliate Performance",
    category: "marketing",
    keywords: ["affiliate", "referral", "partner", "commission", "campaign"],
    prompt:
      "Criar fluxo para acompanhar afiliados por leads, trials e revenue.",
    topology: [
      "trigger_webhook partner events",
      "analytics_store por afiliado",
      "analytics_compare + report + alert",
    ],
    programming: [
      "Derivar métricas por partner_id",
      "Alertar quando um parceiro dispara ou cai demais",
    ],
  },
  {
    id: "onboarding_activation_metrics",
    title: "Activation Funnel",
    category: "metrics",
    keywords: ["activation", "funnel", "onboarding", "signup", "activated"],
    prompt:
      "Montar métricas gerais de ativação do SaaS com funil e relatório.",
    topology: [
      "trigger_webhook product events",
      "analytics_store activation events",
      "analytics_funnel -> viz_metric + viz_report + viz_chart",
    ],
    programming: [
      "Mapear passos page_view -> signup -> activate -> paid",
      "Mostrar gargalo principal no report",
    ],
  },
  {
    id: "feature_adoption",
    title: "Feature Adoption Tracker",
    category: "metrics",
    keywords: ["feature adoption", "usage", "events", "adoption", "product"],
    prompt:
      "Comparar adoção de features principais do produto.",
    topology: [
      "trigger_webhook feature events",
      "analytics_store por feature",
      "analytics_compare + chart + table/report",
    ],
    programming: [
      "Agrupar por feature_name ou module",
      "Comparar volume ou adoption count por feature",
    ],
  },
  {
    id: "mrr_by_plan",
    title: "MRR by Plan",
    category: "metrics",
    keywords: ["mrr", "plan", "revenue", "subscription", "stripe", "billing"],
    prompt:
      "Criar dashboard de MRR por plano com alertas e relatório.",
    topology: [
      "trigger_webhook billing events",
      "analytics_store por plano",
      "analytics_compare revenue by plan",
      "viz_metric total + chart + report + alert",
    ],
    programming: [
      "Somar amount/revenue, não contar registros",
      "Mostrar top plan e total",
    ],
  },
  {
    id: "retention_cohort",
    title: "Retention Cohort Snapshot",
    category: "metrics",
    keywords: ["retention", "cohort", "churn", "weekly active", "engagement"],
    prompt:
      "Montar fluxo para retenção por coorte ou por semana.",
    topology: [
      "trigger_webhook usage events",
      "analytics_store cohort snapshots",
      "viz_chart + viz_report + maybe analytics_segment",
    ],
    programming: [
      "Comparar cohorts por signup period",
      "Gerar insight textual no report",
    ],
  },
  {
    id: "support_sla",
    title: "Support SLA Dashboard",
    category: "metrics",
    keywords: ["support", "ticket", "sla", "response time", "help desk"],
    prompt:
      "Criar dashboard de SLA de suporte com alertas.",
    topology: [
      "trigger_webhook support events",
      "analytics_store by queue or priority",
      "analytics_compare response time / breach count",
      "viz_metric + chart + alert",
    ],
    programming: [
      "Priorizar breach count e tempo médio",
      "Alertar em picos de backlog",
    ],
  },
  {
    id: "trial_to_paid",
    title: "Trial to Paid Conversion",
    category: "finance",
    keywords: ["trial", "paid", "conversion", "subscription", "billing"],
    prompt:
      "Acompanhar conversão de trial para paid por origem ou plano.",
    topology: [
      "trigger_webhook billing lifecycle",
      "analytics_store por plano ou origem",
      "analytics_compare or analytics_ab depending on conversion metric",
      "chart/report/metric",
    ],
    programming: [
      "Usar status trialing -> active como conversão",
      "Separar volume de revenue",
    ],
  },
  {
    id: "invoice_overdue",
    title: "Overdue Invoice Control",
    category: "finance",
    keywords: ["invoice", "overdue", "fatura", "cobranca", "receivable"],
    prompt:
      "Controlar invoices em atraso e notificar o time.",
    topology: [
      "trigger_webhook invoice events",
      "action_filter overdue only",
      "analytics_store overdue invoices",
      "viz_metric + viz_table + monitor_alert + action_email",
    ],
    programming: [
      "Filtrar status overdue/past_due",
      "Alertar por valor total ou volume crítico",
    ],
  },
  {
    id: "cashflow_runway",
    title: "Cashflow and Runway",
    category: "finance",
    keywords: ["cashflow", "runway", "expenses", "burn", "financeiro"],
    prompt:
      "Criar painel financeiro com cashflow, burn e runway.",
    topology: [
      "trigger_webhook finance events",
      "analytics_store inflow and outflow",
      "analytics_compare inflow vs outflow",
      "viz_metric burn + chart + report + alert",
    ],
    programming: [
      "Somar amount por tipo de transação",
      "Calcular diferença entre entrada e saída",
    ],
  },
  {
    id: "refund_monitor",
    title: "Refund Monitor",
    category: "finance",
    keywords: ["refund", "chargeback", "reembolso", "payment failure", "billing"],
    prompt:
      "Monitorar reembolsos e chargebacks por plano ou gateway.",
    topology: [
      "trigger_webhook payment events",
      "action_filter refund/chargeback",
      "analytics_store por gateway",
      "analytics_compare + alert + report",
    ],
    programming: [
      "Filtrar somente eventos de refund/chargeback",
      "Comparar volume e valor financeiro por origem",
    ],
  },
  {
    id: "marketing_budget_guardrail",
    title: "Marketing Budget Guardrail",
    category: "finance",
    keywords: ["budget", "ads spend", "cac", "marketing spend", "roi"],
    prompt:
      "Criar fluxo para monitorar gasto de marketing e alertar quando passar do orçamento.",
    topology: [
      "trigger_webhook spend events",
      "analytics_store por canal",
      "analytics_compare spend by channel",
      "viz_metric total spend + chart + alert",
    ],
    programming: [
      "Somar spend real por canal",
      "Alertar por total ou por canal acima do teto",
    ],
  },
  {
    id: "lead_routing",
    title: "Lead Routing Automation",
    category: "automation",
    keywords: ["lead routing", "lead score", "sales", "crm", "automation"],
    prompt:
      "Automatizar roteamento de leads com base em origem e score.",
    topology: [
      "trigger_webhook lead",
      "action_if or action_switch on score/source",
      "analytics_store leads",
      "action_slack / action_email / action_http",
    ],
    programming: [
      "Calcular score ou normalizar origem",
      "Roteamento por regras explícitas",
    ],
  },
  {
    id: "cancellation_recovery",
    title: "Cancellation Recovery",
    category: "automation",
    keywords: ["cancelamento", "cancellation", "recover", "churn", "save offer"],
    prompt:
      "Criar automação para reagir a cancelamentos e acionar ofertas de recuperação.",
    topology: [
      "trigger_webhook subscription cancelled",
      "analytics_store churn events",
      "action_if on plan or reason",
      "action_email + action_slack + report metric",
    ],
    programming: [
      "Usar cancel reason para branches",
      "Medir quantos usuários entraram no fluxo de recuperação",
    ],
  },
  {
    id: "weekly_exec_summary",
    title: "Weekly Executive Summary",
    category: "automation",
    keywords: ["weekly summary", "resumo semanal", "executive", "founder update", "dashboard"],
    prompt:
      "Montar automação semanal com métricas principais e resumo para founders.",
    topology: [
      "trigger_schedule weekly",
      "analytics_store or read collections",
      "viz_metric + viz_report",
      "action_email / action_slack",
    ],
    programming: [
      "Agregar MRR, churn, growth, incidents e pipeline",
      "Preparar insight textual antes de enviar",
    ],
  },
  {
    id: "nps_detractor_alert",
    title: "NPS Detractor Alert",
    category: "automation",
    keywords: ["nps", "detractor", "feedback", "customer success", "survey"],
    prompt:
      "Alertar o time quando clientes detratores responderem pesquisa.",
    topology: [
      "trigger_webhook survey responses",
      "action_filter low score",
      "analytics_store detractors",
      "action_slack + action_email + viz_report",
    ],
    programming: [
      "Filtrar scores baixos e capturar motivo",
      "Gerar contexto curto para follow-up",
    ],
  },
  {
    id: "feedback_triage",
    title: "Feedback Triage",
    category: "automation",
    keywords: ["feedback", "roadmap", "bug report", "feature request", "triage"],
    prompt:
      "Criar fluxo para triar feedbacks entre bug, feature request e praise.",
    topology: [
      "trigger_webhook feedback",
      "action_switch or programmable classification",
      "analytics_store by category",
      "viz_chart + action_slack",
    ],
    programming: [
      "Classificar texto em categorias",
      "Encaminhar para o canal certo por categoria",
    ],
  },
  {
    id: "social_mentions",
    title: "Social Mention Monitor",
    category: "automation",
    keywords: ["social", "mentions", "twitter", "linkedin", "brand", "community"],
    prompt:
      "Monitorar menções da marca e alertar quando o volume disparar.",
    topology: [
      "trigger_webhook mention events",
      "analytics_store by channel",
      "analytics_compare + chart + alert",
    ],
    programming: [
      "Comparar volume por canal",
      "Alertar quando um canal sair da faixa normal",
    ],
  },
];

function scoreExample(example: WorkflowExample, query: string) {
  return example.keywords.reduce((score, keyword) => {
    return score + (query.includes(normalize(keyword)) ? 1 : 0);
  }, 0);
}

export function formatRelevantWorkflowExamples(userMessage: string, limit = 6) {
  const normalizedQuery = normalize(userMessage);
  const ranked = workflowExamples
    .map((example) => ({
      example,
      score: scoreExample(example, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.example);

  const selected = ranked.length
    ? ranked
    : workflowExamples.filter((example) =>
        ["monitoring", "experiments", "marketing", "metrics", "finance", "automation"].includes(
          example.category,
        ),
      ).slice(0, 6);

  return `[Reference workflow examples]\n${selected
    .map(
      (example, index) =>
        `${index + 1}. ${example.title} [${example.category}]\nPrompt: ${example.prompt}\nTopology:\n- ${example.topology.join(
          "\n- ",
        )}\nProgramming hints:\n- ${example.programming.join("\n- ")}`,
    )
    .join("\n\n")}\n\n`;
}
