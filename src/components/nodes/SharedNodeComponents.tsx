"use client";

import { Handle, Position } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Braces,
  Bug,
  ChartColumn,
  Clock3,
  Code2,
  DollarSign,
  Equal,
  FileText,
  Filter,
  Funnel,
  Gauge,
  GitBranch,
  GitMerge,
  Globe,
  LayoutDashboard,
  LineChart,
  Mail,
  MessageSquare,
  Play,
  Reply,
  Rows3,
  ScanSearch,
  Sigma,
  Sparkles,
  Table2,
  TestTube2,
  TimerReset,
  Users,
  Scale,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ICONS: Record<string, LucideIcon> = {
  Activity,
  BellRing,
  Braces,
  Bug,
  ChartColumn,
  Clock3,
  Code2,
  DollarSign,
  Equal,
  FileText,
  Filter,
  Funnel,
  Gauge,
  GitBranch,
  GitMerge,
  Github: GitBranch,
  Globe,
  LayoutDashboard,
  LineChart,
  Mail,
  MessageSquare,
  Play,
  Reply,
  Rows3,
  ScanSearch,
  Sigma,
  Sparkles,
  Table2,
  TestTube2,
  TimerReset,
  Users,
  Scale,
};

export function coerceTextValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return fallback;

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? fallback : serialized;
  } catch {
    return fallback;
  }
}

export function IconBlock({
  iconName,
  accent,
}: {
  iconName?: string;
  accent: string;
}) {
  const resolvedIconName = typeof iconName === "string" ? iconName : undefined;
  const Icon = resolvedIconName ? ICONS[resolvedIconName] ?? Activity : Activity;
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-md border"
      style={{ background: `${accent}18`, borderColor: `${accent}33`, color: accent }}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

export function NodeContainer({
  children,
  selected,
  accentColor,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  accentColor: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-[#161b22] transition-colors",
        selected ? "border-[#1f6feb]" : "border-[#30363d] hover:border-[#3d444d]",
        className,
      )}
    >
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ background: accentColor }}
      />
      {children}
    </div>
  );
}

export function NodeHeader({
  label,
  iconName,
  accent,
  badge,
}: {
  label: string;
  iconName?: string;
  accent: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#21262d] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <IconBlock iconName={iconName} accent={accent} />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e6edf3]">
            {coerceTextValue(label, "Untitled node")}
          </div>
        </div>
      </div>
      {badge ? (
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-medium"
          style={{ background: `${accent}18`, color: accent }}
        >
          {coerceTextValue(badge)}
        </span>
      ) : null}
    </div>
  );
}

export function StandardHandles({ type }: { type: "source" | "target" | "both" }) {
  return (
    <>
      {(type === "target" || type === "both") && (
        <>
          <Handle id="left-target" type="target" position={Position.Left} />
          <Handle id="top-target" type="target" position={Position.Top} />
        </>
      )}
      {(type === "source" || type === "both") && (
        <>
          <Handle id="right-source" type="source" position={Position.Right} />
          <Handle id="bottom-source" type="source" position={Position.Bottom} />
        </>
      )}
    </>
  );
}
