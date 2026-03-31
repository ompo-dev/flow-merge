import type { Metadata } from "next";
import { FlowMergeShell } from "@/components/app/FlowMergeShell";
import { PublicSemanticContent } from "@/components/seo/PublicSemanticContent";
import { StructuredData } from "@/components/seo/StructuredData";
import { LEGAL_LANDING_WORKFLOW_ID } from "@/lib/public-pages";
import { buildLegalStructuredData, buildRouteMetadata } from "@/lib/site";

export const metadata: Metadata = buildRouteMetadata("legal");

export default function LegalPage() {
  return (
    <main>
      <StructuredData data={buildLegalStructuredData()} />
      <PublicSemanticContent route="legal" />
      <FlowMergeShell landingWorkflowId={LEGAL_LANDING_WORKFLOW_ID} />
    </main>
  );
}
