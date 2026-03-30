"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, RefreshCw } from "lucide-react";
import type { LicenseStatusPayload } from "@/lib/license";

function formatDateLabel(value: string | null) {
  if (!value) return "agora";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPixPayload(charge: NonNullable<LicenseStatusPayload["billing"]["activeCharge"]>) {
  const payload = charge.qrCodePayload;
  if (!payload || typeof payload !== "object") {
    return {
      qrCodeImage: undefined,
      brCode: undefined,
    };
  }

  return {
    qrCodeImage:
      "brCodeBase64" in payload && typeof payload.brCodeBase64 === "string"
        ? payload.brCodeBase64
        : undefined,
    brCode:
      "brCode" in payload && typeof payload.brCode === "string" ? payload.brCode : undefined,
  };
}

export function PixChargeCard({
  charge,
  onRefresh,
  className = "",
}: {
  charge: NonNullable<LicenseStatusPayload["billing"]["activeCharge"]>;
  onRefresh?: () => Promise<unknown>;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { qrCodeImage, brCode } = getPixPayload(charge);

  const handleCopy = async () => {
    if (!brCode || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;

    await navigator.clipboard.writeText(brCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={`rounded-3xl border border-[#30363d] bg-[#11161d] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)] ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">PIX ativo</div>
          <div className="mt-2 text-base font-semibold text-[#f0f6fc]">
            {charge.planType === "monthly" ? "Pro Mensal" : "Founder Lifetime"}
          </div>
          <div className="mt-1 text-sm text-[#8b949e]">
            Pagamento vence em {formatDateLabel(charge.dueAt)}.
          </div>
        </div>

        {onRefresh ? (
          <button
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#30363d] px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-[#9fb3c8] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        ) : null}
      </div>

      {qrCodeImage ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#30363d] bg-white p-3">
          <Image
            src={qrCodeImage}
            alt="QRCode PIX Flow Merge"
            width={192}
            height={192}
            unoptimized
            className="mx-auto h-48 w-48 object-contain"
          />
        </div>
      ) : null}

      {brCode ? (
        <div className="mt-4 rounded-2xl border border-[#21262d] bg-[#0d1117] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">
              Codigo copia e cola
            </div>
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[#30363d] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[#9fb3c8] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="mt-2 break-all font-mono text-[11px] leading-6 text-[#9fb3c8]">
            {brCode}
          </div>
        </div>
      ) : null}
    </div>
  );
}
