"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AppNode } from "@/lib/flow-types";
import {
  coerceTextValue,
  NodeContainer,
  NodeHeader,
  StandardHandles,
} from "@/components/nodes/SharedNodeComponents";
import { getNodeSemanticState } from "@/lib/workflow-intelligence";
import { useActiveWorkflow } from "@/store/useFlowStore";

function ActionNodeComponent({ id, data, selected }: NodeProps<AppNode>) {
  const activeWorkflow = useActiveWorkflow();
  const semanticState = useMemo(
    () => (activeWorkflow ? getNodeSemanticState(activeWorkflow, id) : null),
    [activeWorkflow, id],
  );
  const isIfNode = data.nodeType === "action_if";
  const isSwitchNode = data.nodeType === "action_switch";
  const isBranching = isIfNode || isSwitchNode;
  const switchCases = isSwitchNode
    ? Array.from({ length: 4 }, (_, index) => {
        const handle = `case_${index + 1}`;
        const label = coerceTextValue(data.parameters?.[`Case ${index + 1}`]).trim();
        if (!label) return null;

        return {
          handle,
          label,
        };
      }).filter((entry): entry is { handle: string; label: string } => Boolean(entry))
    : [];
  const parameterCount = Object.keys(data.parameters ?? {}).filter(
    (key) => coerceTextValue(data.parameters?.[key]).trim() !== "",
  ).length;
  const runtime = data.runtime;
  const isVisuallyInactive = Boolean(data.disabled || semanticState?.autoBlocked);

  return (
    <div>
      <NodeContainer
        selected={selected}
        accentColor={(data.accent as string) ?? "#1f6feb"}
        className={isVisuallyInactive ? "opacity-55" : undefined}
      >
        <NodeHeader
          label={data.label}
          iconName={data.icon as string}
          accent={(data.accent as string) ?? "#1f6feb"}
          badge={(data.badge as string) ?? "ACTION"}
        />
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#7d8590]">
            {coerceTextValue(data.description, "Processes data")}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#3d444d]">
            <span>{parameterCount} params</span>
            {data.disabled ? <span>desativado</span> : null}
            {!data.disabled && semanticState?.autoBlocked ? <span>bloqueado</span> : null}
            {runtime?.status && runtime.status !== "idle" ? <span>{runtime.status}</span> : null}
          </div>
          {runtime?.summary ? (
            <p className="mt-2 rounded border border-[#21262d] bg-[#0d1117] px-2 py-1 text-[10px] leading-relaxed text-[#7d8590]">
              {runtime.summary}
            </p>
          ) : null}
          {data.notes ? (
            <p className="mt-2 border-t border-[#21262d] pt-2 text-[11px] italic text-[#3d444d]">
              {coerceTextValue(data.notes)}
            </p>
          ) : null}
        </div>
        {isBranching ? (
          <>
            <Handle id="left-target" type="target" position={Position.Left} />
            <Handle id="top-target" type="target" position={Position.Top} />
            {isIfNode ? (
              <>
                <Handle
                  type="source"
                  id="true"
                  position={Position.Right}
                  style={{ top: "36%" }}
                />
                <Handle type="source" id="false" position={Position.Bottom} />
              </>
            ) : (
              <>
                {switchCases.map((entry, index) => {
                  const top = 24 + index * (switchCases.length > 1 ? 54 / (switchCases.length - 1) : 0);
                  return (
                    <Handle
                      key={entry.handle}
                      type="source"
                      id={entry.handle}
                      position={Position.Right}
                      style={{ top: `${top}%` }}
                    />
                  );
                })}
                <Handle type="source" id="default" position={Position.Bottom} />
              </>
            )}
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
