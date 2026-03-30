"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AppNode } from "@/lib/flow-types";
import { coerceTextValue } from "@/components/nodes/SharedNodeComponents";
import { getNodeSemanticState } from "@/lib/workflow-intelligence";
import { useActiveWorkflow } from "@/store/useFlowStore";

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) & 0xffffffff;
    return (value >>> 0) / 0xffffffff;
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function makeSeries(seed: number, points = 14, min = 0, max = 100) {
  const random = seededRandom(seed);
  let current = min + (max - min) * 0.35;
  return Array.from({ length: points }, () => {
    current += (random() - 0.48) * (max - min) * 0.18;
    current = Math.max(min, Math.min(max, current));
    return current;
  });
}

function Sparkline({
  data,
  color,
  height = 40,
  width = 120,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map(
      (value, index) =>
        `${index * step},${height - ((value - min) / range) * (height - 2) - 1}`,
    )
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      <polyline
        points={`0,${height} ${points} ${(data.length - 1) * step},${height}`}
        fill={color}
        fillOpacity={0.08}
      />
    </svg>
  );
}

type ChartSeriesEntry = {
  label: string;
  value: number;
};

const BAR_PALETTE = [
  "#3fb950",
  "#1f6feb",
  "#d29922",
  "#f85149",
  "#a371f7",
  "#58a6ff",
];

function formatChartPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
}

