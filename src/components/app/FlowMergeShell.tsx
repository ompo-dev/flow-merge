"use client";

import { useEffect } from "react";
import { AlertTriangle, CreditCard, Trash2 } from "lucide-react";
import { LandingPage } from "@/components/app/LandingPage";
import { PixChargeCard } from "@/components/billing/PixChargeCard";
import { CanvasEntry } from "@/components/canvas/CanvasEntry";
import { DesktopUpdateBridge } from "@/components/runtime/DesktopUpdateBridge";
import { BrandMark } from "@/components/ui/BrandMark";
import { ModalPanelShell } from "@/components/ui/ModalPanelShell";
import { getEffectiveReleaseAccess } from "@/lib/release-access";
import { useAuthStore } from "@/store/useAuthStore";
import { useFlowStore } from "@/store/useFlowStore";

function BootScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0d1117]">
      <div className="rounded-[28px] border border-[#30363d] bg-[#11161d] px-8 py-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <BrandMark className="mx-auto h-14 w-14" iconClassName="h-6 w-6" />
        <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[#7d8590]">
          Flow Merge
        </div>
        <div className="mt-2 text-lg font-semibold text-[#f0f6fc]">
          Preparing local command center
        </div>
      </div>
    </div>
  );
}

function formatDateLabel(value: string | null) {
  if (!value) return "agora";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function WorkspaceBillingBanner() {
  const license = useAuthStore((state) => state.license);
  const authPending = useAuthStore((state) => state.pending);
  const activeReleaseRole = useFlowStore(
    (state) => state.updater.releaseChannel,
  );
  const requestBillingCharge = useAuthStore(
    (state) => state.requestBillingCharge,
  );
  const billingPending = useAuthStore((state) => state.billingPending);
  const accountPending = useAuthStore((state) => state.accountPending);
  const simulatePayment = useAuthStore((state) => state.simulatePayment);
  const refreshStatus = useAuthStore((state) => state.refreshStatus);
  const effectiveReleaseAccess = getEffectiveReleaseAccess(
    license.releaseAccess,
    activeReleaseRole,
  );
  const canUseInternalRole =
    !authPending &&
    license.authenticated &&
    effectiveReleaseAccess.level === "internal";
  const canUseInternalBillingActions = canUseInternalRole;

  if (!license.requiresPayment || !license.canAccessWorkspace) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[130] w-[min(380px,calc(100vw-2rem))]">
      <div className="pointer-events-auto space-y-3 rounded-[28px] border border-[#6a4b08] bg-[#17120a]/95 p-4 shadow-[0_28px_100px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl border border-[#6a4b08] bg-[#251a07] p-2 text-[#d29922]">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#d29922]">
              Pagamento pendente
            </div>
            <div className="mt-2 text-sm font-semibold text-[#f0f6fc]">
              Seu workspace continua liberado por enquanto.
            </div>
            <div className="mt-2 text-[13px] leading-6 text-[#c9d1d9]">
              O acesso sera bloqueado em{" "}
              {formatDateLabel(license.timeline.paymentDueAt)} se o PIX nao for
              confirmado.
            </div>
          </div>
        </div>

        {license.billing.activeCharge ? (
          <>
            <PixChargeCard
              charge={license.billing.activeCharge}
              onRefresh={() => refreshStatus()}
            />
            {canUseInternalRole ? (
              <button
                type="button"
                disabled={accountPending}
                onClick={() => {
                  void simulatePayment(license.billing.activeCharge!.planType);
                }}
                className="w-full rounded-2xl border border-[#2f6f3e] bg-[#102019] px-4 py-3 text-left text-sm text-[#d2f8dd] transition-colors hover:bg-[#143224] disabled:opacity-60"
              >
                <div className="font-medium">Simular pagamento deste PIX</div>
                <div className="mt-1 text-xs text-[#7ee787]">
                  Disponivel apenas para contas internal.
                </div>
              </button>
            ) : null}
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={billingPending}
              onClick={() => {
                void requestBillingCharge("monthly");
              }}
              className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3 text-left text-sm text-[#f0f6fc] transition-colors hover:border-[#1f6feb] hover:bg-[#0f1a2b] disabled:opacity-60"
            >
              <div className="font-medium">Pro Mensal</div>
              <div className="mt-1 text-xs text-[#8b949e]">R$89 via PIX</div>
            </button>
            <button
              type="button"
              disabled={billingPending}
              onClick={() => {
                void requestBillingCharge("lifetime");
              }}
              className="rounded-2xl border border-[#30363d] bg-[#11161d] px-4 py-3 text-left text-sm text-[#f0f6fc] transition-colors hover:border-[#3fb950] hover:bg-[#102019] disabled:opacity-60"
            >
              <div className="font-medium">Founder Lifetime</div>
              <div className="mt-1 text-xs text-[#8b949e]">R$1.068 via PIX</div>
            </button>
            {canUseInternalBillingActions ? (
              <>
                <button
                  type="button"
                  disabled={accountPending}
                  onClick={() => {
                    void simulatePayment("monthly");
                  }}
                  className="rounded-2xl border border-[#2f6f3e] bg-[#102019] px-4 py-3 text-left text-sm text-[#d2f8dd] transition-colors hover:bg-[#143224] disabled:opacity-60"
                >
                  <div className="font-medium">Simular mensal</div>
                  <div className="mt-1 text-xs text-[#7ee787]">
                    Bypass de pagamento para internal
                  </div>
                </button>
                <button
                  type="button"
                  disabled={accountPending}
                  onClick={() => {
                    void simulatePayment("lifetime");
                  }}
                  className="rounded-2xl border border-[#2f6f3e] bg-[#102019] px-4 py-3 text-left text-sm text-[#d2f8dd] transition-colors hover:bg-[#143224] disabled:opacity-60"
                >
                  <div className="font-medium">Simular vitalicio</div>
                  <div className="mt-1 text-xs text-[#7ee787]">
                    Ativa o lifetime sem PIX real
                  </div>
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function BillingLockScreen() {
  const license = useAuthStore((state) => state.license);
  const authPending = useAuthStore((state) => state.pending);
  const activeReleaseRole = useFlowStore(
    (state) => state.updater.releaseChannel,
  );
  const requestBillingCharge = useAuthStore(
    (state) => state.requestBillingCharge,
  );
  const billingPending = useAuthStore((state) => state.billingPending);
  const accountPending = useAuthStore((state) => state.accountPending);
  const simulatePayment = useAuthStore((state) => state.simulatePayment);
  const refreshStatus = useAuthStore((state) => state.refreshStatus);
  const logout = useAuthStore((state) => state.logout);
  const effectiveReleaseAccess = getEffectiveReleaseAccess(
    license.releaseAccess,
    activeReleaseRole,
  );
  const canUseInternalRole =
    !authPending &&
    license.authenticated &&
    effectiveReleaseAccess.level === "internal";
  const canUseInternalBillingActions = canUseInternalRole;
  const lockHasSidePanel = Boolean(license.billing.activeCharge);

  return (
    <ModalPanelShell
      title="Conta bloqueada"
      subtitle="Mesmo modal das configuracoes, agora usado como lock screen comercial."
      maxWidthClass={lockHasSidePanel ? "max-w-[980px]" : "max-w-[760px]"}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#7d8590]">
            O acesso volta assim que um pagamento for confirmado antes do prazo
            final.
          </div>
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#30363d] px-4 py-2 text-sm text-[#9fb3c8] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc]"
          >
            Sair desta conta
          </button>
        </div>
      }
    >
      <div
        className={`grid gap-6 ${
          lockHasSidePanel
            ? "lg:grid-cols-[minmax(0,1fr)_320px]"
            : "grid-cols-1"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#7d8590]">
            <CreditCard className="h-3.5 w-3.5 text-[#d29922]" />
            Billing lock
          </div>
          <div className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#f0f6fc]">
            O canvas foi bloqueado ate o pagamento entrar.
          </div>
          <div className="mt-4 max-w-[58ch] text-[15px] leading-7 text-[#8b949e]">
            Seus dados continuam locais nesta instalacao, mas o workspace so
            volta a abrir depois do PIX confirmar. Se nada for pago ate{" "}
            {formatDateLabel(license.timeline.deleteAt)}, a conta e os dados
            locais serao removidos.
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">
                Bloqueado em
              </div>
              <div className="mt-2 text-sm font-medium text-[#f0f6fc]">
                {formatDateLabel(license.timeline.blockedAt)}
              </div>
            </div>
            <div className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">
                Delete final
              </div>
              <div className="mt-2 text-sm font-medium text-[#f0f6fc]">
                {formatDateLabel(license.timeline.deleteAt)}
              </div>
            </div>
          </div>

          {!license.billing.activeCharge ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={billingPending}
                onClick={() => {
                  void requestBillingCharge("monthly");
                }}
                className="rounded-[24px] border border-[#30363d] bg-[#0d1117] p-4 text-left transition-colors hover:border-[#1f6feb] hover:bg-[#101927] disabled:opacity-60"
              >
                <div className="text-sm font-semibold text-[#f0f6fc]">
                  Pro Mensal
                </div>
                <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">
                  R$89 por ciclo, cobranca manual via PIX.
                </div>
              </button>
              <button
                type="button"
                disabled={billingPending}
                onClick={() => {
                  void requestBillingCharge("lifetime");
                }}
                className="rounded-[24px] border border-[#30363d] bg-[#0d1117] p-4 text-left transition-colors hover:border-[#3fb950] hover:bg-[#0f1b16] disabled:opacity-60"
              >
                <div className="text-sm font-semibold text-[#f0f6fc]">
                  Founder Lifetime
                </div>
                <div className="mt-2 text-[13px] leading-6 text-[#8b949e]">
                  R$1.068 para liberar o core single-user.
                </div>
              </button>
              {canUseInternalBillingActions ? (
                <>
                  <button
                    type="button"
                    disabled={accountPending}
                    onClick={() => {
                      void simulatePayment("monthly");
                    }}
                    className="rounded-[24px] border border-[#2f6f3e] bg-[#102019] p-4 text-left transition-colors hover:bg-[#143224] disabled:opacity-60"
                  >
                    <div className="text-sm font-semibold text-[#d2f8dd]">
                      Simular mensal
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-[#7ee787]">
                      Confirma o pagamento sem PIX real.
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={accountPending}
                    onClick={() => {
                      void simulatePayment("lifetime");
                    }}
                    className="rounded-[24px] border border-[#2f6f3e] bg-[#102019] p-4 text-left transition-colors hover:bg-[#143224] disabled:opacity-60"
                  >
                    <div className="text-sm font-semibold text-[#d2f8dd]">
                      Simular vitalicio
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-[#7ee787]">
                      Ativa o lifetime para teste interno.
                    </div>
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {license.billing.activeCharge ? (
          <div className="space-y-3">
            <PixChargeCard
              charge={license.billing.activeCharge}
              onRefresh={() => refreshStatus()}
            />
            {canUseInternalRole ? (
              <button
                type="button"
                disabled={accountPending}
                onClick={() => {
                  void simulatePayment(license.billing.activeCharge!.planType);
                }}
                className="w-full rounded-2xl border border-[#2f6f3e] bg-[#102019] px-4 py-3 text-left text-sm text-[#d2f8dd] transition-colors hover:bg-[#143224] disabled:opacity-60"
              >
                <div className="font-medium">Simular pagamento deste PIX</div>
                <div className="mt-1 text-xs text-[#7ee787]">
                  Atalho de teste para contas internal.
                </div>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ModalPanelShell>
  );
}

function DeletedAccountScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1117] px-4 py-10">
      <div className="w-full max-w-[520px] rounded-[32px] border border-[#30363d] bg-[#11161d] p-6 text-center shadow-[0_28px_110px_rgba(0,0,0,0.36)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f8514933] bg-[#2a1215] text-[#f85149]">
          <Trash2 className="h-6 w-6" />
        </div>
        <div className="mt-4 text-[10px] uppercase tracking-[0.18em] text-[#7d8590]">
          Conta removida
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#f0f6fc]">
          A grace terminou e os dados locais foram limpos.
        </div>
        <div className="mt-4 text-[15px] leading-7 text-[#8b949e]">
          Para voltar a usar o Flow Merge, faca login de novo e gere uma nova
          cobranca.
        </div>
      </div>
    </div>
  );
}

interface FlowMergeShellProps {
  landingWorkflowId?: string;
}

export function FlowMergeShell({
  landingWorkflowId,
}: FlowMergeShellProps = {}) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const license = useAuthStore((state) => state.license);
  const hydrate = useAuthStore((state) => state.hydrate);
  const refreshStatus = useAuthStore((state) => state.refreshStatus);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!license.authenticated || !license.billing.activeCharge?.id) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [license.authenticated, license.billing.activeCharge?.id, refreshStatus]);

  if (!hydrated) {
    return <BootScreen />;
  }

  const showDeletedState =
    license.shouldWipeLocalData || license.accessState === "deleted";

  return (
    <>
      <DesktopUpdateBridge />
      {!license.authenticated ? (
        <LandingPage initialWorkflowId={landingWorkflowId} />
      ) : null}
      {license.authenticated && showDeletedState ? (
        <DeletedAccountScreen />
      ) : null}
      {license.authenticated &&
      !showDeletedState &&
      license.canAccessWorkspace ? (
        <>
          <CanvasEntry />
          <WorkspaceBillingBanner />
        </>
      ) : null}
      {license.authenticated &&
      !showDeletedState &&
      !license.canAccessWorkspace ? (
        <BillingLockScreen />
      ) : null}
    </>
  );
}
