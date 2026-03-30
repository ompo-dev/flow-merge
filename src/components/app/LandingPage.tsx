"use client";

import { useEffect } from "react";
import { CanvasEntry } from "@/components/canvas/CanvasEntry";
import {
  DEFAULT_LANDING_WORKFLOW_ID,
  LANDING_PROJECT_ID,
} from "@/lib/mock-data";
import { useFlowStore } from "@/store/useFlowStore";

function focusAccessNode() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("flow-merge-focus-node", {
      detail: { nodeId: "landing-home-access" },
    }),
  );
}

export function LandingPage() {
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
    if (state.workflows.some((workflow) => workflow.id === DEFAULT_LANDING_WORKFLOW_ID)) {
      state.setActiveWorkflow(DEFAULT_LANDING_WORKFLOW_ID);
    }

    return () => {
      const current = useFlowStore.getState();
      current.clearContextNodes();
      current.setRightClickCtx(null);
      current.setAddNodePanel(previous.isAddNodePanelOpen);
      current.setActiveTool(previous.activeTool);
      current.setShowSettings(previous.showSettings);
      current.setChatExpanded(previous.chatExpanded);

      if (current.projects.some((project) => project.id === previous.activeProjectId)) {
        current.setActiveProject(previous.activeProjectId);
      }
      if (current.workflows.some((workflow) => workflow.id === previous.activeWorkflowId)) {
        current.setActiveWorkflow(previous.activeWorkflowId);
      }

      current.setSelectedNodeId(previous.selectedNodeId);
    };
  }, []);

  return <CanvasEntry mode="landing" onAccessClick={focusAccessNode} />;
}
