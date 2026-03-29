"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AppNode } from "@/lib/flow-types";

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

function BarChart({
  data,
  color,
  height = 80,
  width = 280,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  const max = Math.max(...data);
  const barWidth = width / data.length - 3;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {data.map((value, index) => {
        const barHeight = (value / max) * (height - 4);
        return (
          <rect
            key={`${value}-${index}`}
            x={index * (barWidth + 3)}
            y={height - barHeight - 2}
            width={barWidth}
            height={barHeight}
            fill={color}
            fillOpacity={0.7}
            rx={2}
          />
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

function VizNodeComponent({ id, data, selected }: NodeProps<AppNode>) {
  const seed = hashString(id);
  const config = (data.config ?? {}) as Record<string, unknown>;
  const variant = String(config.variant ?? data.vizVariant ?? "revenue");
  const color = variantColor(variant);

  const panelStyle: React.CSSProperties = {
    background: "#161b22",
    border: `1px solid ${selected ? "#1f6feb" : "#30363d"}`,
    borderRadius: 10,
    overflow: "hidden",
    cursor: "pointer",
    opacity: data.disabled ? 0.45 : 1,
  };

  const header = (
    <div className="flex items-center justify-between border-b border-[#21262d] px-3 py-2">
      <span className="text-xs font-semibold text-[#e6edf3]">{data.label}</span>
      <span className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color }}>
        live
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
    const value = (config.value as string) ?? fallbackValue;
    const trend = (config.trend as string) ?? fallbackTrend;
    const compareLabel = (config.compareLabel as string) ?? "vs last period";

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
    const seriesA = makeSeries(seed, 14, 10, 100);
    const seriesB = makeSeries(seed + 7, 14, 10, 100);
    const chartType = String(config.chartType ?? data.chartType ?? "line");
    const timeRange = (config.timeRange as string) ?? "Last 14 days";

    return (
      <div style={{ ...panelStyle, width: 320 }}>
        <Handle id="left-target" type="target" position={Position.Left} />
        <Handle id="top-target" type="target" position={Position.Top} />
        {header}
        <div className="px-3 py-3">
          {chartType === "bar" ? (
            <div className="grid grid-cols-2 gap-2">
              <BarChart data={seriesA} color="#1f6feb" width={136} height={72} />
              <BarChart data={seriesB} color="#3fb950" width={136} height={72} />
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
            <span>{timeRange}</span>
            <span>today</span>
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
    const rows =
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

    return (
      <div style={{ ...panelStyle, width: 340 }}>
        <Handle id="left-target" type="target" position={Position.Left} />
        <Handle id="top-target" type="target" position={Position.Top} />
        {header}
        <table className="w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-[#21262d]">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#7d8590]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, Number.isNaN(maxRows) ? 3 : maxRows).map((row, rowIndex) => (
              <tr
                key={`${row[0]}-${rowIndex}`}
                className={rowIndex % 2 === 0 ? "" : "bg-[#0d1117]"}
              >
                {columns.map((column, cellIndex) => (
                  <td
                    key={`${column}-${cellIndex}`}
                    className="px-3 py-2 text-[#e6edf3]"
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
    const reportTitle = (config.reportTitle as string) ?? data.label;
    const includeAiInsight = String(config.includeAiInsight ?? "Yes") !== "No";
    const insight =
      (config.insight as string) ??
      "Cart abandonment is down 3.2% since the checkout redesign. Consider extending the coupon campaign for another week.";

    return (
      <div style={{ ...panelStyle, width: 300 }}>
        <Handle id="left-target" type="target" position={Position.Left} />
        <Handle id="top-target" type="target" position={Position.Top} />
        {header}
        <div className="flex flex-col gap-2 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
            {reportTitle}
          </div>
          {reportRows.map((row) => (
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
  const stage1 = Math.floor(random() * 38000 + 18000);
  const stage2 = Math.floor(stage1 * (random() * 0.16 + 0.08));
  const stage3 = Math.floor(stage2 * (random() * 0.45 + 0.35));
  const stage4 = Math.floor(stage3 * (random() * 0.4 + 0.2));
  const stages = [
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
