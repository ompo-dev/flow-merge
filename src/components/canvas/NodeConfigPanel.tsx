"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Book,
  BookOpen,
  Braces,
  ChevronRight,
  Copy,
  FileJson,
  Loader2,
  Play,
  Power,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ProgrammableEditor } from "@/components/canvas/ProgrammableEditor";
import { coerceTextValue } from "@/components/nodes/SharedNodeComponents";
import {
  parameterDefaults,
  nodeCatalogMap,
  type NodeParameterField,
} from "@/lib/node-catalog";
import { applyNodePreset, getNodePresets, type NodePreset } from "@/lib/node-presets";
import {
  buildOutputStory,
  buildProgrammingRecipes,
  getFlowFieldShortcuts,
} from "@/lib/node-flow-ux";
import { getNodeDocumentation } from "@/lib/node-docs";
import { buildTriggerTestPayload } from "@/lib/trigger-test-payload";
import {
  ensureProgrammableConfig,
  getBuiltinCodePreview,
  inferNodeProgrammingContext,
} from "@/lib/node-programming";
import { getNodeConfigFields, type NodeConfigField } from "@/lib/node-config";
import type { JSONSchema } from "@/lib/flow-types";
import type { WorkflowTriggerSource } from "@/lib/runtime-types";
import {
  getActiveIncomingNodes,
  getNodeSemanticState,
} from "@/lib/workflow-intelligence";
import { useActiveWorkflow, useFlowStore } from "@/store/useFlowStore";

const SCHEMA_COLOR: Record<string, string> = {
  string: "#3fb950",
  number: "#d29922",
  object: "#1f6feb",
  array: "#a371f7",
  boolean: "#f85149",
};

const NODE_CATEGORY_LABELS: Record<string, string> = {
  Triggers: "Triggers",
  Core: "Nucleo",
  Analytics: "Analytics",
  Monitoring: "Monitoramento",
  Visualization: "Visualizacao",
  Integrations: "Integracoes",
};

function getSchemaTopLevelKeys(schema?: JSONSchema) {
  return Object.keys(schema?.properties ?? {});
}

