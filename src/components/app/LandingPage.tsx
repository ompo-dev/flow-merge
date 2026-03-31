"use client";

import { useEffect } from "react";
import { CanvasEntry } from "@/components/canvas/CanvasEntry";
import {
  DEFAULT_LANDING_WORKFLOW_ID,
  LEGAL_LANDING_WORKFLOW_ID,
  LANDING_HOME_ACCESS_NODE_ID,
  LANDING_LEGAL_ACCESS_NODE_ID,
  LANDING_PROJECT_ID,
} from "@/lib/public-pages";
import { useFlowStore } from "@/store/useFlowStore";

interface LandingPageProps {
  initialWorkflowId?: string;
}

function getLandingAccessTarget(workflowId: string) {
  if (workflowId === LEGAL_LANDING_WORKFLOW_ID) {
    return {
      workflowId: LEGAL_LANDING_WORKFLOW_ID,
      nodeId: LANDING_LEGAL_ACCESS_NODE_ID,
    };
  }

  return {
    workflowId: DEFAULT_LANDING_WORKFLOW_ID,
    nodeId: LANDING_HOME_ACCESS_NODE_ID,
  };
}

function focusAccessNode(workflowId: string) {
  const target = getLandingAccessTarget(workflowId);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("flow-merge-focus-node", {
      detail: target,
    }),
  );
}

export function LandingPage({
  initialWorkflowId = DEFAULT_LANDING_WORKFLOW_ID,
}: LandingPageProps) {
  const activeWorkflowId = useFlowStore((state) => state.activeWorkflowId);

  useEffect(() => {
    const state = useFlowStore.getState();
    const previous = {
      activeProjectId: state.activeProjectId,
      activeWorkflowId: state.activeWorkflowId,
      selectedNodeId: state.selectedNodeId,
      isAddNodePanelOpen: state.isAddNodePanelOpen,
      activeTool: state.activeTool,
      showSettings: state.showSettings,
      chatExpanded: state.chatExpanded,
    };

    state.clearContextNodes();
    state.setSelectedNodeId(null);
    state.setAddNodePanel(false);
    state.setRightClickCtx(null);
    state.setActiveTool("select");
    state.setShowSettings(false);
    state.setChatExpanded(false);

    if (state.projects.some((project) => project.id === LANDING_PROJECT_ID)) {
      state.setActiveProject(LANDING_PROJECT_ID);
    }
    if (state.workflows.some((workflow) => workflow.id === initialWorkflowId)) {
      state.setActiveWorkflow(initialWorkflowId);
    }

    return () => {
      const current = useFlowStore.getState();
      current.clearContextNodes();
      current.setRightClickCtx(null);
      current.setAddNodePanel(previous.isAddNodePanelOpen);
      current.setActiveTool(previous.activeTool);
      current.setShowSettings(previous.showSettings);
      current.setChatExpanded(previous.chatExpanded);

      if (
        current.projects.some(
          (project) => project.id === previous.activeProjectId,
        )
      ) {
        current.setActiveProject(previous.activeProjectId);
      }
      if (
        current.workflows.some(
          (workflow) => workflow.id === previous.activeWorkflowId,
        )
      ) {
        current.setActiveWorkflow(previous.activeWorkflowId);
      }

      current.setSelectedNodeId(previous.selectedNodeId);
    };
  }, [initialWorkflowId]);

  return (
    <CanvasEntry
      mode="landing"
      onAccessClick={() => focusAccessNode(activeWorkflowId)}
    />
  );
}
