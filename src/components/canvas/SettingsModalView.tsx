"use client";

import { type ComponentType, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Crown,
  Download,
  FlaskConical,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Zap,
} from "lucide-react";
import { PixChargeCard } from "@/components/billing/PixChargeCard";
import { ModalPanelShell } from "@/components/ui/ModalPanelShell";
import { exitDesktopApp, isDesktopUpdaterAvailable } from "@/lib/desktop-updater";
import type { AppUpdateState } from "@/lib/flow-types";
import { PLAN_PRICING, type LicenseStatusPayload } from "@/lib/license";
import {
  getEffectiveReleaseAccess,
  getVisibleReleaseChannels,
  type ReleaseChannel,
} from "@/lib/release-access";
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

function describeAccessState(accessState: string | null) {
  switch (accessState) {
    case "trial_active":
      return "Trial ativo";
    case "payment_pending":
      return "Pagamento pendente";
    case "active_monthly":
      return "Pro mensal ativo";
    case "active_lifetime":
      return "Founder Lifetime ativo";
    case "blocked":
      return "Bloqueado";
    case "deleted":
      return "Removido";
    default:
      return "Sem licenca";
  }
}

function describeReleaseChannel(channel: ReleaseChannel) {
  switch (channel) {
    case "internal":
      return "Internal";
    case "beta":
      return "Beta";
    default:
      return "Stable";
  }
}

function describeCurrentSubscription(license: LicenseStatusPayload) {
  switch (license.accessState) {
    case "active_monthly":
      return PLAN_PRICING.monthly.label;
    case "active_lifetime":
      return PLAN_PRICING.lifetime.label;
    case "trial_active":
      return "Trial";
    default:
      return "Sem plano ativo";
  }
}

