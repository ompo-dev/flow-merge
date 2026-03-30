"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, LogOut, RefreshCw, X } from "lucide-react";
import { exitDesktopApp } from "@/lib/desktop-updater";
import type { AppUpdateState } from "@/lib/flow-types";
import { useAuthStore } from "@/store/useAuthStore";
import { useActiveProject, useActiveWorkflow, useFlowStore } from "@/store/useFlowStore";

type SettingsTabId = "ai" | "desktop" | "project" | "workflow" | "session";

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  description: string;
}

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
  const [value, setValue] = useState(deepseekKey);
  const [projectName, setProjectName] = useState(activeProject?.name ?? "");
  const [projectAccent, setProjectAccent] = useState(activeProject?.accent ?? "#1f6feb");
  const [workflowName, setWorkflowName] = useState(activeWorkflow?.name ?? "");
  const [workflowAccent, setWorkflowAccent] = useState(activeWorkflow?.accent ?? "#1f6feb");
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    updater.updateState !== "idle" && updater.enabled ? "desktop" : "ai",
  );

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

  const settingsTabs = useMemo(() => {
    const tabs: SettingsTab[] = [
      { id: "ai", label: "IA", description: "Chave local e assistente" },
      { id: "desktop", label: "Desktop", description: "Canal, update e janela" },
    ];

    if (activeProject) {
      tabs.push({
        id: "project",
        label: "Projeto",
        description: "Nome e cor do projeto ativo",
      });
    }

    if (activeWorkflow) {
      tabs.push({
        id: "workflow",
        label: "Workflow",
        description: "Nome e cor do workflow ativo",
      });
    }

    if (session) {
      tabs.push({
        id: "session",
        label: "Sessao",
        description: "Conta local e logout",
      });
    }

    return tabs;
  }, [activeProject, activeWorkflow, session]);

  useEffect(() => {
    if (settingsTabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab(settingsTabs[0]?.id ?? "ai");
  }, [activeTab, settingsTabs]);

  const activeTabMeta = settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0];

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
          className="fc-panel flex max-h-[calc(100vh-3rem)] w-full max-w-[720px] flex-col overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-[#30363d] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#e6edf3]">Settings</div>
                <div className="mt-1 text-[11px] text-[#7d8590]">
                  {activeTabMeta?.description ?? "Configuracao da IA, projeto e workflow atual"}
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1 text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-[#30363d] px-3 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-w-fit rounded-full border px-3 py-2 text-left transition-colors ${
                    activeTab === tab.id
                      ? "border-[#1f6feb] bg-[#13233b] text-[#e6edf3]"
                      : "border-[#30363d] bg-[#0d1117] text-[#7d8590] hover:bg-[#161b22] hover:text-[#e6edf3]"
                  }`}
                >
                  <div className="text-[11px] font-medium">{tab.label}</div>
                  <div className="mt-0.5 text-[10px] opacity-80">{tab.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === "ai" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                    DeepSeek API Key
                  </label>
                  <input
                    type="password"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-xs text-[#e6edf3] outline-none placeholder:text-[#3d444d] focus:border-[#1f6feb]"
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-[#7d8590]">
                    A chave fica salva so no navegador desta maquina e e usada pelo chat de IA do
                    canvas.
                  </p>
                </div>
              </div>
            ) : null}

            {activeTab === "desktop" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                        Atualizacoes desktop
                      </div>
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
                            : "border-[#30363d] bg-[#11161d] text-[#7d8590]"
                      }`}
                    >
                      {updater.releaseChannel}
                    </div>
                  </div>

                  {!updater.enabled ? (
                    <div className="mt-4 rounded-md border border-[#6a4b08] bg-[#201706] px-3 py-2 text-[11px] leading-relaxed text-[#d29922]">
                      Updater desktop indisponivel neste build. O app continua funcional, mas o
                      feed de release nao foi configurado.
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-[10px] text-[#7d8590]">Canal</span>
                      <select
                        value={updater.releaseChannel}
                        onChange={(event) =>
                          setReleaseChannel(event.target.value as typeof updater.releaseChannel)
                        }
                        className="w-full rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
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
                            : "border-[#30363d] bg-[#0b0f14] text-[#7d8590]"
                        }`}
                      >
                        <span>
                          {updater.autoUpdateEnabled
                            ? "Auto-update ligado"
                            : "Auto-update desligado"}
                        </span>
                        <span className="rounded-full border border-current px-2 py-0.5 text-[10px] uppercase">
                          {updater.autoUpdateEnabled ? "ON" : "OFF"}
                        </span>
                      </button>
                    </label>
                  </div>

                  {updater.feedUrls[updater.releaseChannel] ? (
                    <div className="mt-4 rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                        Feed atual
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-[#9fb3c8]">
                        {updater.feedUrls[updater.releaseChannel]}
                      </div>
                    </div>
                  ) : null}

                  {updater.lastUpdateError ? (
                    <div className="mt-4 rounded-md border border-[#f8514933] bg-[#2a1215] px-3 py-2 text-[11px] text-[#f85149]">
                      {updater.lastUpdateError}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
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

                  {updater.updateState === "downloading" ? (
                    <div className="mt-4 rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-[11px] text-[#9fb3c8]">
                      Baixando {updater.availableVersion ?? "nova versao"}
                      {typeof updater.downloadedBytes === "number"
                        ? ` - ${updater.downloadedBytes.toLocaleString("pt-BR")} bytes`
                        : ""}
                      {typeof updater.totalBytes === "number" && updater.totalBytes > 0
                        ? ` de ${updater.totalBytes.toLocaleString("pt-BR")} bytes`
                        : ""}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                    Janela desktop
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
                    Use este comando se o fechamento nativo falhar ou se quiser encerrar o app
                    imediatamente durante testes.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void exitDesktopApp();
                    }}
                    className="mt-3 rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d]"
                  >
                    Fechar app agora
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab === "project" && activeProject ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                    Projeto ativo
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-[#7d8590]">Nome</label>
                      <input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        className="w-full rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] text-[#7d8590]">Cor do menu</label>
                      <div className="flex items-center gap-3 rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2">
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
                </div>
              </div>
            ) : null}

            {activeTab === "workflow" && activeWorkflow ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                    Workflow ativo
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-[#7d8590]">Nome</label>
                      <input
                        value={workflowName}
                        onChange={(event) => setWorkflowName(event.target.value)}
                        className="w-full rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] text-[#7d8590]">Cor do menu</label>
                      <div className="flex items-center gap-3 rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2">
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
                </div>
              </div>
            ) : null}

            {activeTab === "session" && session ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                    Sessao local
                  </div>
                  <div className="mt-3 rounded-md border border-[#30363d] bg-[#0b0f14] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                      Signed in as
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#e6edf3]">{session.email}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
                      O acesso e local desta maquina. Ao sair, o canvas volta para a landing page
                      segura.
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
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#30363d] px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] leading-relaxed text-[#7d8590]">
                Desktop, canal e sessao aplicam na hora. O botao abaixo salva chave da IA e ajustes
                visuais do projeto e workflow.
              </div>
              <button
                onClick={saveSettings}
                className="rounded-md bg-[#238636] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
