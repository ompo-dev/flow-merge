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
  { value: "revenue", label: "Revenue" },
  { value: "conversion", label: "Conversion" },
  { value: "users", label: "Users" },
  { value: "errors", label: "Errors" },
  { value: "aov", label: "AOV" },
  { value: "custom", label: "Custom" },
];

const chartTypeOptions: NodeConfigOption[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
  { value: "area", label: "Area" },
];

const refreshRateOptions: NodeConfigOption[] = [
  { value: "Every 15m", label: "Every 15m" },
  { value: "Every 1h", label: "Every 1h" },
  { value: "Every 6h", label: "Every 6h" },
  { value: "Daily", label: "Daily" },
];

const timeRangeOptions: NodeConfigOption[] = [
  { value: "Last 24 hours", label: "Last 24 hours" },
  { value: "Last 7 days", label: "Last 7 days" },
  { value: "Last 14 days", label: "Last 14 days" },
  { value: "Last 30 days", label: "Last 30 days" },
];

const yesNoOptions: NodeConfigOption[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const layoutOptions: NodeConfigOption[] = [
  { value: "4 columns", label: "4 columns" },
  { value: "6 columns", label: "6 columns" },
  { value: "8 columns", label: "8 columns" },
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
    { key: "variant", label: "Metric Type", type: "select", placeholder: "Revenue", options: variantOptions },
    { key: "value", label: "Value", type: "text", placeholder: "$12,450" },
    { key: "trend", label: "Trend", type: "text", placeholder: "+5.2%" },
    { key: "compareLabel", label: "Compare Label", type: "text", placeholder: "vs last period" },
  ],
  viz_chart: [
    { key: "variant", label: "Dataset", type: "select", placeholder: "Revenue", options: variantOptions },
    { key: "chartType", label: "Chart Type", type: "select", placeholder: "Line", options: chartTypeOptions },
    { key: "timeRange", label: "Time Range", type: "select", placeholder: "Last 14 days", options: timeRangeOptions },
    { key: "xAxisLabel", label: "X Axis Label", type: "text", placeholder: "Date" },
    { key: "yAxisLabel", label: "Y Axis Label", type: "text", placeholder: "Value" },
  ],
  viz_table: [
    { key: "variant", label: "Dataset", type: "select", placeholder: "Revenue", options: variantOptions },
    { key: "columns", label: "Columns", type: "text", placeholder: "Name,Count,Value,Change" },
    { key: "sortBy", label: "Sort By", type: "text", placeholder: "Value" },
    { key: "maxRows", label: "Max Rows", type: "number", placeholder: "3" },
  ],
  viz_report: [
    { key: "reportTitle", label: "Report Title", type: "text", placeholder: "Weekly Summary" },
    { key: "refreshRate", label: "Refresh Rate", type: "select", placeholder: "Every 1h", options: refreshRateOptions },
    { key: "includeAiInsight", label: "Include AI Insight", type: "select", placeholder: "Yes", options: yesNoOptions },
    { key: "insight", label: "Insight", type: "textarea", placeholder: "Summarize the main movement in this report..." },
  ],
  viz_funnel: [
    { key: "stage1Label", label: "Stage 1", type: "text", placeholder: "Page View" },
    { key: "stage2Label", label: "Stage 2", type: "text", placeholder: "Sign Up" },
    { key: "stage3Label", label: "Stage 3", type: "text", placeholder: "Activated" },
    { key: "stage4Label", label: "Stage 4", type: "text", placeholder: "Paid" },
  ],
  viz_dashboard: [
    { key: "title", label: "Dashboard Title", type: "text", placeholder: "Operator Dashboard" },
    { key: "layout", label: "Grid Layout", type: "select", placeholder: "6 columns", options: layoutOptions },
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
        xAxisLabel: "Date",
        yAxisLabel: variant === "revenue" ? "Revenue" : "Value",
      };
    case "viz_table":
      return {
        variant,
        columns: "Name,Count,Value,Change",
        sortBy: "Value",
        maxRows: "3",
      };
    case "viz_report":
      return {
        reportTitle: label || "Weekly Summary",
        refreshRate: "Every 1h",
        includeAiInsight: "Yes",
        insight:
          "Cart abandonment is down 3.2% since the checkout redesign. Consider extending the coupon campaign for another week.",
      };
    case "viz_funnel":
      return {
        stage1Label: "Page View",
        stage2Label: "Sign Up",
        stage3Label: "Activated",
        stage4Label: "Paid",
      };
    case "viz_dashboard":
      return {
        title: label || "Operator Dashboard",
        layout: "6 columns",
      };
    default:
      return {};
  }
}
