"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  PlugZap,
  RefreshCcw,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";
import {
  MCP_PROMPT_CATALOG,
  MCP_RESOURCE_CATALOG,
  MCP_TOOL_CATALOG,
} from "@/lib/mcp-catalog";
import { buildMcpConnectionUrl, buildMcpPresetSnippets } from "@/lib/mcp";
import { useMcpStore } from "@/store/useMcpStore";

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

export function McpSettingsPanel() {
  const config = useMcpStore((state) => state.config);
  const desktopStatus = useMcpStore((state) => state.desktopStatus);
  const syncing = useMcpStore((state) => state.syncing);
  const setEnabled = useMcpStore((state) => state.setEnabled);
  const rotateToken = useMcpStore((state) => state.rotateToken);
  const refreshDesktopStatus = useMcpStore((state) => state.refreshDesktopStatus);
  const syncDesktopConfig = useMcpStore((state) => state.syncDesktopConfig);
  const connectionUrl = useMemo(
    () => buildMcpConnectionUrl(desktopStatus, config),
    [config, desktopStatus],
  );
  const presetSnippets = useMemo(
    () => buildMcpPresetSnippets(connectionUrl),
    [connectionUrl],
  );
  const isDesktopAvailable = Boolean(desktopStatus);

  return (
    <div data-testid="settings-mcp-panel" className="space-y-3">
      <div
        data-testid="settings-mcp-status-card"
        className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <SectionTitle
            title="MCP local"
            subtitle="Expose o workspace local e as mutacoes deterministicas do Flow Merge para Cursor, Claude Code, Codex e outros clientes MCP."
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
            <div
              data-testid="settings-mcp-endpoint-card"
              className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                <PlugZap className="h-3.5 w-3.5" />
                Endpoint
              </div>
              <div className="mt-2 break-all text-xs font-medium text-[#e6edf3]">
                {connectionUrl}
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[#7d8590]">
                O token vai na propria URL para manter compatibilidade com clientes que so aceitam `url`.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton value={connectionUrl} />
                <button
                  type="button"
                  onClick={() => {
                    void refreshDesktopStatus();
                    void syncDesktopConfig();
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-[#30363d] px-3 py-2 text-[11px] text-[#9fb3c8] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc]"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Atualizar status
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                  Runtime desktop
                </div>
                <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                  {isDesktopAvailable
                    ? desktopStatus?.running
                      ? "Rodando em localhost"
                      : "Desktop detectado, runtime parado"
                    : "Indisponivel no web build"}
                </div>
                <div className="mt-1 text-[11px] text-[#7d8590]">
                  {isDesktopAvailable
                    ? "O servidor MCP local depende do desktop app aberto nesta maquina."
                    : "Na versao web voce pode ver a configuracao, mas o endpoint local so existe no desktop."}
                </div>
              </div>

              <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                  Auth local
                </div>
                <div className="mt-2 text-xs font-medium text-[#e6edf3]">
                  Token sincronizado no runtime local
                </div>
                <div className="mt-1 text-[11px] text-[#7d8590]">
                  Rotacionar o token invalida configuracoes antigas ate voce atualizar o cliente MCP.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Controle local
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={() => setEnabled(!config.enabled)}
              className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                config.enabled
                  ? "border-[#2f6f3e] bg-[#102019] text-[#d2f8dd] hover:bg-[#143224]"
                  : "border-[#30363d] bg-[#0d1117] text-[#e6edf3] hover:bg-[#161b22]"
              } disabled:opacity-60`}
            >
              <div className="font-medium">
                {config.enabled ? "Desativar servidor MCP" : "Ativar servidor MCP"}
              </div>
              <div className="mt-1 text-[11px] opacity-80">
                Toggle local desta instalacao.
              </div>
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => rotateToken()}
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-left text-xs text-[#e6edf3] transition-colors hover:bg-[#161b22] disabled:opacity-60"
            >
              <div className="flex items-center gap-2 font-medium">
                <KeyRound className="h-3.5 w-3.5 text-[#d29922]" />
                Rotacionar token
              </div>
              <div className="mt-1 text-[11px] text-[#7d8590]">
                Gera um token novo para todas as integracoes.
              </div>
            </button>
            <div className="rounded-md border border-[#6a4b08] bg-[#201706] px-3 py-3 text-[11px] leading-5 text-[#d29922]">
              O endpoint fica preso a `127.0.0.1` e exige token. Isso reduz a superficie, mas continua sendo um servidor local sensivel.
            </div>
          </div>
        </div>
      </div>

      <div
        data-testid="settings-mcp-clients-card"
        className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4"
      >
        <SectionTitle
          title="Clientes"
          subtitle="Snippets prontos para colar no cliente MCP que vai raciocinar com o proprio modelo sobre o seu workspace local."
        />
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {presetSnippets.map((preset) => (
            <div
              key={preset.id}
              className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-[#e6edf3]">
                    {preset.title}
                  </div>
                  <div className="mt-1 text-[11px] text-[#7d8590]">
                    {preset.subtitle}
                  </div>
                </div>
                <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                  {preset.formatLabel}
                </span>
              </div>

              <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                {preset.filePath}
              </div>

              <pre className="mt-2 overflow-x-auto rounded-md border border-[#30363d] bg-[#0d1117] p-3 text-[11px] leading-5 text-[#c9d1d9]">
                <code>{preset.snippet}</code>
              </pre>

              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton value={preset.snippet} />
                {preset.commandHint ? <CopyButton value={preset.commandHint} /> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <SectionTitle
            title="Tools"
            subtitle="Leitura e mutacao direta do canvas. O cliente externo decide; o Flow Merge so aplica no workspace local."
          />
          <div className="mt-3 space-y-3">
            {MCP_TOOL_CATALOG.map((entry) => (
              <div
                key={entry.name}
                className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3"
              >
                <div className="text-xs font-medium text-[#e6edf3]">{entry.title}</div>
                <div className="mt-1 text-[11px] leading-5 text-[#7d8590]">
                  {entry.description}
                </div>
                <div className="mt-2 text-[10px] font-mono text-[#58a6ff]">
                  {entry.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <SectionTitle
            title="Resources"
            subtitle="Contexto local para o cliente MCP ler antes de planejar as mudancas."
          />
          <div className="mt-3 space-y-3">
            {MCP_RESOURCE_CATALOG.map((entry) => (
              <div
                key={entry.name}
                className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3"
              >
                <div className="text-xs font-medium text-[#e6edf3]">{entry.title}</div>
                <div className="mt-1 text-[11px] leading-5 text-[#7d8590]">
                  {entry.description}
                </div>
                <div className="mt-2 text-[10px] font-mono text-[#58a6ff]">
                  {entry.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <SectionTitle
            title="Prompts"
            subtitle="Prompts de orientacao para clientes MCP que suportam prompts nativos."
          />
          <div className="mt-3 space-y-3">
            {MCP_PROMPT_CATALOG.map((entry) => (
              <div
                key={entry.name}
                className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-3"
              >
                <div className="text-xs font-medium text-[#e6edf3]">{entry.title}</div>
                <div className="mt-1 text-[11px] leading-5 text-[#7d8590]">
                  {entry.description}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-[#58a6ff]">
                  <SquareTerminal className="h-3.5 w-3.5" />
                  {entry.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
