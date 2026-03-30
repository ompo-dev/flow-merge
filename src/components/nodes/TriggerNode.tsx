"use client";

import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { AppNode } from "@/lib/flow-types";
import {
  coerceTextValue,
  NodeContainer,
  NodeHeader,
  StandardHandles,
} from "@/components/nodes/SharedNodeComponents";
import { getNodeSemanticState } from "@/lib/workflow-intelligence";
import { useActiveWorkflow } from "@/store/useFlowStore";

function TriggerNodeComponent({ id, data, selected }: NodeProps<AppNode>) {
  const activeWorkflow = useActiveWorkflow();
  const semanticState = useMemo(
    () => (activeWorkflow ? getNodeSemanticState(activeWorkflow, id) : null),
    [activeWorkflow, id],
  );
  const runtime = data.runtime;
  const isVisuallyInactive = Boolean(data.disabled || semanticState?.autoBlocked);

  return (
    <div>
      <NodeContainer
        selected={selected}
        accentColor={(data.accent as string) ?? "#d29922"}
        className={isVisuallyInactive ? "opacity-55" : undefined}
      >
        <NodeHeader
          label={data.label}
          iconName={data.icon as string}
          accent={(data.accent as string) ?? "#d29922"}
          badge={(data.badge as string) ?? "TRIGGER"}
        />
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#7d8590]">
            {coerceTextValue(data.description, "Fires workflow event")}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#3d444d]">
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
        <StandardHandles type="source" />
      </NodeContainer>
    </div>
  );
}

const TriggerNode = memo(TriggerNodeComponent);
export default TriggerNode;
