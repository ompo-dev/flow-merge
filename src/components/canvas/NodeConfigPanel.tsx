"use client";

import { useMemo } from "react";
import { ChevronRight, Copy, Power, Settings2, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { parameterDefaults } from "@/lib/node-catalog";
import { getNodeConfigFields, type NodeConfigField } from "@/lib/node-config";
import type { JSONSchema } from "@/lib/flow-types";
import { useActiveWorkflow, useFlowStore } from "@/store/useFlowStore";

const SCHEMA_COLOR: Record<string, string> = {
  string: "#3fb950",
  number: "#d29922",
  object: "#1f6feb",
  array: "#a371f7",
  boolean: "#f85149",
};

function SchemaTree({
  schema,
  depth = 0,
}: {
  schema?: JSONSchema;
  depth?: number;
}) {
  if (!schema?.properties) return null;

  return (
    <div style={{ marginLeft: depth * 12 }}>
      {Object.entries(schema.properties).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 py-0.5">
          <ChevronRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#3d444d]" />
          <span className="text-[10px] font-mono text-[#e6edf3]">{key}</span>
          <span
            className="rounded px-1 text-[9px] font-mono"
            style={{
              background: `${SCHEMA_COLOR[value.type] ?? "#7d8590"}18`,
              color: SCHEMA_COLOR[value.type] ?? "#7d8590",
            }}
          >
            {value.type}
          </span>
          {value.description ? (
            <span className="truncate text-[10px] text-[#3d444d]">{value.description}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ConfigFieldControl({
  field,
  value,
  onChange,
}: {
  field: NodeConfigField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className="w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors placeholder:text-[#3d444d] focus:border-[#1f6feb]"
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors focus:border-[#1f6feb]"
      >
        <option value="">{field.placeholder}</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors placeholder:text-[#3d444d] focus:border-[#1f6feb]"
    />
  );
}

export function NodeConfigPanel() {
  const activeWorkflow = useActiveWorkflow();
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);
  const updateNodeParameters = useFlowStore((state) => state.updateNodeParameters);
  const duplicateNode = useFlowStore((state) => state.duplicateNode);
  const deleteNode = useFlowStore((state) => state.deleteNode);

  const node = useMemo(
    () => activeWorkflow?.nodes.find((item) => item.id === selectedNodeId),
    [activeWorkflow?.nodes, selectedNodeId],
  );

  if (!node) return null;

  const configFields = getNodeConfigFields(node.data.nodeType);
  const parameterFields = configFields.length ? [] : parameterDefaults[node.data.nodeType] ?? [];
  const showJsonSnapshot =
    configFields.length === 0 &&
    !node.data.nodeType.startsWith("viz_") &&
    node.data.nodeType !== "viz_dashboard";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="absolute right-0 top-0 z-40 flex flex-col border-l border-[#30363d]"
        style={{ width: 280, background: "#161b22", bottom: 0 }}
      >
        <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 text-[#7d8590]" />
            <div>
              <div className="text-xs font-medium text-[#e6edf3]">{node.data.label}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                {node.data.badge}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="text-[#7d8590] transition-colors hover:text-[#e6edf3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3 border-b border-[#30363d] px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-[#7d8590]">
              Parameters
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#7d8590]">Label</label>
              <input
                value={String(node.data.label)}
                onChange={(event) => updateNodeData(node.id, { label: event.target.value })}
                className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors focus:border-[#1f6feb]"
              />
            </div>

            {configFields.length ? (
              configFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">{field.label}</label>
                  <ConfigFieldControl
                    field={field}
                    value={String(node.data.config?.[field.key] ?? "")}
                    onChange={(value) => updateNodeConfig(node.id, { [field.key]: value })}
                  />
                </div>
              ))
            ) : parameterFields.length ? (
              parameterFields.map((field) => (
                <div key={field.label} className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">{field.label}</label>
                  <input
                    value={node.data.parameters?.[field.label] ?? ""}
                    onChange={(event) =>
                      updateNodeParameters(node.id, field.label, event.target.value)
                    }
                    placeholder={field.placeholder}
                    className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors placeholder:text-[#3d444d] focus:border-[#1f6feb]"
                  />
                </div>
              ))
            ) : (
              <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[11px] text-[#7d8590]">
                This node has no editable parameters.
              </div>
            )}

            {showJsonSnapshot ? (
              <div className="space-y-1">
                <label className="text-[10px] text-[#7d8590]">JSON Config</label>
                <textarea
                  readOnly
                  value={JSON.stringify(
                    {
                      parameters: node.data.parameters ?? {},
                      config: node.data.config ?? {},
                    },
                    null,
                    2,
                  )}
                  className="h-24 w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 font-mono text-[10px] text-[#e6edf3] outline-none"
                />
              </div>
            ) : null}
          </div>

          {node.data.schema ? (
            <div className="space-y-3 border-b border-[#30363d] px-4 py-3">
              <div className="text-[10px] font-medium uppercase tracking-widest text-[#7d8590]">
                Node Schema
              </div>

              {node.data.schema.output ? (
                <div>
                  <div className="mb-1 text-[10px] text-[#3fb950]">Output</div>
                  <SchemaTree schema={node.data.schema.output} />
                </div>
              ) : null}

              {node.data.schema.input ? (
                <div>
                  <div className="mb-1 text-[10px] text-[#1f6feb]">Input</div>
                  <SchemaTree schema={node.data.schema.input} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1 px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-[#7d8590]">
              Notes
            </div>
            <textarea
              rows={4}
              value={String(node.data.notes ?? "")}
              onChange={(event) => updateNodeData(node.id, { notes: event.target.value })}
              placeholder="Document what this node does..."
              className="w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors placeholder:text-[#3d444d] focus:border-[#1f6feb]"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-[#30363d] px-4 py-3">
          <button
            onClick={() => updateNodeData(node.id, { disabled: !node.data.disabled })}
            className="flex items-center justify-center gap-1.5 rounded border border-[#30363d] px-2 py-1.5 text-[11px] text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            <Power className="h-3 w-3" />
            {node.data.disabled ? "Enable" : "Disable"}
          </button>
          <button
            onClick={() => duplicateNode(node.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#30363d] px-2 py-1.5 text-[11px] text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            <Copy className="h-3 w-3" />
            Duplicate
          </button>
          <button
            onClick={() => deleteNode(node.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#f8514930] px-2 py-1.5 text-[11px] text-[#f85149] transition-colors hover:bg-[#f8514910]"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
