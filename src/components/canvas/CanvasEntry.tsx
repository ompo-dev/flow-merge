"use client";

import dynamic from "next/dynamic";

const CanvasApp = dynamic(() => import("@/components/canvas/CanvasApp"), {
  ssr: false,
});

export function CanvasEntry() {
  return <CanvasApp />;
}
