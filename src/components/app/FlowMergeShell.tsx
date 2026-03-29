"use client";

import { useEffect } from "react";
import { Network } from "lucide-react";
import { LandingPage } from "@/components/app/LandingPage";
import { CanvasEntry } from "@/components/canvas/CanvasEntry";
import { useAuthStore } from "@/store/useAuthStore";

function BootScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0d1117]">
      <div className="rounded-[28px] border border-[#30363d] bg-[#11161d] px-8 py-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2f6f3e] bg-[#12261a]">
          <Network className="h-6 w-6 text-[#3fb950]" />
        </div>
        <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[#7d8590]">Flow Merge</div>
        <div className="mt-2 text-lg font-semibold text-[#f0f6fc]">Preparing local command center</div>
      </div>
    </div>
  );
}

export function FlowMergeShell() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const session = useAuthStore((state) => state.session);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <BootScreen />;
  }

  if (!session) {
    return <LandingPage />;
  }

  return <CanvasEntry />;
}
