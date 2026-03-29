"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AppNode } from "@/lib/flow-types";
import { NodeContainer, NodeHeader, StandardHandles } from "@/components/nodes/SharedNodeComponents";

function ActionNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const isBranching = data.nodeType === "action_if" || data.nodeType === "action_switch";
  const parameterCount = Object.keys(data.parameters ?? {}).filter(
    (key) => (data.parameters?.[key] ?? "").trim() !== "",
  ).length;
  const runtime = data.runtime;

  return (
    <div>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#1f6feb"}>
        <NodeHeader
          label={data.label}
          iconName={data.icon as string}
          accent={(data.accent as string) ?? "#1f6feb"}
          badge={(data.badge as string) ?? "ACTION"}
        />
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#7d8590]">
            {data.description ?? "Processes data"}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#3d444d]">
            <span>{parameterCount} params</span>
            {data.disabled ? <span>disabled</span> : null}
            {runtime?.status && runtime.status !== "idle" ? <span>{runtime.status}</span> : null}
          </div>
          {runtime?.summary ? (
            <p className="mt-2 rounded border border-[#21262d] bg-[#0d1117] px-2 py-1 text-[10px] leading-relaxed text-[#7d8590]">
              {runtime.summary}
            </p>
          ) : null}
          {data.notes ? (
            <p className="mt-2 border-t border-[#21262d] pt-2 text-[11px] italic text-[#3d444d]">
              {data.notes as string}
            </p>
          ) : null}
        </div>
        {isBranching ? (
          <>
            <Handle id="left-target" type="target" position={Position.Left} />
            <Handle id="top-target" type="target" position={Position.Top} />
            <Handle type="source" id="true" position={Position.Right} style={{ top: "36%" }} />
            <Handle type="source" id="false" position={Position.Bottom} />
          </>
        ) : (
          <StandardHandles type="both" />
        )}
      </NodeContainer>
    </div>
  );
}

const ActionNode = memo(ActionNodeComponent);
export default ActionNode;
