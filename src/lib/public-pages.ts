export const LANDING_PROJECT_ID = "proj_landing";
export const DEFAULT_LANDING_WORKFLOW_ID = "wf_landing_overview";
export const LEGAL_LANDING_WORKFLOW_ID = "wf_landing_legal";
export const LANDING_HOME_ACCESS_NODE_ID = "landing-home-access";
export const LANDING_LEGAL_ACCESS_NODE_ID = "landing-legal-access";

export function getLandingRouteByWorkflowId(workflowId: string) {
  if (workflowId === LEGAL_LANDING_WORKFLOW_ID) return "/legal";
  if (workflowId === DEFAULT_LANDING_WORKFLOW_ID) return "/";
  return null;
}

export function getLandingWorkflowIdByPathname(pathname: string) {
  return pathname === "/legal"
    ? LEGAL_LANDING_WORKFLOW_ID
    : DEFAULT_LANDING_WORKFLOW_ID;
}