function formatChartNumber(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString();
  }

  return value.toFixed(value % 1 === 0 ? 0 : 2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function inferChartValueMode(variant: string, yAxisLabel: string) {
  const normalizedAxis = yAxisLabel.trim().toLowerCase();

  if (variant === "conversion" || normalizedAxis.includes("%") || normalizedAxis.includes("percent")) {
    return "percent" as const;
  }

  if (
    variant === "revenue" ||
    normalizedAxis.includes("revenue") ||
    normalizedAxis.includes("receita") ||
    normalizedAxis.includes("currency") ||
    normalizedAxis.includes("money")
  ) {
    return "currency" as const;
  }

  return "number" as const;
}

function formatChartValue(value: number, mode: "percent" | "currency" | "number") {
  if (mode === "percent") return formatChartPercent(value);
  if (mode === "currency") return `$${formatChartNumber(value)}`;
  return formatChartNumber(value);
}

function getSeriesColor(index: number, fallback: string) {
  return BAR_PALETTE[index] ?? fallback;
}

function ComparisonBarChart({
  series,
  fallbackColor,
  valueMode,
  height = 120,
  width = 292,
}: {
  series: ChartSeriesEntry[];
  fallbackColor: string;
  valueMode: "percent" | "currency" | "number";
  height?: number;
  width?: number;
}) {
  const safeSeries = series.length ? series : [{ label: "Item 1", value: 0 }];
  const max = Math.max(...safeSeries.map((entry) => entry.value), 1);
  const gap = 10;
  const sidePadding = 10;
  const innerWidth = width - sidePadding * 2;
  const slotWidth = innerWidth / safeSeries.length;
  const barWidth = Math.max(16, Math.min(slotWidth - gap, 40));
  const usableHeight = height - 26;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      <line
        x1={sidePadding}
        y1={height - 18}
        x2={width - sidePadding}
        y2={height - 18}
        stroke="#30363d"
        strokeWidth={1}
      />
      {safeSeries.map((entry, index) => {
        const ratio = Math.max(0, entry.value) / max;
        const barHeight = Math.max(6, ratio * usableHeight);
        const x = sidePadding + index * slotWidth + (slotWidth - barWidth) / 2;
        const y = height - 18 - barHeight;
        const entryColor = getSeriesColor(index, fallbackColor);
        const shortLabel =
          entry.label.length > 10 ? `${entry.label.slice(0, 9)}…` : entry.label;

        return (
          <g key={`${entry.label}-${index}`}>
            <text
              x={x + barWidth / 2}
              y={Math.max(12, y - 6)}
              fill="#e6edf3"
              fontSize="10"
              fontWeight="600"
              textAnchor="middle"
            >
              {formatChartValue(entry.value, valueMode)}
            </text>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={entryColor}
              fillOpacity={0.82}
              rx={4}
            />
            <text
              x={x + barWidth / 2}
              y={height - 4}
              fill="#7d8590"
              fontSize="9"
              textAnchor="middle"
            >
              {shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AreaChart({
  dataA,
  dataB,
  colorA,
  colorB,
  height = 80,
  width = 280,
}: {
  dataA: number[];
  dataB?: number[];
  colorA: string;
  colorB?: string;
  height?: number;
  width?: number;
}) {
  const all = [...dataA, ...(dataB ?? [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const step = width / (dataA.length - 1);
  const points = (series: number[]) =>
    series
      .map(
        (value, index) =>
          `${index * step},${height - ((value - min) / range) * (height - 4) - 2}`,
      )
      .join(" ");
  const fill = (series: number[]) =>
    `0,${height} ${points(series)} ${(series.length - 1) * step},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {dataB ? <polyline points={fill(dataB)} fill={colorB} fillOpacity={0.12} /> : null}
      {dataB ? (
        <polyline
          points={points(dataB)}
          fill="none"
          stroke={colorB}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      ) : null}
      <polyline points={fill(dataA)} fill={colorA} fillOpacity={0.12} />
      <polyline points={points(dataA)} fill="none" stroke={colorA} strokeWidth={1.5} />
    </svg>
  );
}

function FunnelBars({
  stages,
  color,
}: {
  stages: Array<{ label: string; value: number }>;
  color: string;
}) {
  const max = stages[0]?.value || 1;
  return (
    <div className="flex flex-col gap-2">
      {stages.map((stage) => {
        const percentage = (stage.value / max) * 100;
        return (
          <div key={stage.label}>
            <div className="mb-1 flex items-center justify-between text-[10px] text-[#7d8590]">
              <span>{stage.label}</span>
              <span className="font-mono">{stage.value.toLocaleString()}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded bg-[#21262d]">
              <div
                className="h-full rounded"
                style={{ width: `${percentage}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const reportRows = [
  { label: "Total Revenue", value: "$127,948", delta: "+14.2%", positive: true },
  { label: "New Users", value: "2,341", delta: "+8.7%", positive: true },
  { label: "Churn Rate", value: "1.3%", delta: "-0.4%", positive: true },
  { label: "Support Tickets", value: "89", delta: "+12", positive: false },
];

function variantColor(variant: string) {
  if (variant === "errors") return "#f85149";
  if (variant === "conversion") return "#3fb950";
  return "#1f6feb";
}

function estimateTableColumnWidths(columns: string[], rows: string[][]) {
  return columns.map((column, columnIndex) => {
    const longestCell = rows.reduce((maxLength, row) => {
      const cell = String(row[columnIndex] ?? "");
      return Math.max(maxLength, cell.length);
    }, column.length);

    return Math.min(Math.max(longestCell * 7 + 34, 120), 420);
  });
}

function estimateTableWidth(columnWidths: number[]) {
  return Math.max(360, columnWidths.reduce((total, width) => total + width, 0) + 2);
}

function VizNodeComponent({ id, data, selected }: NodeProps<AppNode>) {
  const activeWorkflow = useActiveWorkflow();
  const semanticState = useMemo(
    () => (activeWorkflow ? getNodeSemanticState(activeWorkflow, id) : null),
    [activeWorkflow, id],
  );
  const seed = hashString(id);
  const config = (data.config ?? {}) as Record<string, unknown>;
  const variant = String(config.variant ?? data.vizVariant ?? "revenue");
  const color = variantColor(variant);
  const runtime = data.runtime;

  const panelStyle: React.CSSProperties = {
    background: "#161b22",
    border: `1px solid ${selected ? "#1f6feb" : "#30363d"}`,
    borderRadius: 10,
    overflow: "hidden",
    cursor: "pointer",
    opacity: data.disabled || semanticState?.autoBlocked ? 0.45 : 1,
  };

  const header = (
    <div className="flex items-center justify-between border-b border-[#21262d] px-3 py-2">
      <span className="text-xs font-semibold text-[#e6edf3]">
        {coerceTextValue(data.label, "Untitled node")}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color }}>
        {data.disabled ? "off" : semanticState?.autoBlocked ? "bloq" : "ativo"}
      </span>
    </div>
  );

  if (data.nodeType === "viz_metric") {
    const random = seededRandom(seed);
    const fallbackValue =
      variant === "revenue"
        ? `$${(random() * 80000 + 20000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
        : variant === "conversion"
          ? `${(random() * 14 + 3).toFixed(1)}%`
          : `${Math.floor(random() * 8000 + 1000).toLocaleString()}`;
    const fallbackTrend =
      variant === "errors"
        ? `-${(random() * 0.5 + 0.1).toFixed(2)}%`
        : `+${(random() * 8 + 1.5).toFixed(1)}%`;
    const value = coerceTextValue(config.value, fallbackValue);
    const trend = coerceTextValue(config.trend, fallbackTrend);
    const compareLabel = coerceTextValue(config.compareLabel, "vs last period");

    return (
      <div style={{ ...panelStyle, width: 220 }}>
        <Handle id="left-target" type="target" position={Position.Left} />
        <Handle id="top-target" type="target" position={Position.Top} />
        {header}
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">{variant}</div>
          <div className="mt-1 text-[28px] font-semibold leading-none text-[#e6edf3]">
            {value}
          </div>
          <div
            className="mt-1 text-[11px] font-medium"
            style={{ color: trend.startsWith("+") ? "#3fb950" : "#f85149" }}
          >
            {trend} {compareLabel}
          </div>
          {runtime?.summary ? (
            <div className="mt-2 text-[10px] leading-relaxed text-[#7d8590]">{runtime.summary}</div>
          ) : null}
          <div className="mt-3">
            <Sparkline
              data={makeSeries(seed, 14, 10, 100)}
              color={color}
              width={188}
              height={36}
            />
          </div>
        </div>
        <Handle id="right-source" type="source" position={Position.Right} />
        <Handle id="bottom-source" type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (data.nodeType === "viz_chart") {
    const configuredSeries = Array.isArray(config.series)
      ? (config.series as Array<{ label?: string; value?: number }>)
          .map((entry, index) => ({
            label:
              typeof entry.label === "string" && entry.label.trim()
                ? entry.label.trim()
                : `Item ${index + 1}`,
            value: typeof entry.value === "number" ? entry.value : index + 1,
          }))
          .filter((entry) => Number.isFinite(entry.value))
      : [];
    const defaultSeries: ChartSeriesEntry[] = [
      { label: "Variant A", value: 4.2 },
      { label: "Variant B", value: 5.8 },
      { label: "Variant C", value: 3.9 },
    ];
    const barSeries = configuredSeries.length ? configuredSeries : defaultSeries;
    const seriesA = configuredSeries.length
      ? configuredSeries.map((entry) => entry.value)
      : makeSeries(seed, 14, 10, 100);
    const seriesB = makeSeries(seed + 7, seriesA.length || 14, 10, 100);
    const chartType = String(config.chartType ?? data.chartType ?? "line");
    const timeRange = coerceTextValue(config.timeRange, "Last 14 days");
    const xAxisLabel = coerceTextValue(config.xAxisLabel, chartType === "bar" ? "Items" : "Date");
    const yAxisLabel = coerceTextValue(config.yAxisLabel, "Value");
    const valueMode = inferChartValueMode(variant, yAxisLabel);

    return (
      <div style={{ ...panelStyle, width: 320 }}>
        <Handle id="left-target" type="target" position={Position.Left} />
        <Handle id="top-target" type="target" position={Position.Top} />
        {header}
        <div className="px-3 py-3">
          {chartType === "bar" ? (
            <div>
              <ComparisonBarChart
                series={barSeries}
                fallbackColor={color}
                valueMode={valueMode}
                width={292}
                height={120}
              />
              <div className="mt-3 space-y-2">
                {barSeries.map((entry, index) => {
                  const entryColor = getSeriesColor(index, color);
                  return (
                    <div
                      key={`${entry.label}-${index}`}
                      className="flex items-center justify-between rounded border border-[#21262d] bg-[#0d1117] px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: entryColor }}
                        />
                        <span className="truncate text-[11px] text-[#e6edf3]">{entry.label}</span>
                      </div>
                      <span className="text-[11px] font-medium text-[#7ee787]">
                        {formatChartValue(entry.value, valueMode)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : chartType === "area" ? (
            <AreaChart
              dataA={seriesA}
              dataB={seriesB}
              colorA="#f85149"
              colorB="#1f6feb"
              width={292}
              height={86}
            />
          ) : (
            <AreaChart dataA={seriesA} colorA={color} width={292} height={86} />
          )}
          <div className="mt-2 flex justify-between text-[10px] text-[#7d8590]">
            <span>{chartType === "bar" ? `${barSeries.length} item(s)` : timeRange}</span>
            <span>{chartType === "bar" ? yAxisLabel : xAxisLabel}</span>
          </div>
        </div>
        <Handle id="right-source" type="source" position={Position.Right} />
        <Handle id="bottom-source" type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (data.nodeType === "viz_table") {
    const columns = String(config.columns ?? "Name,Count,Value,Change")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    const maxRows = Number(config.maxRows ?? 3);
    const configuredRows = Array.isArray(config.rows)
      ? (config.rows as Array<Record<string, unknown>>)
      : null;
    const fallbackRows =
      variant === "errors"
        ? [
            ["5xx Server", "23", "0.18%", "High"],
            ["Timeout", "11", "0.08%", "Med"],
            ["Auth Failure", "44", "0.33%", "Med"],
          ]
        : [
            ["Pro Plan", "1,247", "$48,293", "+12.3%"],
            ["Starter", "3,891", "$19,455", "+4.1%"],
            ["Enterprise", "83", "$83,000", "+28.6%"],
          ];
    const tableRows = (
      configuredRows
        ? configuredRows
            .slice(0, Number.isNaN(maxRows) ? 3 : maxRows)
            .map((row) => columns.map((column) => String(row[column] ?? "")))
        : fallbackRows.slice(0, Number.isNaN(maxRows) ? 3 : maxRows)
    ) as string[][];
    const columnWidths = estimateTableColumnWidths(columns, tableRows);
    const tableWidth = estimateTableWidth(columnWidths);

    return (
      <div style={{ ...panelStyle, width: tableWidth, maxWidth: "none" }}>
        <Handle id="left-target" type="target" position={Position.Left} />
        <Handle id="top-target" type="target" position={Position.Top} />
        {header}
        <table
          className="border-collapse text-left text-[11px]"
          style={{ width: tableWidth, tableLayout: "auto" }}
        >
          <thead>
            <tr className="border-b border-[#21262d]">
              {columns.map((column, columnIndex) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#7d8590]"
                  style={{ minWidth: columnWidths[columnIndex] }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rowIndex) => (
              <tr
                key={`${row[0]}-${rowIndex}`}
                className={rowIndex % 2 === 0 ? "" : "bg-[#0d1117]"}
              >
                {columns.map((column, cellIndex) => (
                  <td
                    key={`${column}-${cellIndex}`}
                    className="px-3 py-2 text-[#e6edf3]"
                    style={{ minWidth: columnWidths[cellIndex] }}
                  >
                    {row[cellIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <Handle id="right-source" type="source" position={Position.Right} />
        <Handle id="bottom-source" type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (data.nodeType === "viz_report") {
    const reportTitle = coerceTextValue(config.reportTitle, coerceTextValue(data.label, "Report"));
    const includeAiInsight = String(config.includeAiInsight ?? "Yes") !== "No";
    const insight = coerceTextValue(
      config.insight,
      "Cart abandonment is down 3.2% since the checkout redesign. Consider extending the coupon campaign for another week.",
    );
    const reportItems =
      Array.isArray(config.reportItems) && config.reportItems.length
        ? (config.reportItems as Array<{
            label: string;
            value: string;
            delta: string;
            positive: boolean;
          }>)
        : reportRows;

    return (
      <div style={{ ...panelStyle, width: 300 }}>
        <Handle id="left-target" type="target" position={Position.Left} />
        <Handle id="top-target" type="target" position={Position.Top} />
        {header}
        <div className="flex flex-col gap-2 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
            {reportTitle}
          </div>
          {reportItems.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded border border-[#21262d] bg-[#0d1117] px-3 py-2"
            >
              <span className="text-[11px] text-[#7d8590]">{row.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-[#e6edf3]">{row.value}</span>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: row.positive ? "#3fb950" : "#f85149" }}
                >
                  {row.delta}
                </span>
              </div>
            </div>
          ))}
          {includeAiInsight ? (
            <div className="rounded border border-[#1f6feb33] bg-[#0c1a2e] px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#58a6ff]">
                AI Insight
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">{insight}</p>
            </div>
          ) : null}
        </div>
        <Handle id="right-source" type="source" position={Position.Right} />
        <Handle id="bottom-source" type="source" position={Position.Bottom} />
      </div>
    );
  }

  const random = seededRandom(seed);
  const configuredStages =
    Array.isArray(config.stages) && config.stages.length
      ? (config.stages as Array<{ label: string; value: number }>)
      : null;
  const stage1 = Math.floor(random() * 38000 + 18000);
  const stage2 = Math.floor(stage1 * (random() * 0.16 + 0.08));
  const stage3 = Math.floor(stage2 * (random() * 0.45 + 0.35));
  const stage4 = Math.floor(stage3 * (random() * 0.4 + 0.2));
  const stages =
    configuredStages ??
    [
      { label: String(config.stage1Label ?? "Page View"), value: stage1 },
      { label: String(config.stage2Label ?? "Sign Up"), value: stage2 },
      { label: String(config.stage3Label ?? "Activated"), value: stage3 },
      { label: String(config.stage4Label ?? "Paid"), value: stage4 },
    ];

  return (
    <div style={{ ...panelStyle, width: 280 }}>
      <Handle id="left-target" type="target" position={Position.Left} />
      <Handle id="top-target" type="target" position={Position.Top} />
      {header}
      <div className="px-3 py-3">
        <FunnelBars stages={stages} color={color} />
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-[#7d8590]">Overall conversion</span>
          <span className="font-medium text-[#3fb950]">
            {((stage4 / stage1) * 100).toFixed(2)}%
          </span>
        </div>
      </div>
      <Handle id="right-source" type="source" position={Position.Right} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} />
    </div>
  );
}

const VizNode = memo(VizNodeComponent);
export default VizNode;
