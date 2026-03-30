import type { NodeTypeId } from "@/lib/node-catalog";
import type { NodeIOSchema, WorkflowNodeData } from "@/lib/flow-types";

export interface NodeConfigOption {
  value: string;
  label: string;
}

export interface NodeConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  placeholder: string;
  options?: NodeConfigOption[];
}

const variantOptions: NodeConfigOption[] = [
  { value: "revenue", label: "Receita" },
  { value: "conversion", label: "Conversão" },
  { value: "users", label: "Usuários" },
  { value: "errors", label: "Erros" },
  { value: "aov", label: "AOV" },
  { value: "custom", label: "Customizado" },
];

const chartTypeOptions: NodeConfigOption[] = [
  { value: "line", label: "Linha" },
  { value: "bar", label: "Barras" },
  { value: "area", label: "Área" },
];

const refreshRateOptions: NodeConfigOption[] = [
  { value: "Every 15m", label: "A cada 15 min" },
  { value: "Every 1h", label: "A cada 1h" },
  { value: "Every 6h", label: "A cada 6h" },
  { value: "Daily", label: "Diário" },
];

const timeRangeOptions: NodeConfigOption[] = [
  { value: "Last 24 hours", label: "Últimas 24 horas" },
  { value: "Last 7 days", label: "Últimos 7 dias" },
  { value: "Last 14 days", label: "Últimos 14 dias" },
  { value: "Last 30 days", label: "Últimos 30 dias" },
];

const yesNoOptions: NodeConfigOption[] = [
  { value: "Yes", label: "Sim" },
  { value: "No", label: "Não" },
];

const layoutOptions: NodeConfigOption[] = [
  { value: "4 columns", label: "4 colunas" },
  { value: "6 columns", label: "6 colunas" },
  { value: "8 columns", label: "8 colunas" },
];

const triggerSchema: NodeIOSchema = {
  output: {
    type: "object",
    description: "Trigger event payload",
    properties: {
      event: { type: "object", description: "Incoming event payload" },
      timestamp: { type: "string", description: "ISO timestamp" },
      source: { type: "string", description: "Source identifier" },
    },
  },
};

const actionSchema: NodeIOSchema = {
  input: {
    type: "object",
    properties: {
      data: { type: "object", description: "Input payload" },
      context: { type: "object", description: "Workflow context" },
    },
  },
  output: {
    type: "object",
    properties: {
      result: { type: "object", description: "Processed output" },
      status: { type: "number", description: "Execution status code" },
      error: { type: "string", description: "Error details when present" },
    },
  },
};

const vizSchemas: Partial<Record<NodeTypeId, NodeIOSchema>> = {
  viz_metric: {
    input: {
      type: "object",
      properties: {
        value: { type: "string", description: "Rendered KPI value" },
        trend: { type: "string", description: "Period-over-period delta" },
        compareLabel: { type: "string", description: "Comparison caption" },
        variant: { type: "string", description: "Revenue, users, errors, etc" },
      },
    },
  },
  viz_chart: {
    input: {
      type: "object",
      properties: {
        chartType: { type: "string", description: "line | bar | area" },
        timeRange: { type: "string", description: "Visible time range" },
        xAxisLabel: { type: "string", description: "X axis label" },
        yAxisLabel: { type: "string", description: "Y axis label" },
        variant: { type: "string", description: "Rendered dataset family" },
      },
    },
  },
  viz_table: {
    input: {
      type: "object",
      properties: {
        columns: { type: "string", description: "Comma-separated column labels" },
        sortBy: { type: "string", description: "Primary sort key" },
        maxRows: { type: "number", description: "Max visible rows" },
        variant: { type: "string", description: "Dataset flavor" },
      },
    },
  },
  viz_report: {
    input: {
      type: "object",
      properties: {
        reportTitle: { type: "string", description: "Panel title inside the report" },
        refreshRate: { type: "string", description: "Refresh cadence" },
        includeAiInsight: { type: "boolean", description: "Whether to show AI insight" },
        insight: { type: "string", description: "Narrative summary" },
      },
    },
  },
  viz_funnel: {
    input: {
      type: "object",
      properties: {
        stage1Label: { type: "string", description: "Top funnel stage label" },
        stage2Label: { type: "string", description: "Second stage label" },
        stage3Label: { type: "string", description: "Third stage label" },
        stage4Label: { type: "string", description: "Final stage label" },
      },
    },
  },
  viz_dashboard: {
    input: {
      type: "object",
      properties: {
        title: { type: "string", description: "Dashboard title" },
        layout: { type: "string", description: "Grid column layout" },
        widgets: { type: "array", description: "Widget layout definitions" },
      },
    },
  },
};

