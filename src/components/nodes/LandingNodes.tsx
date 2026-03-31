"use client";

import { memo, useState, type ReactNode } from "react";
import Image from "next/image";
import type { NodeProps } from "@xyflow/react";
import {
  ArrowRight,
  Check,
  FileText,
  GitBranch,
  LayoutDashboard,
  LockKeyhole,
  Network,
  Rows3,
  Sparkles,
  Users,
} from "lucide-react";
import {
  NodeContainer,
  StandardHandles,
  coerceTextValue,
} from "@/components/nodes/SharedNodeComponents";
import type { AppNode } from "@/lib/flow-types";
import { useAuthStore } from "@/store/useAuthStore";

interface LandingItem {
  title: string;
  body: string;
  meta?: string;
}

interface LandingMetric {
  value: string;
  label: string;
  detail?: string;
}

interface LandingColumn {
  title: string;
  summary?: string;
  bullets?: string[];
  meta?: string;
}

interface LandingPageLink {
  title: string;
  slug?: string;
  status?: string;
  summary: string;
}

interface LandingLane {
  title: string;
  subtitle?: string;
  steps: string[];
  footer?: string;
}

interface LandingComponentExample {
  title: string;
  nodeKind?: string;
  summary: string;
  sample?: string;
}

function asItems(value: unknown) {
  return Array.isArray(value) ? (value as LandingItem[]) : [];
}

function asMetrics(value: unknown) {
  return Array.isArray(value) ? (value as LandingMetric[]) : [];
}

function asColumns(value: unknown) {
  return Array.isArray(value) ? (value as LandingColumn[]) : [];
}

function asPages(value: unknown) {
  return Array.isArray(value) ? (value as LandingPageLink[]) : [];
}

function asLanes(value: unknown) {
  return Array.isArray(value) ? (value as LandingLane[]) : [];
}

function asExamples(value: unknown) {
  return Array.isArray(value) ? (value as LandingComponentExample[]) : [];
}

function focusLandingNode(nodeId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("flow-merge-focus-node", {
      detail: { nodeId },
    }),
  );
}

function getWidth(data: AppNode["data"], fallback: number) {
  return typeof data.width === "number" ? data.width : fallback;
}

function LandingHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#21262d] px-4 py-3.5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#7d8590]">{eyebrow}</div>
        <div className="mt-2 text-lg font-semibold tracking-[-0.035em] text-[#f0f6fc]">{title}</div>
      </div>
      {meta ? (
        <div className="rounded-full border border-[#30363d] bg-[#11161d] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9fb3c8]">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function LandingLead({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-[#8b949e]">{children}</p>;
}

function formatLandingDate(value: string | null) {
  if (!value) return "agora";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function LandingChipRow({ chips }: { chips: string[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-[#30363d] bg-[#11161d] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9fb3c8]"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function LandingMetricCards({ metrics, compact = false }: { metrics: LandingMetric[]; compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : ""}`}>
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3"
        >
          <div className={`${compact ? "text-xl" : "text-2xl"} font-semibold tracking-[-0.04em] text-[#f0f6fc]`}>
            {metric.value}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#7d8590]">{metric.label}</div>
          {metric.detail ? (
            <div className="mt-2 text-[11px] leading-5 text-[#8b949e]">{metric.detail}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LandingItemGrid({
  items,
  columns = 2,
}: {
  items: LandingItem[];
  columns?: 1 | 2 | 3;
}) {
  const gridClass =
    columns === 3 ? "md:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "grid-cols-1";

  return (
    <div className={`mt-4 grid gap-3 ${gridClass}`}>
      {items.map((item) => (
        <div
          key={`${item.title}-${item.meta ?? ""}`}
          className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3"
        >
          <div className="text-sm font-medium text-[#f0f6fc]">{item.title}</div>
          <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">{item.body}</div>
          {item.meta ? (
            <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">{item.meta}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LandingHeroNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const headline = coerceTextValue(data.headline, data.label);
  const body = coerceTextValue(data.body, data.description);
  const chips = Array.isArray(data.chips) ? (data.chips as string[]) : [];
  const metrics = asMetrics(data.metrics);
  const focusNodeId = coerceTextValue(data.focusNodeId);

  return (
    <div style={{ width: getWidth(data, 860) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#58a6ff"}>
        <div className="grid gap-8 px-5 py-5 lg:grid-cols-[minmax(0,1.3fr)_260px]">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">
              <Network className="h-3.5 w-3.5 text-[#58a6ff]" />
              {coerceTextValue(data.eyebrow, "Flow Merge")}
            </div>
            <div className="mt-4 max-w-[12ch] text-5xl font-semibold leading-[0.92] tracking-[-0.065em] text-[#f0f6fc]">
              {headline}
            </div>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-7 text-[#8b949e]">{body}</p>
            <LandingChipRow chips={chips} />

            <div className="mt-6 grid gap-2 text-[13px] leading-6 text-[#9fb3c8] sm:grid-cols-2">
              <div className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3">
                O visitante entra vendo o produto real, nao uma maquete de marketing.
              </div>
              <div className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3">
                O mesmo canvas aceita mover, apagar, desenhar e exportar a propria homepage.
              </div>
            </div>

            {focusNodeId ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  focusLandingNode(focusNodeId);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#238636] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                Ir para o access node
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <LandingMetricCards metrics={metrics} />
        </div>
        <StandardHandles type="source" />
      </NodeContainer>
    </div>
  );
}

function LandingSectionNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const title = coerceTextValue(data.label, "Section");
  const body = coerceTextValue(data.description);
  const items = asItems(data.items);
  const columns = Math.min(Math.max(Number(data.columns ?? 2), 1), 3) as 1 | 2 | 3;

  return (
    <div style={{ width: getWidth(data, 520) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#58a6ff"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Landing section")}
          title={title}
        />
        <div className="px-4 py-4">
          {body ? <LandingLead>{body}</LandingLead> : null}
          <LandingItemGrid items={items} columns={columns} />
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingPageMapNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const pages = asPages(data.pages);

  return (
    <div style={{ width: getWidth(data, 440) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#58a6ff"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Site map")}
          title={coerceTextValue(data.label, "Flow Merge / Pages")}
          meta={coerceTextValue(data.meta, "site + pages")}
        />
        <div className="space-y-4 px-4 py-4">
          <LandingLead>
            {coerceTextValue(
              data.description,
              "No menu do topo, o primeiro nivel e o site. O segundo nivel sao as paginas/workflows que vivem dentro dele.",
            )}
          </LandingLead>

          <div className="rounded-2xl border border-[#30363d] bg-[#11161d] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Site</div>
                <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#f0f6fc]">Flow Merge</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Current page</div>
                <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#f0f6fc]">Landing Page</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {pages.map((page) => (
              <div
                key={`${page.title}-${page.slug ?? ""}`}
                className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#f0f6fc]">{page.title}</div>
                    {page.slug ? (
                      <div className="mt-1 font-mono text-[11px] text-[#7d8590]">{page.slug}</div>
                    ) : null}
                  </div>
                  {page.status ? (
                    <div className="rounded-full border border-[#30363d] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#9fb3c8]">
                      {page.status}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">{page.summary}</div>
              </div>
            ))}
          </div>
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingDifferenceNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const columns = asColumns(data.columnsContent);

  return (
    <div style={{ width: getWidth(data, 940) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#58a6ff"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Positioning")}
          title={coerceTextValue(data.label, "n8n + PostHog, merged")}
          meta={coerceTextValue(data.meta, "operator point of view")}
        />
        <div className="px-4 py-4">
          <LandingLead>
            {coerceTextValue(
              data.description,
              "A proposta nao e copiar dois produtos. E pegar o melhor plano de execucao e o melhor plano de leitura e fazer os dois caberem no mesmo canvas.",
            )}
          </LandingLead>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {columns.map((column) => (
              <div
                key={column.title}
                className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-4"
              >
                <div className="text-sm font-medium text-[#f0f6fc]">{column.title}</div>
                {column.summary ? (
                  <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">{column.summary}</div>
                ) : null}
                {column.bullets?.length ? (
                  <div className="mt-4 space-y-2">
                    {column.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-2 text-[13px] leading-6 text-[#9fb3c8]">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {column.meta ? (
                  <div className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                    {column.meta}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingWorkflowNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const lanes = asLanes(data.lanes);

  return (
    <div style={{ width: getWidth(data, 700) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#3fb950"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Operator flows")}
          title={coerceTextValue(data.label, "Simple flows, clear cases")}
          meta={coerceTextValue(data.meta, "idea-level examples")}
        />
        <div className="space-y-4 px-4 py-4">
          <LandingLead>
            {coerceTextValue(
              data.description,
              "A landing nao precisa rodar todos os casos de verdade. Ela precisa ensinar o formato do produto com loops simples e legiveis.",
            )}
          </LandingLead>

          <div className="space-y-3">
            {lanes.map((lane) => (
              <div
                key={lane.title}
                className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#f0f6fc]">{lane.title}</div>
                    {lane.subtitle ? (
                      <div className="mt-1 text-[13px] leading-6 text-[#8b949e]">{lane.subtitle}</div>
                    ) : null}
                  </div>
                  <GitBranch className="h-4 w-4 shrink-0 text-[#58a6ff]" />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {lane.steps.map((step, index) => (
                    <div key={`${lane.title}-${step}`} className="flex items-center gap-2">
                      <div className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-[#9fb3c8]">
                        {step}
                      </div>
                      {index < lane.steps.length - 1 ? (
                        <ArrowRight className="h-3.5 w-3.5 text-[#7d8590]" />
                      ) : null}
                    </div>
                  ))}
                </div>

                {lane.footer ? (
                  <div className="mt-4 text-[11px] leading-5 text-[#7d8590]">{lane.footer}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingComponentsNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const examples = asExamples(data.examples);

  return (
    <div style={{ width: getWidth(data, 660) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#58a6ff"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Native components")}
          title={coerceTextValue(data.label, "The landing speaks in product parts")}
          meta={coerceTextValue(data.meta, "real canvas language")}
        />
        <div className="space-y-4 px-4 py-4">
          <LandingLead>
            {coerceTextValue(
              data.description,
              "Em vez de cards de marketing soltos, a homepage usa os mesmos blocos mentais do app: node, handle, viewport, toolbar, drawing e export.",
            )}
          </LandingLead>

          <div className="space-y-3">
            {examples.map((example) => (
              <div
                key={`${example.title}-${example.nodeKind ?? ""}`}
                className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#f0f6fc]">{example.title}</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">{example.summary}</div>
                  </div>
                  {example.nodeKind ? (
                    <div className="rounded-full border border-[#30363d] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#9fb3c8]">
                      {example.nodeKind}
                    </div>
                  ) : null}
                </div>
                {example.sample ? (
                  <div className="mt-3 rounded-xl border border-[#21262d] bg-[#0d1117] px-3 py-2 font-mono text-[11px] leading-5 text-[#9fb3c8]">
                    {example.sample}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#30363d] bg-[#11161d] px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#f0f6fc]">
                <Rows3 className="h-4 w-4 text-[#58a6ff]" />
                Toolbar real
              </div>
            </div>
            <div className="rounded-2xl border border-[#30363d] bg-[#11161d] px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#f0f6fc]">
                <LayoutDashboard className="h-4 w-4 text-[#58a6ff]" />
                Canvas editavel
              </div>
            </div>
            <div className="rounded-2xl border border-[#30363d] bg-[#11161d] px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#f0f6fc]">
                <Sparkles className="h-4 w-4 text-[#58a6ff]" />
                Export do board
              </div>
            </div>
          </div>
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingUseCaseNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const items = asItems(data.items);

  return (
    <div style={{ width: getWidth(data, 820) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#3fb950"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Use cases")}
          title={coerceTextValue(data.label, "What people can actually run")}
          meta={coerceTextValue(data.meta, "simple operator loops")}
        />
        <div className="px-4 py-4">
          <LandingLead>
            {coerceTextValue(
              data.description,
              "Os blocos abaixo nao prometem infinitos cenarios. Eles mostram loops curtos, reais e faceis de entender na primeira visita.",
            )}
          </LandingLead>
          <LandingItemGrid items={items} columns={2} />
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingAudienceNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const items = asItems(data.items);

  return (
    <div style={{ width: getWidth(data, 540) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#d29922"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Audience")}
          title={coerceTextValue(data.label, "Who gets value first")}
          meta={coerceTextValue(data.meta, "best fit")}
        />
        <div className="space-y-3 px-4 py-4">
          <LandingLead>
            {coerceTextValue(
              data.description,
              "O melhor cliente nao quer mais um dashboard parado. Quer um plano vivo para decidir e agir varias vezes por dia.",
            )}
          </LandingLead>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={`${item.title}-${item.meta ?? ""}`}
                className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3"
              >
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#d29922]" />
                  <div>
                    <div className="text-sm font-medium text-[#f0f6fc]">{item.title}</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">{item.body}</div>
                    {item.meta ? (
                      <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                        {item.meta}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingProofNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const metrics = asMetrics(data.metrics);

  return (
    <div style={{ width: getWidth(data, 360) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#3fb950"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Proof")}
          title={coerceTextValue(data.label, "Why this format lands")}
          meta={coerceTextValue(data.meta, "interaction matters")}
        />
        <div className="space-y-4 px-4 py-4">
          <LandingLead>
            {coerceTextValue(
              data.description,
              "A prova aqui nao e uma logo cloud. E o proprio comportamento da interface.",
            )}
          </LandingLead>
          <LandingMetricCards metrics={metrics} compact />
        </div>
        <StandardHandles type="both" />
      </NodeContainer>
    </div>
  );
}

function LandingFooterNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const pages = asPages(data.pages);
  const focusNodeId = coerceTextValue(data.focusNodeId);

  return (
    <div style={{ width: getWidth(data, 980) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#58a6ff"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Next pages")}
          title={coerceTextValue(data.label, "The site can grow without leaving the canvas")}
          meta={coerceTextValue(data.meta, "roadmap-ready")}
        />
        <div className="grid gap-5 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div>
            <LandingLead>
              {coerceTextValue(
                data.description,
                "Hoje existe uma homepage viva. Amanha o mesmo sistema de paginas pode receber politicas, termos, blog, docs e outros boards sem trocar a linguagem.",
              )}
            </LandingLead>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pages.map((page) => (
                <div
                  key={`${page.title}-${page.slug ?? ""}`}
                  className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#f0f6fc]">{page.title}</div>
                      {page.slug ? (
                        <div className="mt-1 font-mono text-[11px] text-[#7d8590]">{page.slug}</div>
                      ) : null}
                    </div>
                    {page.status ? (
                      <div className="rounded-full border border-[#30363d] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#9fb3c8]">
                        {page.status}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">{page.summary}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[#30363d] bg-[#11161d] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#f0f6fc]">
                <FileText className="h-4 w-4 text-[#58a6ff]" />
                Export the board
              </div>
              <div className="mt-3 text-[13px] leading-6 text-[#8b949e]">
                Exporte o canvas, marque o que quer mudar e a proxima iteracao pode nascer em cima do proprio JSON.
              </div>
            </div>

            <div className="rounded-2xl border border-[#30363d] bg-[#11161d] p-4">
              <div className="text-sm font-medium text-[#f0f6fc]">Same surface, more pages</div>
              <div className="mt-3 text-[13px] leading-6 text-[#8b949e]">
                O menu ja esta preparado para pensar em site e paginas, nao so em workflows internos.
              </div>
            </div>

            {focusNodeId ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  focusLandingNode(focusNodeId);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-2 rounded-md bg-[#238636] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                Abrir access node
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <StandardHandles type="target" />
      </NodeContainer>
    </div>
  );
}

function LandingAccessNodeComponent({ data, selected }: NodeProps<AppNode>) {
  const session = useAuthStore((state) => state.session);
  const license = useAuthStore((state) => state.license);
  const pending = useAuthStore((state) => state.pending);
  const billingPending = useAuthStore((state) => state.billingPending);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const requestBillingCharge = useAuthStore((state) => state.requestBillingCharge);
  const [error, setError] = useState("");
  const activeCharge = license.billing.activeCharge;
  const qrCodeImage =
    activeCharge?.qrCodePayload &&
    typeof activeCharge.qrCodePayload === "object" &&
    "brCodeBase64" in activeCharge.qrCodePayload
      ? (activeCharge.qrCodePayload.brCodeBase64 as string | undefined)
      : undefined;
  const brCode =
    activeCharge?.qrCodePayload &&
    typeof activeCharge.qrCodePayload === "object" &&
    "brCode" in activeCharge.qrCodePayload
      ? (activeCharge.qrCodePayload.brCode as string | undefined)
      : undefined;

  const handleGoogleLogin = async () => {
    setError("");
    const result = await loginWithGoogle();

    if (!result.success) {
      setError(result.error ?? "Nao foi possivel iniciar o login Google.");
    }
  };

  const handleChargeRequest = async (planType: "monthly" | "lifetime") => {
    setError("");
    const result = await requestBillingCharge(planType);

    if (!result.success) {
      setError(result.error ?? "Nao foi possivel gerar o PIX agora.");
    }
  };

  return (
    <div style={{ width: getWidth(data, 420) }}>
      <NodeContainer selected={selected} accentColor={(data.accent as string) ?? "#1f6feb"}>
        <LandingHeader
          eyebrow={coerceTextValue(data.eyebrow, "Access node")}
          title={coerceTextValue(data.label, "Entrar e liberar o workspace")}
          meta={coerceTextValue(data.meta, "google + trial + pix")}
        />

        <div
          className="px-4 py-4"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <LandingLead>
            {coerceTextValue(
              data.description,
              "O fluxo comercial do produto comeca aqui: login com Google, trial completo e cobranca PIX quando o workspace vira operacao real.",
            )}
          </LandingLead>

          {!session ? (
            <>
              <div className="mt-4 rounded-2xl border border-[#30363d] bg-[#11161d] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[#e6edf3]">
                  <LockKeyhole className="h-4 w-4 text-[#58a6ff]" />
                  Login unico
                </div>
                <div className="mt-3 space-y-2 text-[13px] leading-6 text-[#8b949e]">
                  <div className="flex items-start gap-2">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
                    Better Auth cuida da sessao e o produto continua local-first.
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
                    Trial de 14 dias com automacao, analytics, A/B e funil no mesmo canvas.
                  </div>
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-md border border-[#f8514933] bg-[#2a1215] px-3 py-2 text-sm text-[#f85149]">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={pending}
                data-testid="landing-login-google-button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-60"
              >
                {pending ? "Redirecionando..." : "Entrar com Google"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-2xl border border-[#30363d] bg-[#11161d] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#30363d] bg-[#0d1117] text-sm font-medium text-[#f0f6fc]">
                    {session.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[#f0f6fc]">{session.name}</div>
                    <div className="truncate text-[12px] text-[#7d8590]">{session.email}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#21262d] bg-[#0d1117] px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Estado</div>
                    <div className="mt-2 text-sm font-medium text-[#f0f6fc]">
                      {license.accessState ?? "sem sessao"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#21262d] bg-[#0d1117] px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Prazo atual</div>
                    <div className="mt-2 text-sm font-medium text-[#f0f6fc]">
                      {license.timeline.paymentDueAt
                        ? formatLandingDate(license.timeline.paymentDueAt)
                        : formatLandingDate(license.timeline.trialEndsAt)}
                    </div>
                  </div>
                </div>
              </div>

              {license.billing.activeCharge ? (
                <div className="mt-4 rounded-2xl border border-[#30363d] bg-[#11161d] p-4">
                  <div className="text-sm font-medium text-[#f0f6fc]">PIX pronto para pagamento</div>
                  <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">
                    O acesso continua por enquanto, mas bloqueia em {formatLandingDate(license.timeline.paymentDueAt)}.
                  </div>

                  {qrCodeImage ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-[#30363d] bg-white p-3">
                      <Image
                        src={qrCodeImage}
                        alt="QRCode PIX Flow Merge"
                        width={160}
                        height={160}
                        unoptimized
                        className="mx-auto h-40 w-40 object-contain"
                      />
                    </div>
                  ) : null}

                  {brCode ? (
                    <div className="mt-4 rounded-xl border border-[#21262d] bg-[#0d1117] px-3 py-2 font-mono text-[11px] leading-5 text-[#9fb3c8]">
                      {brCode}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={billingPending}
                    onClick={() => {
                      void handleChargeRequest("monthly");
                    }}
                    className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-4 text-left transition-colors hover:border-[#1f6feb] hover:bg-[#0f1a2b] disabled:opacity-60"
                  >
                    <div className="text-sm font-medium text-[#f0f6fc]">Pro Mensal</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">R$89 via PIX, renovacao manual por ciclo.</div>
                  </button>
                  <button
                    type="button"
                    disabled={billingPending}
                    onClick={() => {
                      void handleChargeRequest("lifetime");
                    }}
                    className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-4 text-left transition-colors hover:border-[#3fb950] hover:bg-[#102019] disabled:opacity-60"
                  >
                    <div className="text-sm font-medium text-[#f0f6fc]">Founder Lifetime</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">R$1.068 para liberar o core single-user.</div>
                  </button>
                </div>
              )}

              {error ? (
                <div className="mt-4 rounded-md border border-[#f8514933] bg-[#2a1215] px-3 py-2 text-sm text-[#f85149]">
                  {error}
                </div>
              ) : null}
            </>
          )}

          <div className="mt-4 rounded-2xl border border-[#30363d] bg-[#11161d] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#e6edf3]">
              <LockKeyhole className="h-4 w-4 text-[#58a6ff]" />
              Regra comercial do v1
            </div>
            <div className="mt-3 space-y-2 text-[13px] leading-6 text-[#8b949e]">
              <div className="flex items-start gap-2">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
                Trial de 14 dias com produto completo antes da cobranca.
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
                Se atrasar 7 dias, bloqueia. Se passar 14 dias bloqueado, apaga tudo.
              </div>
            </div>
          </div>
        </div>

        <StandardHandles type="target" />
      </NodeContainer>
    </div>
  );
}

export const LandingHeroNode = memo(LandingHeroNodeComponent);
export const LandingSectionNode = memo(LandingSectionNodeComponent);
export const LandingPageMapNode = memo(LandingPageMapNodeComponent);
export const LandingDifferenceNode = memo(LandingDifferenceNodeComponent);
export const LandingWorkflowNode = memo(LandingWorkflowNodeComponent);
export const LandingComponentsNode = memo(LandingComponentsNodeComponent);
export const LandingUseCaseNode = memo(LandingUseCaseNodeComponent);
export const LandingAudienceNode = memo(LandingAudienceNodeComponent);
export const LandingProofNode = memo(LandingProofNodeComponent);
export const LandingFooterNode = memo(LandingFooterNodeComponent);
export const LandingAccessNode = memo(LandingAccessNodeComponent);
