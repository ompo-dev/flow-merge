"use client";

import { useEffect, useState } from "react";
import { Download, LoaderCircle, LogOut, RefreshCw, X } from "lucide-react";
import { exitDesktopApp } from "@/lib/desktop-updater";
import type { AppUpdateState } from "@/lib/flow-types";
import { useAuthStore } from "@/store/useAuthStore";
import { useActiveProject, useActiveWorkflow, useFlowStore } from "@/store/useFlowStore";

type SettingsTabId = "general" | "appearance" | "account";

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

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">{subtitle}</div>
    </div>
  );
}

export function SettingsModalView({ onClose }: { onClose: () => void }) {
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
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [value, setValue] = useState(deepseekKey);
  const [projectName, setProjectName] = useState(activeProject?.name ?? "");
  const [projectAccent, setProjectAccent] = useState(activeProject?.accent ?? "#1f6feb");
  const [workflowName, setWorkflowName] = useState(activeWorkflow?.name ?? "");
  const [workflowAccent, setWorkflowAccent] = useState(activeWorkflow?.accent ?? "#1f6feb");

  useEffect(() => {
    setValue(deepseekKey);
  }, [deepseekKey]);

  useEffect(() => {
    setProjectName(activeProject?.name ?? "");
    setProjectAccent(activeProject?.accent ?? "#1f6feb");
  }, [activeProject?.accent, activeProject?.id, activeProject?.name]);

  useEffect(() => {
    setWorkflowName(activeWorkflow?.name ?? "");
    setWorkflowAccent(activeWorkflow?.accent ?? "#1f6feb");
  }, [activeWorkflow?.accent, activeWorkflow?.id, activeWorkflow?.name]);

  const saveSettings = () => {
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
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 px-4 py-6" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="fc-panel flex max-h-[calc(100vh-3rem)] w-full max-w-[640px] flex-col overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-3 border-b border-[#30363d] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#e6edf3]">Settings</div>
                <div className="text-[11px] text-[#7d8590]">
                  Ajustes locais do app, updater e workspace ativo.
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-[#7d8590] transition-colors hover:text-[#e6edf3]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-1">
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("general")}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    activeTab === "general"
                      ? "bg-[#1f6feb] text-white"
                      : "text-[#7d8590] hover:bg-[#161b22] hover:text-[#e6edf3]"
                  }`}
                >
                  Geral
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("appearance")}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    activeTab === "appearance"
                      ? "bg-[#1f6feb] text-white"
                      : "text-[#7d8590] hover:bg-[#161b22] hover:text-[#e6edf3]"
                  }`}
                >
                  Aparencia
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("account")}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    activeTab === "account"
                      ? "bg-[#1f6feb] text-white"
                      : "text-[#7d8590] hover:bg-[#161b22] hover:text-[#e6edf3]"
                  }`}
                >
                  Conta
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeTab === "general" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
                  <SectionTitle
                    title="Assistente"
                    subtitle="Chave local usada pelo chat de IA dentro do canvas."
                  />
                  <input
                    type="password"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="sk-..."
                    className="mt-3 w-full rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs text-[#e6edf3] outline-none placeholder:text-[#3d444d] focus:border-[#1f6feb]"
                  />
                </div>

                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <SectionTitle
                      title="Desktop update"
                      subtitle={`Versao atual ${updater.currentVersion || "local"} - ${describeUpdateState(updater.updateState)}`}
                    />
                    <div
                      className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${
                        updater.updateState === "ready_to_install"
                          ? "border-[#2f6f3e] bg-[#12261a] text-[#3fb950]"
                          : updater.updateState === "error"
                            ? "border-[#f8514933] bg-[#2a1215] text-[#f85149]"
                            : "border-[#30363d] bg-[#11161d] text-[#7d8590]"
                      }`}
                    >
                      {updater.releaseChannel}
                    </div>
                  </div>

                  {!updater.enabled ? (
                    <div className="mt-3 rounded-md border border-[#6a4b08] bg-[#201706] px-3 py-2 text-[11px] leading-relaxed text-[#d29922]">
                      Updater desktop indisponivel neste build.
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-[10px] text-[#7d8590]">Canal</span>
                      <select
                        value={updater.releaseChannel}
                        onChange={(event) =>
                          setReleaseChannel(event.target.value as typeof updater.releaseChannel)
                        }
                        className="w-full rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
                      >
                        <option value="stable">Stable</option>
                        <option value="beta">Beta</option>
                        <option value="internal">Internal</option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="block text-[10px] text-[#7d8590]">Auto-update</span>
                      <button
                        type="button"
                        onClick={() => setAutoUpdateEnabled(!updater.autoUpdateEnabled)}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs ${
                          updater.autoUpdateEnabled
                            ? "border-[#2f6f3e] bg-[#12261a] text-[#3fb950]"
                            : "border-[#30363d] bg-[#11161d] text-[#7d8590]"
                        }`}
                      >
                        <span>{updater.autoUpdateEnabled ? "Ligado" : "Desligado"}</span>
                        <span className="rounded-full border border-current px-2 py-0.5 text-[10px] uppercase">
                          {updater.autoUpdateEnabled ? "ON" : "OFF"}
                        </span>
                      </button>
                    </label>
                  </div>

                  {updater.feedUrls[updater.releaseChannel] ? (
                    <div className="mt-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                        Feed atual
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-[#9fb3c8]">
                        {updater.feedUrls[updater.releaseChannel]}
                      </div>
                    </div>
                  ) : null}

                  {updater.lastUpdateError ? (
                    <div className="mt-3 rounded-md border border-[#f8514933] bg-[#2a1215] px-3 py-2 text-[11px] text-[#f85149]">
                      {updater.lastUpdateError}
                    </div>
                  ) : null}

                  {updater.updateState === "downloading" ? (
                    <div className="mt-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-[11px] text-[#9fb3c8]">
                      Baixando {updater.availableVersion ?? "nova versao"}
                      {typeof updater.downloadedBytes === "number"
                        ? ` • ${updater.downloadedBytes.toLocaleString("pt-BR")} bytes`
                        : ""}
                      {typeof updater.totalBytes === "number" && updater.totalBytes > 0
                        ? ` de ${updater.totalBytes.toLocaleString("pt-BR")} bytes`
                        : ""}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        void checkForUpdates({ autoDownload: updater.autoUpdateEnabled });
                      }}
                      disabled={
                        !updater.enabled ||
                        updater.updateState === "checking" ||
                        updater.updateState === "downloading" ||
                        updater.updateState === "installing"
                      }
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
                </div>
              </div>
            ) : null}

            {activeTab === "appearance" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
                  <SectionTitle
                    title="Projeto"
                    subtitle={
                      activeProject
                        ? "Nome e cor do projeto ativo."
                        : "Nenhum projeto ativo para editar."
                    }
                  />
                  {activeProject ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-[#7d8590]">Nome</label>
                        <input
                          value={projectName}
                          onChange={(event) => setProjectName(event.target.value)}
                          className="w-full rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-[#7d8590]">Cor</label>
                        <div className="flex items-center gap-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2">
                          <input
                            type="color"
                            value={projectAccent}
                            onChange={(event) => setProjectAccent(event.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-[#30363d] bg-transparent p-0"
                          />
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: projectAccent }}
                          />
                          <span className="text-[11px] text-[#7d8590]">{projectAccent}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
                  <SectionTitle
                    title="Workflow"
                    subtitle={
                      activeWorkflow
                        ? "Nome e cor do workflow ativo."
                        : "Nenhum workflow ativo para editar."
                    }
                  />
                  {activeWorkflow ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-[#7d8590]">Nome</label>
                        <input
                          value={workflowName}
                          onChange={(event) => setWorkflowName(event.target.value)}
                          className="w-full rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-[#7d8590]">Cor</label>
                        <div className="flex items-center gap-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2">
                          <input
                            type="color"
                            value={workflowAccent}
                            onChange={(event) => setWorkflowAccent(event.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-[#30363d] bg-transparent p-0"
                          />
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: workflowAccent }}
                          />
                          <span className="text-[11px] text-[#7d8590]">{workflowAccent}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "account" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
                  <SectionTitle
                    title="Sessao local"
                    subtitle={
                      session
                        ? "Acesso salvo nesta maquina."
                        : "Nenhuma sessao local ativa."
                    }
                  />
                  {session ? (
                    <div className="mt-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                        Signed in as
                      </div>
                      <div className="mt-1 text-xs font-medium text-[#e6edf3]">{session.email}</div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {session ? (
                      <button
                        onClick={() => {
                          logout();
                          onClose();
                        }}
                        className="flex items-center gap-2 rounded-md border border-[#f8514933] px-3 py-2 text-xs font-medium text-[#f85149] transition-colors hover:bg-[#f8514910]"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        void exitDesktopApp();
                      }}
                      className="rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d]"
                    >
                      Fechar app agora
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#30363d] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-[#7d8590]">
                Salvar aplica a chave da IA e a aparencia do projeto e workflow.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
                >
                  Fechar
                </button>
                <button
                  onClick={saveSettings}
                  className="rounded-md bg-[#238636] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2ea043]"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
