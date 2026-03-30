"use client";

import { useEffect } from "react";
import {
  Circle,
  Diamond,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  Square,
  Type,
} from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import type { ToolMode } from "@/lib/flow-types";
import { cn } from "@/lib/utils";

const tools: Array<{ mode: ToolMode; Icon: React.ElementType; label: string; key: string }> = [
  { mode: "select", Icon: MousePointer2, label: "Select", key: "V" },
  { mode: "hand", Icon: Hand, label: "Pan", key: "H" },
  { mode: "rect", Icon: Square, label: "Rectangle", key: "R" },
  { mode: "ellipse", Icon: Circle, label: "Ellipse", key: "E" },
  { mode: "diamond", Icon: Diamond, label: "Diamond", key: "D" },
  { mode: "arrow", Icon: Minus, label: "Arrow", key: "A" },
  { mode: "text", Icon: Type, label: "Text", key: "T" },
  { mode: "eraser", Icon: Eraser, label: "Eraser", key: "X" },
];

export function DrawingTools() {
  const activeTool = useFlowStore((state) => state.activeTool);
  const setActiveTool = useFlowStore((state) => state.setActiveTool);

  useEffect(() => {
    const keyMap: Record<string, ToolMode> = {
      v: "select",
      h: "hand",
      r: "rect",
      e: "ellipse",
      d: "diamond",
      a: "arrow",
      t: "text",
      x: "eraser",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      const tool = keyMap[event.key.toLowerCase()];
      if (tool) setActiveTool(tool);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setActiveTool]);

  return (
    <div className="fc-panel absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-0.5 p-1">
      {tools.map((tool) => (
        <button
          key={tool.mode}
          title={`${tool.label} (${tool.key})`}
          onClick={() => setActiveTool(tool.mode)}
          className={cn(
            "group relative flex h-8 w-8 items-center justify-center rounded transition-colors",
            activeTool === tool.mode
              ? "bg-[#1f6feb1f] text-[#58a6ff]"
              : "text-[#7d8590] hover:bg-[#21262d] hover:text-[#e6edf3]",
          )}
        >
          <tool.Icon className="h-4 w-4" />
          <span className="pointer-events-none absolute left-10 whitespace-nowrap rounded border border-[#30363d] bg-[#161b22] px-1.5 py-0.5 text-[10px] text-[#e6edf3] opacity-0 transition-opacity group-hover:opacity-100">
            {tool.label} ({tool.key})
          </span>
        </button>
      ))}
    </div>
  );
}
