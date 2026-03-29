"use client";

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GenerativeComponent } from "@/lib/flow-types";

const colors = ["#1f6feb", "#3fb950", "#a371f7", "#d29922", "#f85149"];

function MetricCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: string;
}) {
  const positive = trend?.startsWith("+") ?? false;
  return (
    <div className="min-w-[110px] rounded border border-[#30363d] bg-[#0d1117] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#e6edf3]">{value}</div>
      {trend ? (
        <div className="mt-1 text-[10px] font-medium" style={{ color: positive ? "#3fb950" : "#f85149" }}>
          {trend}
        </div>
      ) : null}
    </div>
  );
}

function ChartCard({
  type,
  title,
  data,
}: {
  type: string;
  title: string;
  data: Array<Record<string, string | number>>;
}) {
  return (
    <div className="min-w-[220px] rounded border border-[#30363d] bg-[#0d1117] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">{title}</div>
      <div className="h-[92px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={34}>
                {data.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4, fontSize: 11 }}
                itemStyle={{ color: "#e6edf3" }}
              />
            </PieChart>
          ) : type === "bar" ? (
            <BarChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: -24 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#7d8590" }} />
              <YAxis tick={{ fontSize: 9, fill: "#7d8590" }} />
              <Tooltip
                contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4, fontSize: 11 }}
                itemStyle={{ color: "#e6edf3" }}
              />
              <Bar dataKey="value" fill="#1f6feb" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: -24 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#7d8590" }} />
              <YAxis tick={{ fontSize: 9, fill: "#7d8590" }} />
              <Tooltip
                contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4, fontSize: 11 }}
                itemStyle={{ color: "#e6edf3" }}
              />
              <Line type="monotone" dataKey="value" stroke="#1f6feb" strokeWidth={1.5} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TableCard({
  title,
  columns,
  rows,
}: {
  title?: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="min-w-[220px] overflow-hidden rounded border border-[#30363d] bg-[#0d1117]">
      {title ? (
        <div className="border-b border-[#30363d] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
          {title}
        </div>
      ) : null}
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-[#21262d]">
            {columns.map((column) => (
              <th key={column} className="bg-[#161b22] px-3 py-2 text-left text-[#7d8590]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-b border-[#161b22]">
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`} className="px-3 py-2 text-[#e6edf3]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GenerativeUIRenderer({ components }: { components: GenerativeComponent[] }) {
  if (!components.length) return null;

  const metrics = components.filter((component) => component.component === "metric");
  const otherComponents = components.filter((component) => component.component !== "metric");

  return (
    <div className="mt-3 flex flex-col gap-2">
      {metrics.length ? (
        <div className="flex flex-wrap gap-2">
          {metrics.map((component, index) => (
            <MetricCard
              key={index}
              label={String(component.props.label ?? "Metric")}
              value={String(component.props.value ?? "-")}
              trend={component.props.trend ? String(component.props.trend) : undefined}
            />
          ))}
        </div>
      ) : null}

      {otherComponents.map((component, index) => {
        if (component.component === "chart") {
          return (
            <ChartCard
              key={index}
              type={String(component.props.type ?? "line")}
              title={String(component.props.title ?? "Chart")}
              data={(component.props.data as Array<Record<string, string | number>>) ?? []}
            />
          );
        }

        if (component.component === "table") {
          return (
            <TableCard
              key={index}
              title={component.props.title ? String(component.props.title) : undefined}
              columns={(component.props.columns as string[]) ?? []}
              rows={(component.props.rows as string[][]) ?? []}
            />
          );
        }

        return (
          <p key={index} className="text-xs leading-relaxed text-[#e6edf3]">
            {String(component.props.content ?? "")}
          </p>
        );
      })}
    </div>
  );
}
