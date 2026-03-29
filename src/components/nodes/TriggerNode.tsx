"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { AppNode } from "@/lib/flow-types";
import { NodeContainer, NodeHeader, StandardHandles } from "@/components/nodes/SharedNodeComponents";

function TriggerNodeComponent({ data, selected }: NodeProps<AppNode>) {
  return (
    <div>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#d29922"}>
        <NodeHeader
          label={data.label}
          iconName={data.icon as string}
          accent={(data.accent as string) ?? "#d29922"}
          badge={(data.badge as string) ?? "TRIGGER"}
        />
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#7d8590]">
            {data.description ?? "Fires workflow event"}
          </p>
          {data.notes ? (
            <p className="mt-2 border-t border-[#21262d] pt-2 text-[11px] italic text-[#3d444d]">
              {data.notes as string}
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
