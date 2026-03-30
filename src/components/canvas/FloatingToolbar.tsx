"use client";

import { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  LoaderCircle,
  LogOut,
  Plus,
  Play,
  RefreshCw,
  Save,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { useActiveProject, useActiveWorkflow, useFlowStore } from "@/store/useFlowStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { AppUpdateState, Project, Workflow } from "@/lib/flow-types";

function describeUpdateState(state: AppUpdateState) {
  switch (state) {
    case "checking":
      return "Verificando updates";
    case "available":
      return "Update disponivel";
    case "downloading":
      return "Baixando update";
    case "ready_to_install":
      return "Pronto para aplicar";
    case "installing":
      return "Aplicando update";
    case "error":
      return "Falha no update";
    case "disabled":
      return "Updater desativado";
    default:
      return "Atualizado";
  }
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const activeProject = useActiveProject();
  const activeWorkflow = useActiveWorkflow();
  const deepseekKey = useFlowStore((state) => state.deepseekKey);
  const setDeepseekKey = useFlowStore((state) => state.setDeepseekKey);
  const updateProject = useFlowStore((state) => state.updateProject);
  const updateWorkflow = useFlowStore((state) => state.updateWorkflow);
  const updater = useFlowStore((state) => state.updater);
  const setReleaseChannel = useFlowStore((state) => state.setReleaseChannel);
  const setAutoUpdateEnabled = useFlowStore((state) => state.setAutoUpdateEnabled);
  const checkForUpdates = useFlowStore((state) => state.checkForUpdates);
  const downloadAvailableUpdate = useFlowStore((state) => state.downloadAvailableUpdate);
  const installReadyUpdate = useFlowStore((state) => state.installReadyUpdate);
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const [value, setValue] = useState(deepseekKey);
  const [projectName, setProjectName] = useState(activeProject?.name ?? "");
  const [projectAccent, setProjectAccent] = useState(activeProject?.accent ?? "#1f6feb");
  const [workflowName, setWorkflowName] = useState(activeWorkflow?.name ?? "");
  const [workflowAccent, setWorkflowAccent] = useState(activeWorkflow?.accent ?? "#1f6feb");

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="fc-panel w-[460px] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#e6edf3]">Settings</div>
            <div className="text-[11px] text-[#7d8590]">Configuracao da IA, projeto e workflow atual</div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#7d8590] hover:bg-[#21262d] hover:text-[#e6edf3]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
            DeepSeek API Key
          </label>
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="sk-..."
            className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-[#e6edf3] outline-none placeholder:text-[#3d444d] focus:border-[#1f6feb]"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-[#7d8590]">
            A chave fica salva so no navegador desta maquina e e usada pelo chat de IA do canvas.
          </p>
        </div>

        <div className="mt-4 space-y-3 border-t border-[#30363d] pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">Atualizacoes desktop</div>
              <div className="mt-1 text-sm font-semibold text-[#e6edf3]">
                {describeUpdateState(updater.updateState)}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
                Versao atual {updater.currentVersion || "local"}.
                {updater.pendingVersion ? ` Update pronto: ${updater.pendingVersion}.` : ""}
                {updater.availableVersion && updater.updateState !== "ready_to_install"
                  ? ` Disponivel: ${updater.availableVersion}.`
                  : ""}
              </div>
            </div>
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${
                updater.updateState === "ready_to_install"
                  ? "border-[#2f6f3e] bg-[#12261a] text-[#3fb950]"
                  : updater.updateState === "error"
                    ? "border-[#f8514933] bg-[#2a1215] text-[#f85149]"
                    : "border-[#30363d] bg-[#0d1117] text-[#7d8590]"
              }`}
            >
              {updater.releaseChannel}
            </div>
          </div>

          {!updater.enabled ? (
            <div className="rounded-md border border-[#6a4b08] bg-[#201706] px-3 py-2 text-[11px] leading-relaxed text-[#d29922]">
              Updater desktop indisponivel neste build. O app continua funcional, mas o feed de
              release nao foi configurado.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-[10px] text-[#7d8590]">Canal</span>
              <select
                value={updater.releaseChannel}
                onChange={(event) => setReleaseChannel(event.target.value as typeof updater.releaseChannel)}
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
              >
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
                <option value="internal">Internal</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-[10px] text-[#7d8590]">Comportamento</span>
              <button
                type="button"
                onClick={() => setAutoUpdateEnabled(!updater.autoUpdateEnabled)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs ${
                  updater.autoUpdateEnabled
                    ? "border-[#2f6f3e] bg-[#12261a] text-[#3fb950]"
                    : "border-[#30363d] bg-[#0d1117] text-[#7d8590]"
                }`}
              >
                <span>{updater.autoUpdateEnabled ? "Auto-update ligado" : "Auto-update desligado"}</span>
                <span className="rounded-full border border-current px-2 py-0.5 text-[10px] uppercase">
                  {updater.autoUpdateEnabled ? "ON" : "OFF"}
                </span>
              </button>
            </label>
          </div>

          {updater.feedUrls[updater.releaseChannel] ? (
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">Feed atual</div>
              <div className="mt-1 break-all font-mono text-[11px] text-[#9fb3c8]">
                {updater.feedUrls[updater.releaseChannel]}
              </div>
            </div>
          ) : null}

          {updater.lastUpdateError ? (
            <div className="rounded-md border border-[#f8514933] bg-[#2a1215] px-3 py-2 text-[11px] text-[#f85149]">
              {updater.lastUpdateError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                void checkForUpdates({ autoDownload: updater.autoUpdateEnabled });
              }}
              disabled={!updater.enabled || updater.updateState === "checking" || updater.updateState === "downloading" || updater.updateState === "installing"}
              className="flex items-center gap-2 rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d] disabled:opacity-40"
            >
              {updater.updateState === "checking" ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Verificar agora
            </button>

            {updater.updateState === "available" && !updater.autoUpdateEnabled ? (
              <button
                onClick={() => {
                  void downloadAvailableUpdate();
                }}
                className="flex items-center gap-2 rounded-md bg-[#1f6feb] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#388bfd]"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar update
              </button>
            ) : null}

            {updater.updateState === "ready_to_install" ? (
              <button
                onClick={() => {
                  void installReadyUpdate();
                }}
                className="flex items-center gap-2 rounded-md bg-[#238636] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reiniciar e aplicar
              </button>
            ) : null}
          </div>

          {updater.updateState === "downloading" ? (
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[11px] text-[#9fb3c8]">
              Baixando {updater.availableVersion ?? "nova versao"}
              {typeof updater.downloadedBytes === "number"
                ? ` • ${updater.downloadedBytes.toLocaleString("pt-BR")} bytes`
                : ""}
              {typeof updater.totalBytes === "number" && updater.totalBytes > 0
                ? ` de ${updater.totalBytes.toLocaleString("pt-BR")} bytes`
                : ""}
            </div>
          ) : null}
        </div>

        {activeProject ? (
          <div className="mt-4 space-y-3 border-t border-[#30363d] pt-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">Active Project</div>
            <div className="space-y-1">
              <label className="block text-[10px] text-[#7d8590]">Name</label>
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-[#7d8590]">Menu Color</label>
              <div className="flex items-center gap-3 rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2">
                <input
                  type="color"
                  value={projectAccent}
                  onChange={(event) => setProjectAccent(event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-[#30363d] bg-transparent p-0"
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: projectAccent }} />
                <span className="text-[11px] text-[#7d8590]">{projectAccent}</span>
              </div>
            </div>
          </div>
        ) : null}

        {activeWorkflow ? (
          <div className="mt-4 space-y-3 border-t border-[#30363d] pt-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">Active Workflow</div>
            <div className="space-y-1">
              <label className="block text-[10px] text-[#7d8590]">Name</label>
              <input
                value={workflowName}
                onChange={(event) => setWorkflowName(event.target.value)}
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-[#7d8590]">Menu Color</label>
              <div className="flex items-center gap-3 rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2">
                <input
                  type="color"
                  value={workflowAccent}
                  onChange={(event) => setWorkflowAccent(event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-[#30363d] bg-transparent p-0"
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: workflowAccent }} />
                <span className="text-[11px] text-[#7d8590]">{workflowAccent}</span>
              </div>
            </div>
          </div>
        ) : null}

        {session ? (
          <div className="mt-4 space-y-3 border-t border-[#30363d] pt-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">Local Session</div>
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">Signed in as</div>
              <div className="mt-1 text-xs font-medium text-[#e6edf3]">{session.email}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
                O acesso e local desta maquina. Ao sair, o canvas volta para a landing page segura.
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#f8514933] px-3 py-2 text-xs font-medium text-[#f85149] transition-colors hover:bg-[#f8514910]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        ) : null}

        <button
          onClick={() => {
            setDeepseekKey(value);
            if (activeProject) {
              updateProject(activeProject.id, {
                name: projectName.trim() || activeProject.name,
                accent: projectAccent,
              });
            }
            if (activeWorkflow) {
              updateWorkflow(activeWorkflow.id, {
                name: workflowName.trim() || activeWorkflow.name,
                accent: workflowAccent,
              });
            }
            onClose();
          }}
          className="mt-4 w-full rounded-md bg-[#238636] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2ea043]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ImportJsonModal({ onClose }: { onClose: () => void }) {
  const importWorkflowJson = useFlowStore((state) => state.importWorkflowJson);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="fc-panel w-[560px] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#e6edf3]">Import JSON</div>
            <div className="text-[11px] text-[#7d8590]">Cole o JSON do workflow atual.</div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#7d8590] hover:bg-[#21262d] hover:text-[#e6edf3]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            if (error) setError("");
          }}
          placeholder='{"name":"My Workflow","nodes":[],"edges":[]}'
          className="mt-4 h-72 w-full resize-none rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 font-mono text-[11px] text-[#e6edf3] outline-none placeholder:text-[#3d444d] focus:border-[#1f6feb]"
        />
        {error ? <div className="mt-2 text-[11px] text-[#f85149]">{error}</div> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const result = importWorkflowJson(raw);
              if (!result.success) {
                setError(result.error ?? "Nao foi possivel importar o JSON.");
                return;
              }
              onClose();
            }}
            className="rounded-md bg-[#238636] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2ea043]"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectDropdown({
  projects,
  workflows,
  activeProjectId,
  onClose,
}: {
  projects: Project[];
  workflows: Workflow[];
  activeProjectId: string;
  onClose: () => void;
}) {
  const setActiveProject = useFlowStore((state) => state.setActiveProject);
  const createProject = useFlowStore((state) => state.createProject);
  const deleteProject = useFlowStore((state) => state.deleteProject);
  const toggleProjectActive = useFlowStore((state) => state.toggleProjectActive);
  const executions = useFlowStore((state) => state.executions);

  return (
    <div className="fc-panel absolute left-0 top-10 z-50 w-[320px] overflow-hidden">
      <div className="border-b border-[#30363d] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
        Projects
      </div>
      <div className="max-h-[320px] overflow-y-auto py-1">
        {projects.map((project) => {
          const projectWorkflows = workflows.filter((workflow) => workflow.projectId === project.id);
          const workflowIds = new Set(projectWorkflows.map((workflow) => workflow.id));
          const projectExecutions = executions.filter((execution) => workflowIds.has(execution.workflowId));
          const errorCount = projectExecutions.filter((execution) => execution.status === "error").length;
          const isActive = project.id === activeProjectId;

          return (
            <div
              key={project.id}
              className="border-l-2 transition-colors hover:bg-[#21262d]"
              style={{
                background: isActive ? "#11161d" : "transparent",
                borderLeftColor: isActive ? "#1f6feb" : "transparent",
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveProject(project.id);
                  onClose();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveProject(project.id);
                    onClose();
                  }
                }}
                className="px-4 py-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: project.active ? project.accent ?? "#1f6feb" : "#3d444d" }}
                      />
                      <div className="truncate text-[12px] font-medium text-[#e6edf3]">{project.name}</div>
                      {isActive ? <Check className="h-3 w-3 text-[#58a6ff]" /> : null}
                    </div>
                    {project.description ? (
                      <div className="mt-1 pl-4 text-[10px] leading-relaxed text-[#7d8590]">
                        {project.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right text-[10px] text-[#7d8590]">
                    <div>{projectWorkflows.length} workflows</div>
                    <div style={{ color: project.active ? (errorCount > 0 ? "#f85149" : "#3fb950") : "#7d8590" }}>
                      {project.active
                        ? errorCount > 0
                          ? `${errorCount} errors`
                          : `${projectExecutions.length} runs`
                        : "inactive"}
                    </div>
                  </div>
                </div>
              </div>

              {isActive ? (
                <div className="border-t border-[#21262d] px-4 pb-3 pt-2">
                  <div className="flex items-center gap-2 text-[10px] text-[#7d8590]">
                    <button
                      onClick={() => toggleProjectActive(project.id)}
                      className="rounded border border-[#30363d] px-2 py-1 hover:bg-[#0d1117]"
                    >
                      {project.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => {
                        deleteProject(project.id);
                        onClose();
                      }}
                      disabled={projects.length <= 1}
                      className="rounded border border-[#f8514933] px-2 py-1 text-[#f85149] hover:bg-[#f8514910] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#30363d] p-2">
        <button
          onClick={() => {
            createProject();
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d]"
        >
          <Plus className="h-3.5 w-3.5" />
          New project
        </button>
      </div>
    </div>
  );
}

function WorkflowDropdown({
  workflows,
  activeWorkflowId,
  onClose,
}: {
  workflows: Workflow[];
  activeWorkflowId: string;
  onClose: () => void;
}) {
  const setActiveWorkflow = useFlowStore((state) => state.setActiveWorkflow);
  const createWorkflow = useFlowStore((state) => state.createWorkflow);
  const duplicateWorkflow = useFlowStore((state) => state.duplicateWorkflow);
  const deleteWorkflow = useFlowStore((state) => state.deleteWorkflow);
  const toggleWorkflowActive = useFlowStore((state) => state.toggleWorkflowActive);
  const executions = useFlowStore((state) => state.executions);

  return (
    <div className="fc-panel absolute left-0 top-10 z-50 w-[320px] overflow-hidden">
      <div className="border-b border-[#30363d] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
        Workflows
      </div>
      <div className="max-h-[340px] overflow-y-auto py-1">
        {workflows.map((workflow) => {
          const isActive = workflow.id === activeWorkflowId;
          const workflowExecutions = executions.filter((execution) => execution.workflowId === workflow.id);
          const errorCount = workflowExecutions.filter((execution) => execution.status === "error").length;

          return (
            <div
              key={workflow.id}
              className="border-l-2 transition-colors hover:bg-[#21262d]"
              style={{
                background: isActive ? "#11161d" : "transparent",
                borderLeftColor: isActive ? "#1f6feb" : "transparent",
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveWorkflow(workflow.id);
                  onClose();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveWorkflow(workflow.id);
                    onClose();
                  }
                }}
                className="px-4 py-3 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: workflow.accent ?? "#3d444d", opacity: workflow.active ? 1 : 0.45 }}
                      />
                      <div className="truncate text-[12px] font-medium text-[#e6edf3]">{workflow.name}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {workflow.tags.map((tag) => (
                        <span key={tag} className="rounded border border-[#30363d] px-1.5 py-0.5 text-[9px] text-[#7d8590]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-[#7d8590]">
                    <div>{workflow.nodes.length} nodes</div>
                    <div style={{ color: errorCount > 0 ? "#f85149" : "#3fb950" }}>
                      {errorCount > 0 ? `${errorCount} errors` : `${workflowExecutions.length} runs`}
                    </div>
                  </div>
                </div>
              </div>

              {isActive ? (
                <div className="border-t border-[#21262d] px-4 pb-3 pt-2">
                  <div className="flex items-center gap-2 text-[10px] text-[#7d8590]">
                    <button
                      onClick={() => toggleWorkflowActive(workflow.id)}
                      className="rounded border border-[#30363d] px-2 py-1 hover:bg-[#0d1117]"
                    >
                      {workflow.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => duplicateWorkflow(workflow.id)}
                      className="rounded border border-[#30363d] px-2 py-1 hover:bg-[#0d1117]"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => {
                        deleteWorkflow(workflow.id);
                        onClose();
                      }}
                      className="rounded border border-[#f8514933] px-2 py-1 text-[#f85149] hover:bg-[#f8514910]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#30363d] p-2">
        <button
          onClick={() => {
            const workflow = createWorkflow();
            setActiveWorkflow(workflow.id);
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d]"
        >
          <Plus className="h-3.5 w-3.5" />
          New workflow
        </button>
      </div>
    </div>
  );
}

export function FloatingToolbar() {
  const activeProject = useActiveProject();
  const activeWorkflow = useActiveWorkflow();
  const projects = useFlowStore((state) => state.projects);
  const workflows = useFlowStore((state) => state.workflows);
  const activeProjectId = useFlowStore((state) => state.activeProjectId);
  const activeWorkflowId = useFlowStore((state) => state.activeWorkflowId);
  const renameWorkflow = useFlowStore((state) => state.renameWorkflow);
  const setAddNodePanel = useFlowStore((state) => state.setAddNodePanel);
  const saveWorkflow = useFlowStore((state) => state.saveWorkflow);
  const runWorkflow = useFlowStore((state) => state.runWorkflow);
  const exportWorkflowJson = useFlowStore((state) => state.exportWorkflowJson);
  const setShowSettings = useFlowStore((state) => state.setShowSettings);
  const showSettings = useFlowStore((state) => state.showSettings);
  const updater = useFlowStore((state) => state.updater);
  const filteredWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.projectId === activeProjectId),
    [activeProjectId, workflows],
  );
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(activeWorkflow?.name ?? "");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showWorkflowDropdown, setShowWorkflowDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const exportWorkflow = async () => {
    const raw = exportWorkflowJson();
    if (!raw) return;

    try {
      await navigator.clipboard.writeText(raw);
      setCopiedExport(true);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedExport(false);
      }, 1600);
    } catch (error) {
      console.error("Clipboard copy failed", error);
    }
  };

  return (
    <>
      {showProjectDropdown || showWorkflowDropdown ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowProjectDropdown(false);
            setShowWorkflowDropdown(false);
          }}
        />
      ) : null}

      <div className="fc-panel absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center">
        <div className="relative">
          <button
            onClick={() => {
              setShowProjectDropdown((current) => !current);
              setShowWorkflowDropdown(false);
            }}
            className="flex items-center gap-2 border-r border-[#30363d] px-3 py-2 text-xs"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: activeProject?.active ? activeProject?.accent ?? "#1f6feb" : "#3d444d" }}
            />
            <span className="max-w-[150px] truncate font-medium text-[#e6edf3]">
              {activeProject?.name ?? "Select project"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#7d8590]" />
          </button>
          {showProjectDropdown ? (
            <ProjectDropdown
              projects={projects}
              workflows={workflows}
              activeProjectId={activeProjectId}
              onClose={() => setShowProjectDropdown(false)}
            />
          ) : null}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowWorkflowDropdown((current) => !current);
              setShowProjectDropdown(false);
            }}
            className="flex items-center gap-2 border-r border-[#30363d] px-3 py-2 text-xs"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: activeWorkflow?.accent ?? "#3d444d",
                opacity: activeWorkflow?.active ? 1 : 0.45,
              }}
            />
            {editingName ? (
              <input
                autoFocus
                value={localName}
                onChange={(event) => setLocalName(event.target.value)}
                onBlur={() => {
                  if (activeWorkflow) renameWorkflow(activeWorkflow.id, localName);
                  setEditingName(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && activeWorkflow) {
                    renameWorkflow(activeWorkflow.id, localName);
                    setEditingName(false);
                  }
                  if (event.key === "Escape") {
                    setEditingName(false);
                    setLocalName(activeWorkflow?.name ?? "");
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                className="w-[180px] rounded border border-[#1f6feb] bg-[#0d1117] px-2 py-1 text-xs text-[#e6edf3] outline-none"
              />
            ) : (
              <span
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!activeWorkflow) return;
                  setEditingName(true);
                  setLocalName(activeWorkflow.name);
                }}
                className="max-w-[190px] truncate font-medium text-[#e6edf3]"
              >
                {activeWorkflow?.name ?? "No workflow"}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-[#7d8590]" />
          </button>
          {showWorkflowDropdown ? (
            <WorkflowDropdown
              workflows={filteredWorkflows}
              activeWorkflowId={activeWorkflowId}
              onClose={() => setShowWorkflowDropdown(false)}
            />
          ) : null}
        </div>

        <button
          onClick={() => setAddNodePanel(true)}
          className="flex items-center gap-2 border-r border-[#30363d] px-3 py-2 text-xs text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add node
        </button>

        <button
          onClick={() => {
            void runWorkflow();
          }}
          disabled={!activeWorkflow || !activeProject?.active}
          className="flex items-center gap-2 border-r border-[#30363d] px-3 py-2 text-xs text-[#3fb950] transition-colors hover:bg-[#21262d] disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" />
          Run
        </button>

        <button
          onClick={saveWorkflow}
          disabled={!activeWorkflow}
          className="flex h-full items-center justify-center border-r border-[#30363d] px-3 text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3] disabled:opacity-40"
          title="Save"
        >
          <Save className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={exportWorkflow}
          disabled={!activeWorkflow}
          className={`flex h-full items-center justify-center border-r border-[#30363d] px-3 transition-colors hover:bg-[#21262d] disabled:opacity-40 ${
            copiedExport ? "text-[#58a6ff]" : "text-[#7d8590] hover:text-[#e6edf3]"
          }`}
          title={copiedExport ? "Copied to clipboard" : "Copy JSON"}
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setShowImportModal(true)}
          disabled={!activeWorkflow}
          className="flex h-full items-center justify-center border-r border-[#30363d] px-3 text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3] disabled:opacity-40"
          title="Import JSON"
        >
          <Upload className="h-3.5 w-3.5" />
        </button>

        {updater.enabled &&
        (updater.updateState === "available" ||
          updater.updateState === "downloading" ||
          updater.updateState === "ready_to_install" ||
          updater.updateState === "error") ? (
          <button
            onClick={() => setShowSettings(true)}
            className={`flex items-center gap-2 border-r border-[#30363d] px-3 py-2 text-xs transition-colors hover:bg-[#21262d] ${
              updater.updateState === "ready_to_install"
                ? "text-[#3fb950]"
                : updater.updateState === "error"
                  ? "text-[#f85149]"
                  : "text-[#58a6ff]"
            }`}
            title="Desktop updates"
          >
            {updater.updateState === "downloading" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {updater.updateState === "ready_to_install"
              ? "Update pronto"
              : updater.updateState === "error"
                ? "Update falhou"
                : updater.updateState === "downloading"
                  ? "Baixando"
                  : "Update"}
          </button>
        ) : null}

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex h-full items-center justify-center px-3 text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      {showSettings ? <SettingsModal onClose={() => setShowSettings(false)} /> : null}
      {showImportModal ? <ImportJsonModal onClose={() => setShowImportModal(false)} /> : null}
    </>
  );
}
