"use client";

import dynamic from "next/dynamic";
import type { CanvasAppProps } from "@/components/canvas/CanvasApp";

const CanvasApp = dynamic<CanvasAppProps>(() => import("@/components/canvas/CanvasApp"), {
  ssr: false,
});

export function CanvasEntry(props: CanvasAppProps) {
  return <CanvasApp {...props} />;
}