function describeSchema(schema: JSONSchema | undefined, emptyLabel: string) {
  if (!schema) return emptyLabel;

  const topLevelKeys = getSchemaTopLevelKeys(schema);
  const typeLabel = schema.type === "object" ? "objeto" : schema.type;

  if (!topLevelKeys.length) {
    return `Este node declara uma entrada do tipo ${typeLabel}.`;
  }

  return `Este node trabalha com um ${typeLabel} contendo ${topLevelKeys.length} campo(s) principais: ${topLevelKeys.join(", ")}.`;
}

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
        <div key={key}>
          <div className="flex items-start gap-2 py-0.5">
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
          {value.properties ? (
            <SchemaTree
              schema={{ type: value.type, properties: value.properties }}
              depth={depth + 1}
            />
          ) : null}
          {value.items?.properties ? (
            <SchemaTree
              schema={{ type: value.items.type, properties: value.items.properties }}
              depth={depth + 1}
            />
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
  field: NodeConfigField | NodeParameterField;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = "options" in field ? field.options : undefined;

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
        {options?.map((option) => (
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

function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-[#7d8590]">
        {icon}
        <span>{title}</span>
      </div>
      {subtitle ? <p className="text-[11px] leading-relaxed text-[#7d8590]">{subtitle}</p> : null}
    </div>
  );
}

function PresetButton({
  preset,
  onApply,
}: {
  preset: NodePreset;
  onApply: () => void;
}) {
  return (
    <button
      onClick={onApply}
      className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-left transition-colors hover:border-[#58a6ff] hover:bg-[#11161d]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-[#e6edf3]">{preset.title}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
            {preset.description}
          </div>
        </div>
        {preset.recommended ? (
          <span className="rounded border border-[#3fb95033] bg-[#3fb95014] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
            Recommended
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ActionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#21262d] bg-[#0d1117] p-3">
      <div className="mb-2">
        <div className="text-[11px] font-medium text-[#e6edf3]">{title}</div>
        <div className="mt-0.5 text-[10px] leading-relaxed text-[#7d8590]">{description}</div>
      </div>
      {children}
    </div>
  );
}

function DocList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item}
          className="rounded border border-[#21262d] bg-[#11161d] px-3 py-2 text-[11px] leading-relaxed text-[#7d8590]"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function getTriggerSimulationSource(nodeType: string): WorkflowTriggerSource {
  if (nodeType === "trigger_webhook") return "webhook";
  if (nodeType === "trigger_schedule") return "schedule";
  return "manual";
}

type TriggerTestState = {
  status: "idle" | "running" | "success" | "error";
  message?: string;
  responseStatus?: number;
  responseBody?: string;
  outputPreview?: unknown;
};

export function NodeConfigPanel() {
  const activeWorkflow = useActiveWorkflow();
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);
  const updateNodeParameters = useFlowStore((state) => state.updateNodeParameters);
  const duplicateNode = useFlowStore((state) => state.duplicateNode);
  const deleteNode = useFlowStore((state) => state.deleteNode);
  const runWorkflow = useFlowStore((state) => state.runWorkflow);
  const runtimeBaseUrl = useFlowStore((state) => state.runtimeBaseUrl);
  const [panelMode, setPanelMode] = useState<"simple" | "test" | "advanced" | "docs">("simple");
  const [triggerTestPayload, setTriggerTestPayload] = useState("{}");
  const [triggerTestState, setTriggerTestState] = useState<TriggerTestState>({
    status: "idle",
  });
  const [copiedExpression, setCopiedExpression] = useState("");

  const node = useMemo(
    () => activeWorkflow?.nodes.find((item) => item.id === selectedNodeId),
    [activeWorkflow?.nodes, selectedNodeId],
  );

  const programmingContext = useMemo(() => {
    if (!activeWorkflow || !node) {
      return {
        inputSchema: undefined,
        inputPreview: undefined,
        javascriptCompletions: [],
        jsonCompletions: [],
      };
    }

    return inferNodeProgrammingContext(activeWorkflow, node.id);
  }, [activeWorkflow, node]);

  const incomingNodes = useMemo(() => {
    if (!activeWorkflow || !node) return [];
    return getActiveIncomingNodes(activeWorkflow, node.id);
  }, [activeWorkflow, node]);

  const semanticState = useMemo(() => {
    if (!activeWorkflow || !node) return null;
    return getNodeSemanticState(activeWorkflow, node.id);
  }, [activeWorkflow, node]);

  const presets = useMemo(
    () => (node ? getNodePresets(node.data.nodeType) : []),
    [node],
  );
  const documentation = useMemo(
    () => (node ? getNodeDocumentation(node.data.nodeType) : null),
    [node],
  );

  const flowFields = useMemo(
    () => getFlowFieldShortcuts(programmingContext.inputSchema, programmingContext.inputPreview),
    [programmingContext.inputPreview, programmingContext.inputSchema],
  );

  const programmingRecipes = useMemo(
    () => buildProgrammingRecipes(coerceTextValue(node?.data.label, "Node"), flowFields),
    [flowFields, node?.data.label],
  );

  const outputStory = useMemo(
    () => buildOutputStory(node?.data.runtime?.outputPreview),
    [node?.data.runtime?.outputPreview],
  );

  useEffect(() => {
    if (!node) return;
    const mode = ensureProgrammableConfig(
      node.data.programmable,
      node.data.nodeType,
    ).mode;
    setPanelMode((currentMode) => {
      if (currentMode === "docs") {
        return "docs";
      }
      if (!node.data.nodeType.startsWith("trigger_") && currentMode === "test") {
        return mode === "code" ? "advanced" : "simple";
      }
      return currentMode === "advanced" || currentMode === "test"
        ? currentMode
        : mode === "code"
          ? "advanced"
          : "simple";
    });
    if (node.data.nodeType.startsWith("trigger_")) {
      setTriggerTestPayload(
        buildTriggerTestPayload(
          activeWorkflow,
          node,
          getTriggerSimulationSource(node.data.nodeType),
        ),
      );
      setTriggerTestState({ status: "idle" });
    }
  }, [node?.id, node?.data.config?.testPayload]);

  useEffect(() => {
    if (!copiedExpression) return undefined;
    const timeout = window.setTimeout(() => setCopiedExpression(""), 1200);
    return () => window.clearTimeout(timeout);
  }, [copiedExpression]);

  if (!node) return null;

  const programmable = ensureProgrammableConfig(
    node.data.programmable,
    node.data.nodeType,
  );
  const nodeMeta = nodeCatalogMap[node.data.nodeType];
  const displayProgramCode =
    programmable.mode === "builtin" ? getBuiltinCodePreview(node) : programmable.code;
  const configFields = getNodeConfigFields(node.data.nodeType);
  const allParameterFields = parameterDefaults[node.data.nodeType] ?? [];
  const hideLegacyParameters =
    programmable.mode === "code" &&
    (node.data.nodeType === "action_if" ||
      node.data.nodeType === "action_switch" ||
      node.data.nodeType === "action_code" ||
      node.data.nodeType === "action_function");
  const parameterFields =
    configFields.length || hideLegacyParameters
      ? []
      : allParameterFields.filter((field) => {
          if (node.data.nodeType !== "action_switch") return true;
          if (!field.label.startsWith("Case ")) return true;

          const currentValue = coerceTextValue(node.data.parameters?.[field.label]);
          return currentValue.trim() !== "";
        });
  const showJsonSnapshot =
    panelMode === "advanced" &&
    configFields.length === 0 &&
    parameterFields.length === 0 &&
    !node.data.nodeType.startsWith("viz_") &&
    node.data.nodeType !== "viz_dashboard";
  const webhookPath =
    node.data.nodeType === "trigger_webhook"
      ? coerceTextValue(node.data.parameters?.Path)
      : "";
  const normalizedWebhookPath = webhookPath
    ? webhookPath.startsWith("/")
      ? webhookPath
      : `/${webhookPath}`
    : `/webhooks/${activeWorkflow?.id}/${node.id}`;
  const webhookUrl =
    node.data.nodeType === "trigger_webhook" && runtimeBaseUrl
      ? `${runtimeBaseUrl}${normalizedWebhookPath}`
      : null;
  const isTriggerNode = node.data.nodeType.startsWith("trigger_");
  const triggerSource = getTriggerSimulationSource(node.data.nodeType);
  const hasDownstreamNodes = Boolean(
    activeWorkflow?.edges.some((edge) => edge.source === node.id),
  );
  const disableButtonLabel = semanticState?.autoBlocked
    ? "Bloqueado pelo fluxo"
    : semanticState?.manuallyDisabled && !semanticState.canManuallyEnable
      ? "Sem entrada para ativar"
      : node.data.disabled
        ? "Ativar"
        : "Desativar";
  const disableButtonDisabled = Boolean(
    semanticState?.autoBlocked ||
      (semanticState?.manuallyDisabled && !semanticState.canManuallyEnable),
  );

  const applyPreset = (preset: NodePreset) => {
    const patch = applyNodePreset(node.data, preset);
    updateNodeData(node.id, {
      ...patch,
      programmable: preset.programmable
        ? {
            ...programmable,
            ...preset.programmable,
          }
        : patch.programmable,
    });
  };

  const applyProgrammingRecipe = (recipe: (typeof programmingRecipes)[number]) => {
    updateNodeData(node.id, {
      programmable: {
        ...programmable,
        mode: "code",
        code: recipe.code,
        outputTemplate: recipe.outputTemplate ?? programmable.outputTemplate,
      },
    });
    setPanelMode("advanced");
  };

  const copyExpression = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedExpression(value);
    } catch {
      setCopiedExpression("");
    }
  };

  const runTriggerTest = async () => {
    let payload: Record<string, unknown> = {};

    try {
      payload = triggerTestPayload.trim()
        ? (JSON.parse(triggerTestPayload) as Record<string, unknown>)
        : {};
    } catch {
      setTriggerTestState({
        status: "error",
        message: "Invalid JSON payload. Fix the payload before running the trigger test.",
      });
      return;
    }

    setTriggerTestState({
      status: "running",
      message: "Running trigger simulation...",
    });

    updateNodeConfig(node.id, {
      testPayload: payload,
    });

    const result = await runWorkflow({
      source: triggerSource,
      triggerNodeId: node.id,
      payload,
    });

    if (!result) {
      setTriggerTestState({
        status: "error",
        message: "Workflow execution failed during trigger simulation.",
      });
      return;
    }

    const triggerSnapshot = result.nodeSnapshots[node.id];
    setTriggerTestState({
      status: result.executionStatus === "success" ? "success" : "error",
      message:
        triggerSnapshot?.summary ??
        `Simulated ${coerceTextValue(node.data.label, "trigger")} successfully.`,
      responseStatus: result.response?.status,
      responseBody: result.response?.body,
      outputPreview: triggerSnapshot?.outputPreview,
    });
  };

  const handleToggleDisabled = () => {
    if (!semanticState) return;
    if (semanticState.autoBlocked) return;
    if (semanticState.manuallyDisabled && !semanticState.canManuallyEnable) return;

    updateNodeData(node.id, {
      disabled: !node.data.disabled,
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="absolute right-0 top-0 z-40 flex flex-col border-l border-[#30363d]"
        style={{ width: 380, background: "#161b22", bottom: 0 }}
      >
        <div className="space-y-3 border-b border-[#30363d] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5 text-[#7d8590]" />
              <div className="flex items-center gap-2">
                <div>
                  <div className="text-xs font-medium text-[#e6edf3]">
                    {coerceTextValue(node.data.label, "Node sem nome")}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                    {coerceTextValue(node.data.badge)} · {nodeMeta.label}
                  </div>
                </div>
                <button
                  onClick={() => setPanelMode((currentMode) => (currentMode === "docs" ? "simple" : "docs"))}
                  title={panelMode === "docs" ? "Fechar documentacao" : "Abrir documentacao"}
                  className={`rounded border px-2 py-1 transition-colors ${
                    panelMode === "docs"
                      ? "border-[#58a6ff55] bg-[#1f6feb18] text-[#58a6ff]"
                      : "border-[#30363d] bg-[#0d1117] text-[#7d8590] hover:text-[#e6edf3]"
                  }`}
                >
                  {panelMode === "docs" ? (
                    <BookOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Book className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-[#7d8590] transition-colors hover:text-[#e6edf3]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-1">
            <div className={`grid gap-1 ${isTriggerNode ? "grid-cols-3" : "grid-cols-2"}`}>
              <button
                onClick={() => setPanelMode("simple")}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  panelMode === "simple"
                    ? "bg-[#1f6feb] text-white"
                    : "text-[#7d8590] hover:bg-[#161b22] hover:text-[#e6edf3]"
                }`}
              >
                Configuração
              </button>
              {isTriggerNode ? (
                <button
                  onClick={() => setPanelMode("test")}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    panelMode === "test"
                      ? "bg-[#1f6feb] text-white"
                      : "text-[#7d8590] hover:bg-[#161b22] hover:text-[#e6edf3]"
                  }`}
                >
                    Testar
                </button>
              ) : null}
              <button
                onClick={() => setPanelMode("advanced")}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  panelMode === "advanced"
                    ? "bg-[#1f6feb] text-white"
                    : "text-[#7d8590] hover:bg-[#161b22] hover:text-[#e6edf3]"
                }`}
              >
                Avançado
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {panelMode === "docs" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <SectionTitle
                  title="Documentacao do Node"
                  subtitle="Guia completo para entender o papel deste node, como ele conversa com o fluxo e quais contratos ele deve consumir e emitir."
                  icon={<BookOpen className="h-3.5 w-3.5 text-[#58a6ff]" />}
                />

                <ActionCard
                  title="Papel deste node"
                  description="Resumo funcional, categoria e identidade tecnica."
                >
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1 text-[10px] text-[#e6edf3]">
                      Tipo tecnico: {node.data.nodeType}
                    </div>
                    <div className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1 text-[10px] text-[#e6edf3]">
                      Categoria: {NODE_CATEGORY_LABELS[nodeMeta.category] ?? nodeMeta.category}
                    </div>
                    <div className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1 text-[10px] text-[#e6edf3]">
                      Shell: {nodeMeta.shellType}
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] leading-relaxed text-[#7d8590]">
                    {documentation?.overview}
                  </div>
                </ActionCard>

                <ActionCard title="Quando usar" description="Situacoes em que este node normalmente e a melhor escolha.">
                  <DocList items={documentation?.whenToUse ?? []} />
                </ActionCard>

                <ActionCard
                  title="Quando evitar"
                  description="Sinais de que outro node, outra topologia ou outra etapa pode fazer mais sentido."
                >
                  <DocList items={documentation?.avoidWhen ?? []} />
                </ActionCard>

                <ActionCard title="Entrada e saida" description="Como este node deve ler o upstream e o que ele passa para frente.">
                  <div className="space-y-2">
                    <div className="rounded border border-[#21262d] bg-[#11161d] px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#58a6ff]">Recebe</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">{documentation?.receives}</div>
                    </div>
                    <div className="rounded border border-[#21262d] bg-[#11161d] px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">Emite</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">{documentation?.emits}</div>
                    </div>
                  </div>
                </ActionCard>

                <ActionCard title="Topologia recomendada" description="Encadeamentos que costumam funcionar bem com este node.">
                  <DocList items={documentation?.topology ?? []} />
                </ActionCard>

                <ActionCard title="Exemplos e casos de uso" description="Exemplos reais para growth, produto, financeiro, monitoramento e operacao.">
                  <DocList items={documentation?.examples ?? []} />
                </ActionCard>

                <ActionCard title="Boas praticas" description="Cuidados para manter o fluxo legivel, robusto e semanticamente correto.">
                  <DocList items={documentation?.tips ?? []} />
                </ActionCard>

                <ActionCard title="Programacao do node" description="Como pensar o modo avancado e a passagem de dados neste bloco.">
                  <div className="text-[11px] leading-relaxed text-[#7d8590]">{documentation?.programming}</div>
                </ActionCard>

                <ActionCard title="Parametros e campos rapidos" description="Tudo o que pode ser ajustado sem escrever codigo.">
                  {configFields.length === 0 && allParameterFields.length === 0 ? (
                    <div className="text-[11px] leading-relaxed text-[#7d8590]">
                      Este node nao expoe campos rapidos. Quando precisar de logica customizada, use o modo Avancado.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {configFields.map((field) => (
                        <div key={`doc-config-${field.key}`} className="rounded border border-[#21262d] bg-[#11161d] px-3 py-2">
                          <div className="text-[11px] font-medium text-[#e6edf3]">{field.label}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-[#7d8590]">
                            {field.placeholder || "Campo de configuracao deste node."}
                          </div>
                        </div>
                      ))}
                      {allParameterFields.map((field) => (
                        <div key={`doc-param-${field.label}`} className="rounded border border-[#21262d] bg-[#11161d] px-3 py-2">
                          <div className="text-[11px] font-medium text-[#e6edf3]">{field.label}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-[#7d8590]">
                            {"helpText" in field && field.helpText ? field.helpText : field.placeholder || "Parametro configuravel deste node."}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ActionCard>

                <ActionCard title="Schema de referencia" description="Contrato declarado pelo node para leitura rapida da entrada e da saida.">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[#58a6ff]">Entrada</div>
                      <div className="text-[11px] leading-relaxed text-[#7d8590]">
                        {describeSchema(
                          node.data.schema?.input,
                          isTriggerNode
                            ? "Este trigger inicia o fluxo e nao depende de node anterior."
                            : "Este node nao declara um schema fixo de entrada; use o preview do upstream como referencia viva.",
                        )}
                      </div>
                      {node.data.schema?.input ? <div className="mt-2"><SchemaTree schema={node.data.schema.input} /></div> : null}
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[#3fb950]">Saida</div>
                      <div className="text-[11px] leading-relaxed text-[#7d8590]">
                        {describeSchema(
                          node.data.schema?.output,
                          "Este node nao declara schema fixo de saida; use o runtime preview e o modo avancado como contrato real.",
                        )}
                      </div>
                      {node.data.schema?.output ? <div className="mt-2"><SchemaTree schema={node.data.schema.output} /></div> : null}
                    </div>
                  </div>
                </ActionCard>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
            <SectionTitle
              title="Básico do Node"
              subtitle="Dê um nome claro e um propósito curto para este bloco continuar legível no canvas."
            />

            <div className="space-y-1">
              <label className="text-[10px] text-[#7d8590]">Nome</label>
              <input
                value={coerceTextValue(node.data.label)}
                onChange={(event) => updateNodeData(node.id, { label: event.target.value })}
                className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors focus:border-[#1f6feb]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#7d8590]">Descrição</label>
              <textarea
                rows={3}
                value={coerceTextValue(node.data.description)}
                onChange={(event) =>
                  updateNodeData(node.id, { description: event.target.value })
                }
                className="w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors focus:border-[#1f6feb]"
              />
            </div>
          </div>

          {semanticState ? (
            <div className="space-y-3">
              <SectionTitle
                title="Estado no Fluxo"
                subtitle="Mostra se este node esta ativo, desligado manualmente ou bloqueado porque nao recebe mais entrada ativa."
                icon={<Power className="h-3.5 w-3.5 text-[#d29922]" />}
              />

              <ActionCard
                title={
                  semanticState.manuallyDisabled
                    ? "Desativado manualmente"
                    : semanticState.autoBlocked
                      ? "Bloqueado pelo fluxo"
                      : "Ativo"
                }
                description={semanticState.reason}
              >
                <div className="flex flex-wrap gap-2">
                  <div className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1 text-[10px] text-[#e6edf3]">
                    {semanticState.activeIncomingCount}/{semanticState.rawIncomingCount} entrada(s) ativa(s)
                  </div>
                  <div className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1 text-[10px] text-[#e6edf3]">
                    {semanticState.activeOutgoingCount}/{semanticState.rawOutgoingCount} saida(s) ativa(s)
                  </div>
                  <div className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1 text-[10px] text-[#e6edf3]">
                    {semanticState.isRoot ? "Ponto de entrada" : "Dependente de nodes anteriores"}
                  </div>
                </div>
              </ActionCard>
            </div>
          ) : null}

          {presets.length > 0 ? (
            <div className="space-y-3">
              <SectionTitle
                title="Presets Rápidos"
                subtitle="Escolha uma configuração pronta e ajuste só os campos que realmente importam."
                icon={<Sparkles className="h-3.5 w-3.5 text-[#3fb950]" />}
              />
              <div className="space-y-2">
                {presets.map((preset) => (
                  <PresetButton
                    key={preset.id}
                    preset={preset}
                    onApply={() => applyPreset(preset)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <SectionTitle
              title="Dados Conectados"
              subtitle="Este resumo mostra o que este node já está recebendo dos blocos anteriores."
            />

            {incomingNodes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {incomingNodes.map((item) => (
                  <span
                    key={item.id}
                    className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-[10px] text-[#e6edf3]"
                  >
                    {coerceTextValue(item.data.label, item.data.nodeType)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[11px] text-[#7d8590]">
                Ainda não há nodes anteriores. Conecte alguma coisa primeiro e este painel vai sugerir padrões melhores.
              </div>
            )}

            {flowFields.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {flowFields.slice(0, 10).map((field) => (
                  <button
                    key={field.path}
                    onClick={() => void copyExpression(field.expression)}
                    className="rounded border border-[#1f6feb33] bg-[#1f6feb14] px-2 py-1 text-left transition-colors hover:border-[#58a6ff] hover:bg-[#1f6feb1f]"
                  >
                    <div className="font-mono text-[10px] text-[#58a6ff]">{field.path}</div>
                    <div className="text-[9px] text-[#7d8590]">{field.sample}</div>
                  </button>
                ))}
              </div>
            ) : null}

            {node.data.runtime?.summary ? (
              <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[11px] leading-relaxed text-[#7d8590]">
                <span className="font-medium text-[#e6edf3]">Última execução:</span>{" "}
                {node.data.runtime.summary}
              </div>
              ) : null}
          </div>

          <div className="space-y-3">
            <SectionTitle
              title="Fluxo de Dados"
              subtitle="Leia este node em 3 passos simples: o que entra, o que você usa e o que sai."
            />

            <ActionCard
              title="1. Este node está recebendo"
              description="Estes são os campos detectados a partir dos blocos anteriores."
            >
              {flowFields.length ? (
                <div className="flex flex-wrap gap-2">
                  {flowFields.slice(0, 8).map((field) => (
                    <div
                      key={field.path}
                      className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1.5"
                    >
                      <div className="font-mono text-[10px] text-[#e6edf3]">{field.path}</div>
                      <div className="text-[9px] text-[#7d8590]">{field.sample}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-[#7d8590]">
                  Execute este fluxo uma vez ou conecte um node anterior e os campos vão aparecer aqui.
                </div>
              )}
            </ActionCard>

            <ActionCard
              title="2. Você pode usar estas expressões"
              description="Clique em qualquer expressão para copiar. Depois cole em condições, configurações ou lógica customizada."
            >
              {flowFields.length ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {flowFields.slice(0, 8).map((field) => (
                      <button
                        key={field.expression}
                        onClick={() => void copyExpression(field.expression)}
                        className="rounded border border-[#3fb95033] bg-[#3fb95014] px-2 py-1 font-mono text-[10px] text-[#7ee787] transition-colors hover:bg-[#3fb9501f]"
                      >
                        {field.expression}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-[#7d8590]">
                    {copiedExpression ? "Expressão copiada." : "Dica: use os nomes dos campos exatamente como aparecem aqui."}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-[#7d8590]">
                  Ainda não há expressões porque este node ainda não tem entrada detectada.
                </div>
              )}
            </ActionCard>

            <ActionCard
              title="3. Este node está enviando"
              description="Esta é a estrutura do dado que está indo para o próximo node agora."
            >
              <div className="text-[11px] leading-relaxed text-[#7d8590]">{outputStory.summary}</div>
              {outputStory.fields.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {outputStory.fields.map((field) => (
                    <div
                      key={field.key}
                      className="rounded border border-[#30363d] bg-[#11161d] px-2 py-1.5"
                    >
                      <div className="font-mono text-[10px] text-[#e6edf3]">{field.key}</div>
                      <div className="text-[9px] text-[#7d8590]">{field.sample}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </ActionCard>
          </div>

          {panelMode === "test" && isTriggerNode ? (
            <div className="space-y-3">
              <SectionTitle
                title="Teste do Trigger"
                subtitle="Simule um evento real chegando por este trigger, mesmo que ainda não exista nada conectado."
                icon={<Play className="h-3.5 w-3.5 text-[#3fb950]" />}
              />

              <div className="rounded border border-[#21262d] bg-[#0d1117] px-3 py-2 text-[11px] leading-relaxed text-[#7d8590]">
                Isto envia um evento simulado do tipo
                <span className="mx-1 font-mono text-[#e6edf3]">{triggerSource}</span>
                direto para este trigger e executa o workflow a partir daqui.
              </div>

              {!hasDownstreamNodes ? (
                <div className="rounded border border-[#d2992233] bg-[#d2992212] px-3 py-2 text-[11px] leading-relaxed text-[#d29922]">
                  Ainda não há nodes seguintes. Mesmo assim você já pode testar este trigger agora para validar payload,
                  tags e prévias do runtime antes de montar o resto do fluxo.
                </div>
              ) : null}

              {webhookUrl ? (
                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">URL do Webhook</label>
                  <div className="rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-2 font-mono text-[11px] text-[#e6edf3]">
                    {webhookUrl}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="text-[10px] text-[#7d8590]">JSON Simulado</label>
                <textarea
                  rows={12}
                  value={triggerTestPayload}
                  onChange={(event) => setTriggerTestPayload(event.target.value)}
                  className="h-48 w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 font-mono text-[11px] text-[#e6edf3] outline-none transition-colors focus:border-[#1f6feb]"
                />
              </div>

              <button
                onClick={() => void runTriggerTest()}
                disabled={triggerTestState.status === "running"}
                className="flex w-full items-center justify-center gap-2 rounded border border-[#3fb95033] bg-[#3fb95014] px-3 py-2 text-[11px] font-medium text-[#3fb950] transition-colors hover:bg-[#3fb9501f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {triggerTestState.status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Executar Teste do Trigger
              </button>

              {triggerTestState.message ? (
                <div
                  className={`rounded border px-3 py-2 text-[11px] leading-relaxed ${
                    triggerTestState.status === "error"
                      ? "border-[#f8514933] bg-[#f8514912] text-[#f85149]"
                      : triggerTestState.status === "success"
                        ? "border-[#3fb95033] bg-[#3fb95012] text-[#7ee787]"
                        : "border-[#30363d] bg-[#0d1117] text-[#7d8590]"
                  }`}
                >
                  {triggerTestState.message}
                </div>
              ) : null}

              <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">Prévia de Saída do Trigger</label>
                <textarea
                  readOnly
                  value={JSON.stringify(
                    triggerTestState.outputPreview ?? node.data.runtime?.outputPreview ?? {},
                    null,
                    2,
                  )}
                  className="h-28 w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 font-mono text-[10px] text-[#e6edf3] outline-none"
                />
              </div>

              {triggerTestState.responseStatus ? (
                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">Resposta no Estilo Webhook</label>
                  <textarea
                    readOnly
                    value={JSON.stringify(
                      {
                        status: triggerTestState.responseStatus,
                        body: triggerTestState.responseBody ?? "",
                      },
                      null,
                      2,
                    )}
                    className="h-24 w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 font-mono text-[10px] text-[#e6edf3] outline-none"
                  />
                </div>
              ) : null}
            </div>
          ) : (configFields.length > 0 || parameterFields.length > 0 || webhookUrl) && (
            <div className="space-y-3">
              <SectionTitle
                title="Configuração Rápida"
                subtitle="Preencha só o essencial. Tudo aqui foi pensado para ser plug-and-play."
              />

              {configFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">{field.label}</label>
                  <ConfigFieldControl
                    field={field}
                    value={String(node.data.config?.[field.key] ?? "")}
                    onChange={(value) => updateNodeConfig(node.id, { [field.key]: value })}
                  />
                </div>
              ))}

              {parameterFields.map((field) => {
                const helpText = "helpText" in field ? field.helpText : undefined;
                return (
                  <div key={field.label} className="space-y-1">
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-[#7d8590]">{field.label}</label>
                      {helpText ? (
                        <div className="text-[10px] leading-relaxed text-[#3d444d]">
                          {helpText}
                        </div>
                      ) : null}
                    </div>
                    <ConfigFieldControl
                      field={field}
                      value={coerceTextValue(node.data.parameters?.[field.label])}
                      onChange={(value) => updateNodeParameters(node.id, field.label, value)}
                    />
                  </div>
                );
              })}

              {webhookUrl ? (
                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">URL do Webhook</label>
                  <div className="rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-2 font-mono text-[11px] text-[#e6edf3]">
                    {webhookUrl}
                  </div>
                </div>
              ) : null}

              {showJsonSnapshot ? (
                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">Configuração JSON</label>
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
          )}

          {panelMode === "advanced" ? (
            <>
              <div className="space-y-3 border-t border-[#21262d] pt-4">
                <SectionTitle
                  title="Runtime Programável"
                  subtitle="Use isto quando você quiser transformar o dado recebido antes de enviar para frente."
                  icon={<Braces className="h-3.5 w-3.5 text-[#58a6ff]" />}
                />

                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">Modo do Runtime</label>
                  <select
                    value={programmable.mode}
                    onChange={(event) =>
                      updateNodeData(node.id, {
                        programmable: {
                          ...programmable,
                          mode: event.target.value as typeof programmable.mode,
                          code:
                            event.target.value === "code" && programmable.mode === "builtin"
                              ? getBuiltinCodePreview(node)
                              : programmable.code,
                        },
                      })
                    }
                    className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors focus:border-[#1f6feb]"
                  >
                    <option value="builtin">Usar comportamento nativo</option>
                    <option value="code">Usar código customizado</option>
                  </select>
                </div>

                <div className="rounded border border-[#21262d] bg-[#0d1117] px-3 py-2 text-[11px] leading-relaxed text-[#7d8590]">
                  Modelo mental:
                  <span className="mx-1 font-mono text-[#e6edf3]">input.first</span>
                  é o que chegou do node anterior.
                  <span className="mx-1 font-mono text-[#e6edf3]">return result</span>
                  é o que você envia para o próximo node.
                  Você pode alterar, remover ou criar qualquer campo no meio. Retorne
                  <span className="mx-1 font-mono text-[#e6edf3]">
                    {"{ result, route, summary }"}
                  </span>
                  or
                  <span className="mx-1 font-mono text-[#e6edf3]">
                    {"{ routes: { case_1: ... } }"}
                  </span>
                  .
                </div>

                {programmingRecipes.length ? (
                  <div className="space-y-2">
                    <label className="text-[10px] text-[#7d8590]">Receitas Iniciais</label>
                    <div className="space-y-2">
                      {programmingRecipes.map((recipe) => (
                        <button
                          key={recipe.id}
                          onClick={() => applyProgrammingRecipe(recipe)}
                          className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-left transition-colors hover:border-[#58a6ff] hover:bg-[#11161d]"
                        >
                          <div className="text-[11px] font-medium text-[#e6edf3]">{recipe.title}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-[#7d8590]">
                            {recipe.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {flowFields.length ? (
                  <div className="space-y-2">
                    <label className="text-[10px] text-[#7d8590]">Atalhos de Campos</label>
                    <div className="flex flex-wrap gap-2">
                      {flowFields.slice(0, 12).map((field) => (
                        <button
                          key={`advanced-${field.path}`}
                          onClick={() => void copyExpression(field.expression)}
                          className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-left transition-colors hover:border-[#58a6ff] hover:bg-[#11161d]"
                        >
                          <div className="font-mono text-[10px] text-[#58a6ff]">{field.path}</div>
                          <div className="text-[9px] text-[#7d8590]">{field.sample}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">Lógica do Programa</label>
                  <ProgrammableEditor
                    modelPath={`inmemory://model/${node.id}/logic.js`}
                    language="javascript"
                    value={displayProgramCode}
                    height={220}
                    suggestions={programmingContext.javascriptCompletions}
                    onChange={(value) =>
                      updateNodeData(node.id, {
                        programmable: {
                          ...programmable,
                          code: value,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-3.5 w-3.5 text-[#3fb950]" />
                    <label className="text-[10px] text-[#7d8590]">JSON de Saída</label>
                  </div>
                  <ProgrammableEditor
                    modelPath={`inmemory://model/${node.id}/output.json`}
                    language="json"
                    value={programmable.outputTemplate}
                    height={180}
                    suggestions={programmingContext.jsonCompletions}
                    onChange={(value) =>
                      updateNodeData(node.id, {
                        programmable: {
                          ...programmable,
                          outputTemplate: value,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-[#21262d] pt-4">
                <SectionTitle
                  title="Contrato de Entrada"
                  subtitle="Inspecione o schema detectado e o último payload que entrou neste node."
                />

                {programmingContext.inputSchema ? (
                  <SchemaTree schema={programmingContext.inputSchema} />
                ) : (
                  <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[11px] text-[#7d8590]">
                    Ainda não existe schema detectado na entrada. Conecte este node ou execute o workflow para capturar uma prévia.
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">Prévia de Entrada</label>
                  <textarea
                    readOnly
                    value={JSON.stringify(
                      programmingContext.inputPreview ?? node.data.runtime?.inputPreview ?? {},
                      null,
                      2,
                    )}
                    className="h-24 w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 font-mono text-[10px] text-[#e6edf3] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#7d8590]">Última Prévia de Saída</label>
                  <textarea
                    readOnly
                    value={JSON.stringify(node.data.runtime?.outputPreview ?? {}, null, 2)}
                    className="h-24 w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 font-mono text-[10px] text-[#e6edf3] outline-none"
                  />
                </div>

                {node.data.schema?.output ? (
                  <div>
                    <div className="mb-1 text-[10px] text-[#3fb950]">Schema de Saída Declarado</div>
                    <SchemaTree schema={node.data.schema.output} />
                  </div>
                ) : null}
              </div>

              <div className="space-y-1 border-t border-[#21262d] pt-4">
                <SectionTitle title="Notas" subtitle="Documentação opcional para você ou para o time no futuro." />
                <textarea
                  rows={4}
                  value={String(node.data.notes ?? "")}
                  onChange={(event) => updateNodeData(node.id, { notes: event.target.value })}
                  placeholder="Documente o que este node faz..."
                  className="w-full resize-none rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none transition-colors placeholder:text-[#3d444d] focus:border-[#1f6feb]"
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-3 py-2.5 text-[11px] leading-relaxed text-[#7d8590]">
              Quer controle total? Vá para <span className="font-medium text-[#e6edf3]">Avançado</span> para
              escrever código customizado, inspecionar payloads brutos e montar o JSON de saída manualmente.
            </div>
          )}
          {node.data.nodeType === "action_terminal" ? (
            <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-3 py-2.5 text-[11px] leading-relaxed text-[#7d8590]">
              O terminal vivo fica no proprio node do canvas. Use este painel apenas para shell,
              diretorio, command e outras configuracoes.
            </div>
          ) : null}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-[#30363d] px-4 py-3">
          <button
            onClick={handleToggleDisabled}
            disabled={disableButtonDisabled}
            title={semanticState?.reason}
            className="flex items-center justify-center gap-1.5 rounded border border-[#30363d] px-2 py-1.5 text-[11px] text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Power className="h-3 w-3" />
            {disableButtonLabel}
          </button>
          <button
            onClick={() => duplicateNode(node.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#30363d] px-2 py-1.5 text-[11px] text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            <Copy className="h-3 w-3" />
            Duplicar
          </button>
          <button
            onClick={() => deleteNode(node.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#f8514930] px-2 py-1.5 text-[11px] text-[#f85149] transition-colors hover:bg-[#f8514910]"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
