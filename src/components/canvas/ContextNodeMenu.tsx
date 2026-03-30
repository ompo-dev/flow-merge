"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { nodeCategories } from "@/lib/node-catalog";
import { IconBlock } from "@/components/nodes/SharedNodeComponents";
import { useFlowStore } from "@/store/useFlowStore";

const MENU_WIDTH = 320;
const MENU_HEIGHT = 420;
const MENU_MARGIN = 12;

export function ContextNodeMenu() {
  const context = useFlowStore((state) => state.rightClickCtx);
  const setRightClickCtx = useFlowStore((state) => state.setRightClickCtx);
  const addCatalogNode = useFlowStore((state) => state.addCatalogNode);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!context) return;

    const onMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setRightClickCtx(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [context, setRightClickCtx]);

  const filteredCategories = useMemo(() => {
    const query = search.toLowerCase().trim();
    return nodeCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          `${item.label} ${item.description} ${item.category}`.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [search]);

  if (!context) return null;

  const left = Math.min(
    Math.max(MENU_MARGIN, context.screenX),
    window.innerWidth - MENU_WIDTH - MENU_MARGIN,
  );
  const top = Math.min(
    Math.max(MENU_MARGIN, context.screenY),
    window.innerHeight - MENU_HEIGHT - MENU_MARGIN,
  );

  return (
    <div
      ref={ref}
      className="fc-panel fixed z-[200] flex w-[320px] flex-col overflow-hidden"
      style={{ left, top, height: MENU_HEIGHT }}
    >
      <div className="flex items-center gap-2 border-b border-[#30363d] px-3 py-2">
        <Search className="h-3.5 w-3.5 text-[#7d8590]" />
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar node..."
          className="flex-1 border-none bg-transparent text-xs text-[#e6edf3] outline-none placeholder:text-[#3d444d]"
        />
        <button
          onClick={() => setRightClickCtx(null)}
          className="rounded p-0.5 text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filteredCategories.length ? (
          filteredCategories.map((category) => (
            <div key={category.id} className="mb-4">
              <div className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#7d8590]">
                {category.label}
              </div>
              <div className="space-y-2">
                {category.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() =>
                      addCatalogNode(item.type, { x: context.flowX, y: context.flowY })
                    }
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
          ))
        ) : (
          <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-3 text-xs text-[#7d8590]">
            Nenhum node encontrado.
          </div>
        )}
      </div>

      <div className="border-t border-[#30363d] px-3 py-1.5 text-[9px] text-[#3d444d]">
        O node sera inserido na posicao clicada.
      </div>
    </div>
  );
}