export const nodeConfigFields: Partial<Record<NodeTypeId, NodeConfigField[]>> = {
  viz_metric: [
    { key: "variant", label: "Tipo de Métrica", type: "select", placeholder: "Receita", options: variantOptions },
    { key: "value", label: "Valor", type: "text", placeholder: "$12,450" },
    { key: "trend", label: "Tendência", type: "text", placeholder: "+5.2%" },
    { key: "compareLabel", label: "Rótulo de Comparação", type: "text", placeholder: "vs período anterior" },
  ],
  viz_chart: [
    { key: "variant", label: "Dataset", type: "select", placeholder: "Receita", options: variantOptions },
    { key: "chartType", label: "Tipo de Gráfico", type: "select", placeholder: "Linha", options: chartTypeOptions },
    { key: "timeRange", label: "Janela de Tempo", type: "select", placeholder: "Últimos 14 dias", options: timeRangeOptions },
    { key: "xAxisLabel", label: "Rótulo do Eixo X", type: "text", placeholder: "Data" },
    { key: "yAxisLabel", label: "Rótulo do Eixo Y", type: "text", placeholder: "Valor" },
  ],
  viz_table: [
    { key: "variant", label: "Dataset", type: "select", placeholder: "Receita", options: variantOptions },
    { key: "columns", label: "Colunas", type: "text", placeholder: "Nome,Contagem,Valor,Variação" },
    { key: "sortBy", label: "Ordenar por", type: "text", placeholder: "Valor" },
    { key: "maxRows", label: "Máximo de Linhas", type: "number", placeholder: "3" },
  ],
  viz_report: [
    { key: "reportTitle", label: "Título do Relatório", type: "text", placeholder: "Resumo semanal" },
    { key: "refreshRate", label: "Frequência de Atualização", type: "select", placeholder: "A cada 1h", options: refreshRateOptions },
    { key: "includeAiInsight", label: "Incluir Insight de IA", type: "select", placeholder: "Sim", options: yesNoOptions },
    { key: "insight", label: "Insight", type: "textarea", placeholder: "Resuma o principal movimento deste relatório..." },
  ],
  viz_funnel: [
    { key: "stage1Label", label: "Etapa 1", type: "text", placeholder: "Visualização de Página" },
    { key: "stage2Label", label: "Etapa 2", type: "text", placeholder: "Cadastro" },
    { key: "stage3Label", label: "Etapa 3", type: "text", placeholder: "Ativado" },
    { key: "stage4Label", label: "Etapa 4", type: "text", placeholder: "Pago" },
  ],
  viz_dashboard: [
    { key: "title", label: "Título do Dashboard", type: "text", placeholder: "Dashboard Operacional" },
    { key: "layout", label: "Layout da Grade", type: "select", placeholder: "6 colunas", options: layoutOptions },
  ],
};

const metricDefaults: Record<string, Record<string, unknown>> = {
  revenue: {
    variant: "revenue",
    value: "$12,450",
    trend: "+5.2%",
    compareLabel: "vs last period",
  },
  conversion: {
    variant: "conversion",
    value: "3.2%",
    trend: "+0.8%",
    compareLabel: "vs last period",
  },
  users: {
    variant: "users",
    value: "1,247",
    trend: "+12%",
    compareLabel: "vs last period",
  },
  errors: {
    variant: "errors",
    value: "0.18%",
    trend: "-0.04%",
    compareLabel: "vs last period",
  },
  aov: {
    variant: "aov",
    value: "$89",
    trend: "+3.1%",
    compareLabel: "vs last period",
  },
  custom: {
    variant: "custom",
    value: "42",
    trend: "+6.4%",
    compareLabel: "vs last period",
  },
};

export function getNodeSchema(nodeType: NodeTypeId): NodeIOSchema | undefined {
  if (nodeType.startsWith("trigger_")) return triggerSchema;
  if (nodeType.startsWith("action_")) return actionSchema;
  if (nodeType.startsWith("analytics_")) return actionSchema;
  if (nodeType.startsWith("monitor_")) return actionSchema;
  return vizSchemas[nodeType];
}

export function getNodeConfigFields(nodeType: NodeTypeId): NodeConfigField[] {
  return nodeConfigFields[nodeType] ?? [];
}

export function getDefaultNodeConfig(
  nodeType: NodeTypeId,
  overrides: Partial<WorkflowNodeData> = {},
): Record<string, unknown> {
  const variant = String(overrides.vizVariant ?? "revenue");
  const chartType = String(overrides.chartType ?? "line");
  const label = String(overrides.label ?? "");

  switch (nodeType) {
    case "viz_metric":
      return metricDefaults[variant] ?? metricDefaults.custom;
    case "viz_chart":
      return {
        variant,
        chartType,
        timeRange: "Last 14 days",
        xAxisLabel: "Data",
        yAxisLabel: variant === "revenue" ? "Receita" : "Valor",
      };
    case "viz_table":
      return {
        variant,
        columns: "Nome,Contagem,Valor,Variação",
        sortBy: "Valor",
        maxRows: "3",
      };
    case "viz_report":
      return {
        reportTitle: label || "Resumo semanal",
        refreshRate: "Every 1h",
        includeAiInsight: "Yes",
        insight:
          "O abandono de carrinho caiu 3,2% desde o redesign do checkout. Considere estender a campanha de cupom por mais uma semana.",
      };
    case "viz_funnel":
      return {
        stage1Label: "Visualização de Página",
        stage2Label: "Cadastro",
        stage3Label: "Ativado",
        stage4Label: "Pago",
      };
    case "viz_dashboard":
      return {
        title: label || "Dashboard Operacional",
        layout: "6 columns",
      };
    default:
      return {};
  }
}
