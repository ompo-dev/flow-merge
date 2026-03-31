import type { NodeProgrammingConfig, WorkflowNodeData } from "@/lib/flow-types";
import type { NodeTypeId } from "@/lib/node-catalog";

export interface NodePreset {
  id: string;
  title: string;
  description: string;
  recommended?: boolean;
  label?: string;
  parameters?: Record<string, string>;
  config?: Record<string, unknown>;
  programmable?: Partial<NodeProgrammingConfig>;
}

const nodePresets: Partial<Record<NodeTypeId, NodePreset[]>> = {
  trigger_webhook: [
    {
      id: "webhook-events",
      title: "Capturar eventos do app",
      description: "Ideal para analytics de produto, funis e comportamento do usuário.",
      recommended: true,
      parameters: {
        "HTTP Method": "POST",
        Path: "/events/ingest",
        Authentication: "Secret Token",
      },
    },
    {
      id: "webhook-purchase",
      title: "Capturar compras",
      description: "Pronto para rastrear receita, monitorar checkout e testes A/B.",
      parameters: {
        "HTTP Method": "POST",
        Path: "/events/purchase",
        Authentication: "Secret Token",
      },
    },
    {
      id: "webhook-errors",
      title: "Capturar erros",
      description: "Use quando seu app precisar enviar erros de frontend ou backend.",
      parameters: {
        "HTTP Method": "POST",
        Path: "/events/errors",
        Authentication: "Secret Token",
      },
    },
  ],
  trigger_schedule: [
    {
      id: "schedule-hourly",
      title: "Executar a cada hora",
      description: "Bom para monitoramento, sincronização e health checks.",
      recommended: true,
      parameters: {
        "Trigger Interval": "Every hour",
        Timezone: "America/Sao_Paulo",
      },
    },
    {
      id: "schedule-daily",
      title: "Executar relatório diário",
      description: "Melhor para resumos diários e visões executivas.",
      parameters: {
        "Trigger Interval": "Every day",
        Timezone: "America/Sao_Paulo",
      },
    },
  ],
  action_if: [
    {
      id: "if-converted",
      title: "Verificar se converteu",
      description: "Envia usuários por caminhos diferentes com base no resultado da conversão.",
      recommended: true,
      parameters: {
        "Value 1": "{{ input.first.converted }}",
        Operation: "equals",
        "Value 2": "true",
      },
    },
    {
      id: "if-threshold",
      title: "Verificar limite",
      description: "Útil para alertas, limites de MRR e detecção de anomalias.",
      parameters: {
        "Value 1": "{{ input.first.value }}",
        Operation: "greater than",
        "Value 2": "100",
      },
    },
    {
      id: "if-winner",
      title: "Verificar se existe vencedor",
      description: "Passo comum depois da análise A/B antes de notificar o time.",
      parameters: {
        "Value 1": "{{ input.first.winner }}",
        Operation: "not equals",
        "Value 2": "insufficient_sample",
      },
    },
  ],
  action_switch: [
    {
      id: "switch-variant",
      title: "Rotear por variante",
      description: "Perfeito para testes A/B/C com saídas separadas por variação.",
      recommended: true,
      parameters: {
        Value: "{{ input.first.variant }}",
        Operation: "equals",
        "Case 1": "variant_a",
        "Case 2": "variant_b",
        "Case 3": "variant_c",
      },
    },
    {
      id: "switch-event",
      title: "Rotear por nome do evento",
      description: "Envia signup, checkout e compra para ramos diferentes.",
      parameters: {
        Value: "{{ input.first.event }}",
        Operation: "equals",
        "Case 1": "signup",
        "Case 2": "checkout_started",
        "Case 3": "purchase_completed",
      },
    },
  ],
  analytics_store: [
    {
      id: "store-events",
      title: "Salvar eventos brutos",
      description: "Mantém um histórico local de eventos para relatórios e dashboards.",
      recommended: true,
      parameters: {
        "Store Name": "events_store",
        "TTL (days)": "90",
      },
    },
    {
      id: "store-ab",
      title: "Salvar eventos de variantes A/B",
      description: "Bom para experimentos, split tests e análise de vencedor.",
      parameters: {
        "Store Name": "ab_experiment",
        "TTL (days)": "30",
      },
    },
    {
      id: "store-errors",
      title: "Salvar erros",
      description: "Útil para tendência de bugs, revisão de logs e alertas.",
      parameters: {
        "Store Name": "error_events",
        "TTL (days)": "14",
      },
    },
  ],
  analytics_ab: [
    {
      id: "ab-three-variants",
      title: "Comparar 3 variantes",
      description: "Mede conversão e receita entre experimentos A/B/C.",
      recommended: true,
      parameters: {
        "Store Names": "ab_variant_a,ab_variant_b,ab_variant_c",
        "Variant Field": "variant",
        "Conversion Field": "converted",
        "Revenue Field": "amount",
        Significance: "95%",
        "Minimum Sample": "100",
      },
    },
    {
      id: "ab-pricing",
      title: "Teste da página de preço",
      description: "Padrões otimizados para experimentos de preço ou checkout.",
      parameters: {
        "Store Names": "pricing_control,pricing_variant_b,pricing_variant_c",
        "Variant Field": "variant",
        "Conversion Field": "purchased",
        "Revenue Field": "amount",
        Significance: "95%",
        "Minimum Sample": "250",
      },
    },
  ],
  action_openai: [
    {
      id: "ai-summary",
      title: "Resumir o que aconteceu",
      description: "Transforma métricas brutas em uma explicação curta e humana.",
      recommended: true,
      parameters: {
        Model: "gpt-4o-mini",
        Prompt:
          "Resuma o principal movimento destes dados, explique o que mudou e sugira a próxima ação.",
      },
    },
    {
      id: "ai-winner",
      title: "Explicar vencedor do experimento",
      description: "Útil depois da análise A/B para explicar por que uma variante venceu.",
      parameters: {
        Model: "gpt-4o-mini",
        Prompt:
          "Explique qual variante está vencendo, por que isso importa e o que o time deve fazer em seguida.",
      },
    },
  ],
  action_terminal: [
    {
      id: "terminal-bugfix-agent",
      title: "Agente CLI para corrigir bug",
      description:
        "Dispara um agente local como Claude Code, Codex CLI ou Gemini CLI e espera uma linha final com 'Terminei'.",
      recommended: true,
      parameters: {
         Shell: "cmd",
        "Session Key": "bug-fixer",
        "Timeout Seconds": "1800",
        "Success Pattern Mode": "contains",
        "Success Pattern": "Terminei",
        "Reuse Session": "Yes",
        "Close Session After Run": "No",
        Command:
          "claude-code \"investigue {{ input.first.message }} e quando terminar diga Terminei {descricao do problema}\"",
      },
    },
    {
      id: "terminal-local-script",
      title: "Rodar script local",
      description:
        "Executa um comando local e segue o fluxo quando o shell voltar ao prompt.",
      parameters: {
         Shell: "cmd",
        "Timeout Seconds": "600",
        "Success Pattern Mode": "none",
        "Reuse Session": "Yes",
        "Close Session After Run": "No",
        Command: "bun run lint",
      },
    },
  ],
  monitor_alert: [
    {
      id: "alert-slack",
      title: "Alertar no Slack",
      description: "Forma mais rápida de notificar o time de growth ou operações.",
      recommended: true,
      parameters: {
        Threshold: "0.05",
        Field: "{{ input.first.error_rate }}",
        Channel: "Slack",
      },
    },
    {
      id: "alert-email",
      title: "Alertar por email",
      description: "Bom para founders ou stakeholders que vivem na caixa de entrada.",
      parameters: {
        Threshold: "0.05",
        Field: "{{ input.first.error_rate }}",
        Channel: "Email",
      },
    },
  ],
  viz_chart: [
    {
      id: "chart-revenue",
      title: "Receita ao longo do tempo",
      description: "Gráfico de linha clássico para MRR, vendas e receita recorrente.",
      recommended: true,
      parameters: {
        "Chart Type": "Line",
        "X Axis": "{{ input.first.date }}",
        "Y Axis": "{{ input.first.revenue }}",
      },
      config: {
        variant: "revenue",
        chartType: "line",
        xAxisLabel: "Date",
        yAxisLabel: "Revenue",
      },
    },
    {
      id: "chart-ab-conversion",
      title: "Barras de conversão A/B/C",
      description: "Melhor padrão para comparação de experimento entre variantes.",
      parameters: {
        "Chart Type": "Bar",
        "X Axis": "{{ input.first.variant }}",
        "Y Axis": "{{ input.first.conversionRate }}",
      },
      config: {
        variant: "conversion",
        chartType: "bar",
        xAxisLabel: "Variant",
        yAxisLabel: "Conversion %",
      },
    },
  ],
  viz_report: [
    {
      id: "report-weekly",
      title: "Resumo semanal",
      description: "Relatório curto para revisar produto, growth e receita.",
      recommended: true,
      parameters: {
        Title: "Weekly Summary",
        Refresh: "Every 1h",
      },
      config: {
        reportTitle: "Resumo semanal",
        refreshRate: "Every 1h",
        includeAiInsight: "Yes",
      },
    },
    {
      id: "report-winner",
      title: "Relatório do vencedor",
      description: "Relatório focado nos resultados do teste A/B.",
      parameters: {
        Title: "Variant Winner Report",
        Refresh: "Every 1h",
      },
      config: {
        reportTitle: "Variant Winner Report",
        refreshRate: "Every 1h",
        includeAiInsight: "Yes",
      },
    },
  ],
  action_slack: [
    {
      id: "slack-growth",
      title: "Notificar time de growth",
      description: "Envia mudanças importantes direto para um canal do Slack.",
      recommended: true,
      parameters: {
        Channel: "#growth",
        Message: "Uma métrica mudou e precisa da sua atenção.",
      },
    },
  ],
  action_email: [
    {
      id: "email-team",
      title: "Enviar email para o time",
      description: "Envia um relatório curto ou alerta para uma lista de distribuição.",
      recommended: true,
      parameters: {
        Subject: "Relatório do Flow Merge",
        Message: "Um workflow terminou e gerou um novo resumo.",
      },
    },
  ],
};

export function getNodePresets(nodeType: NodeTypeId): NodePreset[] {
  return nodePresets[nodeType] ?? [];
}

export function applyNodePreset(
  current: WorkflowNodeData,
  preset: NodePreset,
): Partial<WorkflowNodeData> {
  return {
    label: preset.label ?? current.label,
    parameters: {
      ...(current.parameters ?? {}),
      ...(preset.parameters ?? {}),
    },
    config: {
      ...(current.config ?? {}),
      ...(preset.config ?? {}),
    },
  };
}
