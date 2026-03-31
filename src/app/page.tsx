import type { Metadata } from "next";
import { FlowMergeShell } from "@/components/app/FlowMergeShell";
import { PublicSemanticContent } from "@/components/seo/PublicSemanticContent";
import { StructuredData } from "@/components/seo/StructuredData";
import { buildHomeStructuredData, buildRouteMetadata } from "@/lib/site";

export const metadata: Metadata = buildRouteMetadata("home");

export default function Home() {
  return (
    <main>
      <StructuredData data={buildHomeStructuredData()} />
      <PublicSemanticContent route="home" />
      <FlowMergeShell />
    </main>
  );
}
