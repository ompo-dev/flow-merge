"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  RefreshCcw,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";
import { useTerminalBridgeStore } from "@/store/useTerminalBridgeStore";

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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-2 rounded-md border border-[#30363d] px-3 py-2 text-[11px] text-[#9fb3c8] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc]"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export function TerminalSettingsPanel() {
  const hydrate = useTerminalBridgeStore((state) => state.hydrate);
  const config = useTerminalBridgeStore((state) => state.config);
  const status = useTerminalBridgeStore((state) => state.status);
  const syncing = useTerminalBridgeStore((state) => state.syncing);
  const refreshStatus = useTerminalBridgeStore((state) => state.refreshStatus);
  const syncDesktopConfig = useTerminalBridgeStore((state) => state.syncDesktopConfig);
  const setEnabled = useTerminalBridgeStore((state) => state.setEnabled);
  const setEndpointUrl = useTerminalBridgeStore((state) => state.setEndpointUrl);
  const setAuthToken = useTerminalBridgeStore((state) => state.setAuthToken);
  const rotateToken = useTerminalBridgeStore((state) => state.rotateToken);

  const applyAndSync = async (callback: () => void) => {
    callback();
    await syncDesktopConfig();
    await refreshStatus();
  };

  useEffect(() => {
    hydrate();
    void refreshStatus();
  }, [hydrate, refreshStatus]);

  const runtimeLabel = useMemo(() => {
    if (!status) {
      return "Bridge local nao encontrado";
    }

    if (!status.running) {
      return "Runtime local parado";
    }

    if (!status.enabled) {
      return "Runtime local detectado, bridge desativado";
    }

    return "Runtime local pronto";
  }, [status]);

  return (
    <div data-testid="settings-terminal-panel" className="space-y-3">
      <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle
            title="Terminal local"
            subtitle="Expose a shell local real para o node de terminal e, quando voce permitir, tambem para a versao web desta maquina via bridge em localhost."
          />
          <div
            className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${
              config.enabled
                ? "border-[#2f6f3e] bg-[#12261a] text-[#7ee787]"
                : "border-[#30363d] bg-[#11161d] text-[#7d8590]"
            }`}
          >
            {config.enabled ? "Enabled" : "Disabled"}
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                <SquareTerminal className="h-3.5 w-3.5" />
                Status
              </div>
              <div className="mt-2 text-xs font-medium text-[#e6edf3]">{runtimeLabel}</div>
              <div className="mt-1 text-[11px] text-[#7d8590]">
                O desktop app continua usando Tauri direto. O browser so usa a shell local quando este bridge estiver ativo e o token bater.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refreshStatus();
                    void syncDesktopConfig();
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-[#30363d] px-3 py-2 text-[11px] text-[#9fb3c8] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc]"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Atualizar status
                </button>
                <CopyButton value={config.authToken} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                  Endpoint local
                </label>
                <input
                  value={config.endpointUrl}
                  onChange={(event) => setEndpointUrl(event.target.value)}
                  onBlur={() => {
                    void syncDesktopConfig();
                  }}
                  placeholder="http://127.0.0.1:45431/terminal"
                  className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-[#e6edf3] outline-none transition-colors focus:border-[#58a6ff]"
                />
                <div className="text-[11px] text-[#7d8590]">
                  No desktop, normalmente fica em `127.0.0.1:45431`.
                </div>
              </div>

              <div className="space-y-1 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                  Token do bridge
                </label>
                <input
                  value={config.authToken}
                  onChange={(event) => setAuthToken(event.target.value)}
                  onBlur={() => {
                    void syncDesktopConfig();
                  }}
                  placeholder="Bearer token local"
                  className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-[#e6edf3] outline-none transition-colors focus:border-[#58a6ff]"
                />
                <div className="text-[11px] text-[#7d8590]">
                  O web build precisa do mesmo token configurado no runtime local.
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                <Link2 className="h-3.5 w-3.5" />
                Como funciona
              </div>
              <div className="mt-2 space-y-2 text-[11px] leading-5 text-[#7d8590]">
                <p>1. O desktop app ou runtime local abre a shell real nesta maquina.</p>
                <p>2. O node de terminal no browser fala com `localhost` usando este endpoint e este token.</p>
                <p>3. Sem opt-in, a versao web nao tenta abrir shell nenhuma.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Permissao local
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={() => {
                void applyAndSync(() => setEnabled(!config.enabled));
              }}
              className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                config.enabled
                  ? "border-[#2f6f3e] bg-[#102019] text-[#d2f8dd] hover:bg-[#143224]"
                  : "border-[#30363d] bg-[#0d1117] text-[#e6edf3] hover:bg-[#161b22]"
              } disabled:opacity-60`}
            >
              <div className="font-medium">
                {config.enabled ? "Desativar bridge local" : "Ativar bridge local"}
              </div>
              <div className="mt-1 text-[11px] opacity-80">
                Toggle desta instalacao ou deste navegador.
              </div>
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => {
                void applyAndSync(() => rotateToken());
              }}
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-left text-xs text-[#e6edf3] transition-colors hover:bg-[#161b22] disabled:opacity-60"
            >
              <div className="flex items-center gap-2 font-medium">
                <KeyRound className="h-3.5 w-3.5 text-[#d29922]" />
                Rotacionar token
              </div>
              <div className="mt-1 text-[11px] text-[#7d8590]">
                Invalida conexoes antigas do browser ate voce atualizar o token.
              </div>
            </button>
            <div className="rounded-md border border-[#6a4b08] bg-[#201706] px-3 py-3 text-[11px] leading-5 text-[#d29922]">
              Este bridge da acesso a uma shell real da maquina. Use token forte e so habilite quando realmente quiser automacao local.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