function formatDateLabel(value: string | null) {
  if (!value) return "Sem prazo";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAmountInReais(amountInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);
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

const BILLING_CARD_TONE_STYLES = {
  monthly: {
    outer:
      "border-[#244a78] bg-[linear-gradient(160deg,#0f1a2b_0%,#101722_55%,#0b1016_100%)] hover:border-[#388bfd] hover:bg-[linear-gradient(160deg,#10203a_0%,#111c2b_55%,#0c1118_100%)]",
    badge: "border-[#244a78] bg-[#0b2240] text-[#8ec5ff]",
    icon: "border-[#244a78] bg-[#102746] text-[#8ec5ff]",
    amount: "text-[#8ec5ff]",
    detail: "text-[#9fb3c8]",
  },
  lifetime: {
    outer:
      "border-[#2f6f3e] bg-[linear-gradient(160deg,#102019_0%,#121b17_55%,#0d1117_100%)] hover:border-[#3fb950] hover:bg-[linear-gradient(160deg,#123024_0%,#16231b_55%,#0e1318_100%)]",
    badge: "border-[#2f6f3e] bg-[#102b1f] text-[#7ee787]",
    icon: "border-[#2f6f3e] bg-[#143224] text-[#7ee787]",
    amount: "text-[#7ee787]",
    detail: "text-[#b7f0c2]",
  },
  internal: {
    outer:
      "border-[#5f4b8b] bg-[linear-gradient(160deg,#18132a_0%,#13111d_55%,#0d1117_100%)] hover:border-[#8b70c9] hover:bg-[linear-gradient(160deg,#21193a_0%,#171426_55%,#0e1118_100%)]",
    badge: "border-[#5f4b8b] bg-[#21193a] text-[#c4b5fd]",
    icon: "border-[#5f4b8b] bg-[#261f44] text-[#c4b5fd]",
    amount: "text-[#d6ccff]",
    detail: "text-[#b5abd9]",
  },
} satisfies Record<
  "monthly" | "lifetime" | "internal",
  {
    outer: string;
    badge: string;
    icon: string;
    amount: string;
    detail: string;
  }
>;

function BillingActionCard({
  icon: Icon,
  badge,
  title,
  amount,
  description,
  details,
  tone,
  disabled,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  badge: string;
  title: string;
  amount: string;
  description: string;
  details: string[];
  tone: "monthly" | "lifetime" | "internal";
  disabled?: boolean;
  onClick: () => void;
}) {
  const styles = BILLING_CARD_TONE_STYLES[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${styles.outer}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/8" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${styles.badge}`}
          >
            {badge}
          </span>
          <div>
            <div className="text-sm font-semibold text-[#f0f6fc]">{title}</div>
            <div className={`mt-1 text-lg font-semibold ${styles.amount}`}>{amount}</div>
          </div>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${styles.icon}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="mt-4 text-[11px] leading-relaxed text-[#c9d1d9]">{description}</div>

      <div className="mt-4 space-y-2">
        {details.map((detail) => (
          <div key={detail} className={`flex items-start gap-2 text-[11px] ${styles.detail}`}>
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{detail}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 text-[11px] font-medium text-[#f0f6fc]">
        <span>Continuar</span>
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </button>
  );
}

function ActivePlanCard({
  icon: Icon,
  badge,
  title,
  amount,
  description,
  details,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  badge: string;
  title: string;
  amount: string;
  description: string;
  details: string[];
  tone: "monthly" | "lifetime";
}) {
  const styles = BILLING_CARD_TONE_STYLES[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 ${styles.outer.replaceAll(" hover:border-[#388bfd] hover:bg-[linear-gradient(160deg,#10203a_0%,#111c2b_55%,#0c1118_100%)]", "").replaceAll(" hover:border-[#3fb950] hover:bg-[linear-gradient(160deg,#123024_0%,#16231b_55%,#0e1318_100%)]", "")}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/8" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${styles.badge}`}
          >
            {badge}
          </span>
          <div>
            <div className="text-sm font-semibold text-[#f0f6fc]">{title}</div>
            <div className={`mt-1 text-lg font-semibold ${styles.amount}`}>{amount}</div>
          </div>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${styles.icon}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="mt-4 text-[11px] leading-relaxed text-[#c9d1d9]">{description}</div>

      <div className="mt-4 space-y-2">
        {details.map((detail) => (
          <div key={detail} className={`flex items-start gap-2 text-[11px] ${styles.detail}`}>
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{detail}</span>
          </div>
        ))}
      </div>
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
  const license = useAuthStore((state) => state.license);
  const authPending = useAuthStore((state) => state.pending);
  const billingPending = useAuthStore((state) => state.billingPending);
  const accountPending = useAuthStore((state) => state.accountPending);
  const requestBillingCharge = useAuthStore((state) => state.requestBillingCharge);
  const simulatePayment = useAuthStore((state) => state.simulatePayment);
  const cancelSubscription = useAuthStore((state) => state.cancelSubscription);
  const refreshStatus = useAuthStore((state) => state.refreshStatus);
  const logout = useAuthStore((state) => state.logout);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [value, setValue] = useState(deepseekKey);
  const [projectName, setProjectName] = useState(activeProject?.name ?? "");
  const [projectAccent, setProjectAccent] = useState(activeProject?.accent ?? "#1f6feb");
  const [workflowName, setWorkflowName] = useState(activeWorkflow?.name ?? "");
  const [workflowAccent, setWorkflowAccent] = useState(activeWorkflow?.accent ?? "#1f6feb");
  const activeCharge = license.billing.activeCharge;
  const showDesktopExit = isDesktopUpdaterAvailable();
  const effectiveReleaseAccess = getEffectiveReleaseAccess(
    license.releaseAccess,
    updater.releaseChannel,
  );
  const canOfferMonthlyBillingAction =
    Boolean(session) &&
    !activeCharge &&
    (license.accessState === "trial_active" ||
      license.accessState === "payment_pending" ||
      license.accessState === "blocked");
  const canOfferLifetimeBillingAction =
    Boolean(session) &&
    !activeCharge &&
    (license.accessState === "trial_active" ||
      license.accessState === "payment_pending" ||
      license.accessState === "blocked" ||
      license.accessState === "active_monthly");
  const canCancelCurrentPlan =
    Boolean(session) &&
    (license.accessState === "active_monthly" || license.accessState === "active_lifetime");
  const canUseInternalRole =
    !authPending &&
    license.authenticated &&
    effectiveReleaseAccess.level === "internal";
  const canUseInternalMonthlyBillingAction =
    canUseInternalRole && canOfferMonthlyBillingAction;
  const canUseInternalLifetimeBillingAction =
    canUseInternalRole && canOfferLifetimeBillingAction;
  const hasActivePlanCard =
    license.accessState === "active_monthly" || license.accessState === "active_lifetime";
  const hasPlanBillingSection =
    hasActivePlanCard || canOfferMonthlyBillingAction || canOfferLifetimeBillingAction;
  const hasInternalBillingSection =
    canUseInternalMonthlyBillingAction || canUseInternalLifetimeBillingAction;
  const showBillingSectionsSideBySide =
    hasPlanBillingSection && hasInternalBillingSection;
  const planBillingActionCount =
    Number(hasActivePlanCard) +
    Number(canOfferMonthlyBillingAction) +
    Number(canOfferLifetimeBillingAction);
  const internalBillingActionCount =
    Number(canUseInternalMonthlyBillingAction) +
    Number(canUseInternalLifetimeBillingAction);
  const visibleReleaseChannels = getVisibleReleaseChannels(
    updater.supportedChannels,
    updater.allowedChannels,
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

  useEffect(() => {
    if (activeTab !== "account") return;
    void refreshStatus();
  }, [activeTab, refreshStatus]);

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
    <ModalPanelShell
      title="Settings"
      subtitle="Ajustes locais do app, updater e workspace ativo."
      onClose={onClose}
      headerContent={
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
      }
      footer={
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
      }
    >
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
                      <span className="block text-[10px] text-[#7d8590]">Role ativa</span>
                      <select
                        value={updater.releaseChannel}
                        onChange={(event) =>
                          setReleaseChannel(event.target.value as typeof updater.releaseChannel)
                        }
                        className="w-full rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs text-[#e6edf3] outline-none focus:border-[#1f6feb]"
                      >
                        {visibleReleaseChannels.map((channel) => (
                          <option key={channel} value={channel}>
                            {describeReleaseChannel(channel)}
                          </option>
                        ))}
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

                  <div className="mt-3 text-[11px] leading-relaxed text-[#7d8590]">
                    Sua role real libera:{" "}
                    {visibleReleaseChannels.map(describeReleaseChannel).join(", ")}.
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
                    title="Conta e licenca"
                    subtitle={
                      session
                        ? "Identidade Google, estado comercial e cobranca PIX desta conta."
                        : "Nenhuma conta autenticada nesta sessao."
                    }
                  />
                  {session ? (
                    <>
                      <div className="mt-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                          Conta conectada
                        </div>
                        <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                          {session.name}
                        </div>
                        <div className="mt-1 text-[11px] text-[#7d8590]">{session.email}</div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                            Estado
                          </div>
                          <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                            {describeAccessState(license.accessState)}
                          </div>
                        </div>
                        <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                            Assinatura atual
                          </div>
                          <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                            {describeCurrentSubscription(license)}
                          </div>
                        </div>
                        <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                            Role real
                          </div>
                          <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                            {describeReleaseChannel(license.releaseAccess.level)}
                          </div>
                        </div>
                        <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                            Role ativa
                          </div>
                          <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                            {describeReleaseChannel(effectiveReleaseAccess.level)}
                          </div>
                        </div>
                        <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                            Trial termina
                          </div>
                          <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                            {formatDateLabel(license.timeline.trialEndsAt)}
                          </div>
                        </div>
                        <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                            Canais liberados
                          </div>
                          <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                            {license.releaseAccess.allowedChannels
                              .map(describeReleaseChannel)
                              .join(", ")}
                          </div>
                        </div>
                        <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                            Proximo marco
                          </div>
                          <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                            {formatDateLabel(
                              license.timeline.paymentDueAt ??
                                license.timeline.deleteAt ??
                                license.timeline.blockedAt,
                            )}
                          </div>
                        </div>
                      </div>

                      {activeCharge ? (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-md border border-[#6a4b08] bg-[#17120a] px-3 py-3">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#d29922]">
                              <CreditCard className="h-3.5 w-3.5" />
                              PIX pendente
                            </div>
                            <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                              {PLAN_PRICING[activeCharge.planType].label} - {formatAmountInReais(activeCharge.amount)}
                            </div>
                            <div className="mt-1 text-[11px] leading-5 text-[#c9d1d9]">
                              Vence em {formatDateLabel(activeCharge.dueAt)}. O workspace continua liberado ate esse prazo.
                            </div>
                          </div>
                          <PixChargeCard charge={activeCharge} onRefresh={() => refreshStatus()} />
                          {canUseInternalRole ? (
                            <button
                              type="button"
                              disabled={accountPending}
                              onClick={() => {
                                void simulatePayment(activeCharge.planType);
                              }}
                              className="w-full rounded-md border border-[#2f6f3e] bg-[#102019] px-3 py-3 text-left text-xs text-[#d2f8dd] transition-colors hover:bg-[#143224] disabled:opacity-60"
                            >
                              <div className="font-medium">Simular pagamento deste PIX</div>
                              <div className="mt-1 text-[11px] text-[#7ee787]">
                                Disponivel apenas para contas internal.
                              </div>
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {hasPlanBillingSection || hasInternalBillingSection ? (
                    <div
                      className={`mt-4 grid gap-4 ${
                        showBillingSectionsSideBySide ? "xl:grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {hasPlanBillingSection ? (
                        <div className="min-w-0 space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                              Planos
                            </div>
                            <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
                              Superficies de compra e upgrade do workspace local.
                            </div>
                          </div>
                          <div
                            className={`grid gap-3 ${
                              showBillingSectionsSideBySide
                                ? "grid-cols-1"
                                : planBillingActionCount > 1
                                  ? "sm:grid-cols-2"
                                  : "grid-cols-1"
                            }`}
                          >
                            {license.accessState === "active_monthly" ? (
                              <ActivePlanCard
                                icon={Zap}
                                badge="Ativo"
                                title="Pro Mensal ativo"
                                amount={formatAmountInReais(PLAN_PRICING.monthly.amountInCents)}
                                description="Seu workspace esta liberado no ciclo mensal atual."
                                details={[
                                  `Renovacao prevista para ${formatDateLabel(license.timeline.paymentDueAt)}`,
                                  "Cancelando agora, abre 7 dias para pagar antes do bloqueio",
                                  "Upgrade para lifetime continua disponivel",
                                ]}
                                tone="monthly"
                              />
                            ) : null}
                            {license.accessState === "active_lifetime" ? (
                              <ActivePlanCard
                                icon={Crown}
                                badge="Ativo"
                                title="Founder Lifetime ativo"
                                amount={formatAmountInReais(PLAN_PRICING.lifetime.amountInCents)}
                                description="Seu workspace esta liberado permanentemente no core single-user."
                                details={[
                                  "Pagamento unico ja confirmado",
                                  "Sem renovacao mensal",
                                  "Sem janelas futuras de bloqueio por cobranca",
                                ]}
                                tone="lifetime"
                              />
                            ) : null}
                            {canOfferMonthlyBillingAction ? (
                              <BillingActionCard
                                icon={Zap}
                                badge="Pro Mensal"
                                title="Gerar PIX mensal"
                                amount={formatAmountInReais(PLAN_PRICING.monthly.amountInCents)}
                                description="Liberacao recorrente para quem esta no trial, reabrindo pagamento ou saindo do bloqueio."
                                details={[
                                  "30 dias de acesso por ciclo",
                                  "Renovacao manual via PIX",
                                  "Mantem o workspace local",
                                ]}
                                tone="monthly"
                                disabled={billingPending}
                                onClick={() => {
                                  void requestBillingCharge("monthly");
                                }}
                              />
                            ) : null}
                            {canOfferLifetimeBillingAction ? (
                              <BillingActionCard
                                icon={Crown}
                                badge={
                                  license.accessState === "active_monthly"
                                    ? "Upgrade"
                                    : "Founder Lifetime"
                                }
                                title={
                                  license.accessState === "active_monthly"
                                    ? "Fazer upgrade para vitalicio"
                                    : "Gerar PIX vitalicio"
                                }
                                amount={formatAmountInReais(PLAN_PRICING.lifetime.amountInCents)}
                                description={
                                  license.accessState === "active_monthly"
                                    ? "Troque o ciclo mensal por acesso permanente ao core single-user."
                                    : "Pagamento unico para remover ciclos mensais e manter o core liberado."
                                }
                                details={[
                                  "Pagamento unico por PIX",
                                  "Sem renovacao mensal",
                                  "Acesso permanente ao core atual",
                                ]}
                                tone="lifetime"
                                disabled={billingPending}
                                onClick={() => {
                                  void requestBillingCharge("lifetime");
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {hasInternalBillingSection ? (
                        <div className="min-w-0 space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                              Ferramentas internal
                            </div>
                            <div className="mt-1 text-[11px] leading-relaxed text-[#7d8590]">
                              Acoes de simulacao visiveis apenas na role ativa internal.
                            </div>
                          </div>
                          <div
                            className={`grid gap-3 ${
                              showBillingSectionsSideBySide
                                ? "grid-cols-1"
                                : internalBillingActionCount > 1
                                  ? "sm:grid-cols-2"
                                  : "grid-cols-1"
                            }`}
                          >
                            {canUseInternalMonthlyBillingAction ? (
                              <BillingActionCard
                                icon={FlaskConical}
                                badge="Internal only"
                                title="Simular mensal"
                                amount={formatAmountInReais(PLAN_PRICING.monthly.amountInCents)}
                                description="Atalho de QA para validar o fluxo mensal sem abrir um PIX real."
                                details={[
                                  "Marca o pagamento como aprovado",
                                  "Nao chama cobranca real",
                                  "Mantem a timeline comercial",
                                ]}
                                tone="internal"
                                disabled={accountPending}
                                onClick={() => {
                                  void simulatePayment("monthly");
                                }}
                              />
                            ) : null}
                            {canUseInternalLifetimeBillingAction ? (
                              <BillingActionCard
                                icon={FlaskConical}
                                badge="Internal only"
                                title={
                                  license.accessState === "active_monthly"
                                    ? "Simular upgrade para vitalicio"
                                    : "Simular vitalicio"
                                }
                                amount={formatAmountInReais(PLAN_PRICING.lifetime.amountInCents)}
                                description="Teste interno do Founder Lifetime para validar liberacao e upgrade."
                                details={[
                                  "Ignora o PIX real",
                                  "Ativa o lifetime imediatamente",
                                  "Serve para QA de conta e licenca",
                                ]}
                                tone="internal"
                                disabled={accountPending}
                                onClick={() => {
                                  void simulatePayment("lifetime");
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCancelCurrentPlan ? (
                      <button
                        type="button"
                        disabled={accountPending}
                        onClick={() => {
                          void cancelSubscription();
                        }}
                        className="flex items-center gap-2 rounded-md border border-[#f8514933] px-3 py-2 text-xs font-medium text-[#f85149] transition-colors hover:bg-[#f8514910] disabled:opacity-60"
                      >
                        Cancelar plano ativo
                      </button>
                    ) : null}

                    {session ? (
                      <button
                        type="button"
                        onClick={() => {
                          void refreshStatus();
                        }}
                        className="flex items-center gap-2 rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Atualizar status
                      </button>
                    ) : null}

                    {session ? (
                      <button
                        onClick={() => {
                          void logout();
                          onClose();
                        }}
                        className="flex items-center gap-2 rounded-md border border-[#f8514933] px-3 py-2 text-xs font-medium text-[#f85149] transition-colors hover:bg-[#f8514910]"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sair
                      </button>
                    ) : null}

                    {showDesktopExit ? (
                      <button
                        type="button"
                        onClick={() => {
                          void exitDesktopApp();
                        }}
                        className="rounded-md border border-[#30363d] px-3 py-2 text-xs text-[#e6edf3] transition-colors hover:bg-[#21262d]"
                      >
                        Fechar app agora
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
    </ModalPanelShell>
  );
}
