"use client";

import { useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import type { AppNode } from "@/lib/flow-types";

export default function ShapeNode({ id, data, selected }: NodeProps<AppNode>) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const [localText, setLocalText] = useState((data.text as string) ?? "");
  const [editing, setEditing] = useState(false);
  const persistedText = (data.text as string) ?? "";
  const width = typeof data.width === "number" ? data.width : 200;
  const height = typeof data.height === "number" ? data.height : 120;
  const fill = (data.fill as string) ?? "rgba(31,111,235,0.07)";
  const strokeColor = (data.strokeColor as string) ?? "#30363d";

  const saveText = () => {
    updateNodeData(id, { text: localText });
    setEditing(false);
  };

  return (
    <div style={{ position: "relative", width, height }}>
      <NodeResizer minWidth={60} minHeight={40} isVisible={selected} />
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {data.shapeType === "ellipse" ? (
          <ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 1} ry={height / 2 - 1} fill={fill} stroke={selected ? "#1f6feb" : strokeColor} strokeWidth={1.5} />
        ) : data.shapeType === "diamond" ? (
          <polygon points={`${width / 2},2 ${width - 2},${height / 2} ${width / 2},${height - 2} 2,${height / 2}`} fill={fill} stroke={selected ? "#1f6feb" : strokeColor} strokeWidth={1.5} />
        ) : data.shapeType === "arrow" ? (
          <>
            <line x1={4} y1={height / 2} x2={width - 10} y2={height / 2} stroke={selected ? "#1f6feb" : strokeColor} strokeWidth={1.5} />
            <polygon points={`${width - 10},${height / 2 - 5} ${width - 10},${height / 2 + 5} ${width - 2},${height / 2}`} fill={selected ? "#1f6feb" : strokeColor} />
          </>
        ) : (
          <rect x={1} y={1} width={width - 2} height={height - 2} rx={4} fill={fill} stroke={selected ? "#1f6feb" : strokeColor} strokeWidth={1.5} />
        )}
      </svg>

      {data.shapeType === "text" ? (
        editing ? (
          <textarea
            autoFocus
            value={localText}
            onChange={(event) => setLocalText(event.target.value)}
            onBlur={saveText}
            className="absolute inset-0 resize-none rounded border border-[#1f6feb] bg-transparent p-2 text-[13px] text-[#e6edf3] outline-none"
          />
        ) : (
          <div
            onDoubleClick={() => {
              setLocalText(persistedText);
              setEditing(true);
            }}
            className="absolute inset-0 flex cursor-text items-center justify-center p-2 text-center text-[13px] leading-snug text-[#e6edf3]"
          >
            {persistedText || <span className="text-[#3d444d]">Double-click to edit</span>}
          </div>
        )
      ) : persistedText ? (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] text-[#e6edf3]">
          {persistedText}
        </div>
      ) : null}
    </div>
  );
}
