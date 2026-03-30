"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { GridStack } from "gridstack";
import { BarChart3, Plus, Table, TrendingUp, Type, X } from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import type { AppNode, DashboardWidget } from "@/lib/flow-types";
import { coerceTextValue } from "@/components/nodes/SharedNodeComponents";

const widgetTemplates: Array<{
  type: DashboardWidget["type"];
  label: string;
  Icon: React.ElementType;
}> = [
  { type: "metric", label: "Metric", Icon: TrendingUp },
  { type: "linechart", label: "Line Chart", Icon: BarChart3 },
  { type: "barchart", label: "Bar Chart", Icon: BarChart3 },
  { type: "piechart", label: "Pie Chart", Icon: BarChart3 },
  { type: "table", label: "Table", Icon: Table },
  { type: "text", label: "Text", Icon: Type },
];

function createWidgetId(
  widgets: DashboardWidget[],
  widgetType: DashboardWidget["type"],
) {
  let index = widgets.length + 1;
  let nextId = `${widgetType}-${index}`;

  while (widgets.some((widget) => widget.id === nextId)) {
    index += 1;
    nextId = `${widgetType}-${index}`;
  }

  return nextId;
}

function WidgetPreview({ widgetType }: { widgetType: DashboardWidget["type"] }) {
  if (widgetType === "metric") {
    return (
      <div className="p-3">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">MRR</div>
        <div className="mt-1 text-2xl font-semibold text-[#e6edf3]">$12,450</div>
        <div className="mt-1 text-[10px] font-medium text-[#3fb950]">+5.2% vs last period</div>
      </div>
    );
  }

  if (widgetType === "table") {
    return (
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-[#30363d]">
            {["Event", "Users", "Rate"].map((header) => (
              <th key={header} className="px-3 py-2 text-left text-[#7d8590]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["signup", "142", "3.2%"],
            ["upgrade", "38", "0.86%"],
            ["cancel", "12", "0.27%"],
          ].map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`} className="border-b border-[#21262d]">
              {row.map((cell) => (
                <td key={cell} className="px-3 py-2 text-[#e6edf3]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (widgetType === "text") {
    return <div className="p-3 text-xs leading-relaxed text-[#7d8590]">Arraste widgets para montar o dashboard do canvas.</div>;
  }

  return (
    <div className="flex h-full items-end gap-2 px-3 pb-3">
      {[38, 52, 64, 48, 82].map((value) => (
        <div key={value} className="flex-1 rounded-sm bg-[#1f6feb]" style={{ height: `${value}%` }} />
      ))}
    </div>
  );
}

export default function DashboardNode({ id, data, selected }: NodeProps<AppNode>) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const widgets = (data.widgets as DashboardWidget[]) ?? [];

  useEffect(() => {
    if (!gridRef.current) return;
    const grid = GridStack.init(
      {
        column: 6,
        cellHeight: 60,
        margin: 4,
        animate: false,
      },
      gridRef.current,
    );

    return () => {
      grid.destroy(false);
    };
  }, []);

  const persistWidgets = (nextWidgets: DashboardWidget[]) => {
    updateNodeData(id, { widgets: nextWidgets });
  };

  const addWidget = (widgetType: DashboardWidget["type"]) => {
    const nextWidgets = [
      ...widgets,
      {
        id: createWidgetId(widgets, widgetType),
        type: widgetType,
        x: 0,
        y: 99,
        w: widgetType === "metric" ? 2 : 3,
        h: widgetType === "metric" ? 2 : 3,
      },
    ];
    persistWidgets(nextWidgets);
    setShowAddWidget(false);
  };

  const removeWidget = (widgetId: string) => {
    persistWidgets(widgets.filter((widget) => widget.id !== widgetId));
  };

  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-[#161b22]"
      style={{
        minWidth: 540,
        minHeight: 320,
        borderColor: selected ? "#1f6feb" : "#30363d",
      }}
    >
      <Handle id="left-target" type="target" position={Position.Left} />
      <Handle id="top-target" type="target" position={Position.Top} />
      <Handle id="right-source" type="source" position={Position.Right} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} />
      <NodeResizer minWidth={420} minHeight={260} isVisible={selected} />
      <div className="dashboard-node-drag-handle flex cursor-grab items-center justify-between border-b border-[#30363d] bg-[#0d1117cc] px-3 py-2 active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#3fb950]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e6edf3]">
            {coerceTextValue(data.label, "Dashboard")}
          </span>
        </div>
        <div className="relative">
          <button
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setShowAddWidget((current) => !current);
            }}
            className="flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[10px] text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            <Plus className="h-3 w-3" />
            Add widget
          </button>
          {showAddWidget ? (
            <div className="fc-panel absolute right-0 top-8 z-50 w-44 overflow-hidden">
              {widgetTemplates.map((template) => (
                <button
                  key={template.type}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    addWidget(template.type);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d]"
                >
                  <template.Icon className="h-3 w-3 text-[#7d8590]" />
                  {template.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div
        ref={gridRef}
        className="nodrag nopan grid-stack min-h-[270px]"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="grid-stack-item"
            gs-x={widget.x.toString()}
            gs-y={widget.y.toString()}
            gs-w={widget.w.toString()}
            gs-h={widget.h.toString()}
          >
            <div
              className="grid-stack-item-content group relative nodrag nopan"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  removeWidget(widget.id);
                }}
                className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded text-[#7d8590] opacity-0 transition-all hover:bg-[#f8514910] hover:text-[#f85149] group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              <WidgetPreview widgetType={widget.type} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
