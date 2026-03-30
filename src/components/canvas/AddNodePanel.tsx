"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { nodeCategories } from "@/lib/node-catalog";
import { useFlowStore } from "@/store/useFlowStore";
import { IconBlock } from "@/components/nodes/SharedNodeComponents";

export function AddNodePanel() {
  const isOpen = useFlowStore((state) => state.isAddNodePanelOpen);
  const setAddNodePanel = useFlowStore((state) => state.setAddNodePanel);
  const addCatalogNode = useFlowStore((state) => state.addCatalogNode);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    const query = search.toLowerCase().trim();
    return nodeCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          `${item.label} ${item.description} ${item.category}`.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.items.length > 0)
      .filter((category) => !activeCategory || category.id === activeCategory);
  }, [activeCategory, search]);

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 z-40 flex h-full w-[360px] flex-col border-l border-[#30363d] bg-[#161b22]">
      <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[#e6edf3]">Add node</div>
          <div className="text-[11px] text-[#7d8590]">Catálogo híbrido com nodes das versões A e B</div>
        </div>
        <button
          onClick={() => setAddNodePanel(false)}
          className="rounded p-1 text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-[#30363d] px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7d8590]" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search nodes..."
            className="w-full rounded-md border border-[#30363d] bg-[#0d1117] py-2 pl-9 pr-3 text-xs text-[#e6edf3] outline-none placeholder:text-[#3d444d] focus:border-[#1f6feb]"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {nodeCategories.map((category) => {
            const active = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(active ? null : category.id)}
                className="rounded-full border px-3 py-1 text-[11px] transition-colors"
                style={{
                  borderColor: active ? "#1f6feb" : "#30363d",
                  background: active ? "#0c1a2e" : "transparent",
                  color: active ? "#58a6ff" : "#7d8590",
                }}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filteredCategories.map((category) => (
          <div key={category.id} className="mb-5">
            <div className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#7d8590]">
              {category.label}
            </div>
            <div className="space-y-2">
              {category.items.map((item) => (
                <button
                  key={item.type}
                  onClick={() => addCatalogNode(item.type)}
                  className="flex w-full items-start gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-3 text-left transition-colors hover:border-[#3d444d] hover:bg-[#11161d]"
                >
                  <IconBlock iconName={item.icon} accent={item.accent} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-medium text-[#e6edf3]">
                        {item.label}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                        style={{ background: `${item.accent}18`, color: item.accent }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
                      {item.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
