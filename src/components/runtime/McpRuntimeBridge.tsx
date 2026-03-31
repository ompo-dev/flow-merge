"use client";

import { useEffect, useEffectEvent } from "react";
import { runFlowMergeAssistant } from "@/lib/assistant-runner";
import type { McpBridgeRequest, McpBridgeResponse } from "@/lib/mcp";
import {
  completeDesktopMcpRequest,
  listenDesktopMcpRequests,
} from "@/lib/tauri-mcp";
import { useAuthStore } from "@/store/useAuthStore";
import { useFlowStore } from "@/store/useFlowStore";
import { useMcpStore } from "@/store/useMcpStore";

function buildWorkspaceSnapshot() {
  const flowState = useFlowStore.getState();
  const authState = useAuthStore.getState();
  const mcpState = useMcpStore.getState();

  return {
    activeProjectId: flowState.activeProjectId,
    activeWorkflowId: flowState.activeWorkflowId,
    selectedNodeId: flowState.selectedNodeId,
    contextNodeIds: flowState.contextNodeIds,
    projects: flowState.projects.map((project) => ({
      id: project.id,
      name: project.name,
      active: project.active,
      accent: project.accent,
      description: project.description,
    })),
    workflows: flowState.workflows.map((workflow) => ({
      id: workflow.id,
      projectId: workflow.projectId,
      name: workflow.name,
      surface: workflow.surface,
      active: workflow.active,
      tags: workflow.tags,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      description: workflow.description,
    })),
    license: authState.license,
    mcp: {
      enabled: mcpState.config.enabled,
      status: mcpState.desktopStatus,
    },
  };
}

function buildTextResource(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function resolveWorkflowResource(uri: string) {
  const flowState = useFlowStore.getState();
  const prefix = "flowmerge://workflow/";

  if (uri === "flowmerge://workflow/active") {
    const activeWorkflow =
      flowState.workflows.find(
        (workflow) => workflow.id === flowState.activeWorkflowId,
      ) ?? null;
    return buildTextResource(uri, activeWorkflow);
  }

  if (uri.startsWith(prefix)) {
    const workflowId = decodeURIComponent(uri.slice(prefix.length));
    const workflow =
      flowState.workflows.find((item) => item.id === workflowId) ?? null;
    return buildTextResource(uri, workflow);
  }

  return null;
}

function buildContextNodes(workflowId: string, contextNodeIds: string[]) {
  const flowState = useFlowStore.getState();
  const workflow = flowState.workflows.find((item) => item.id === workflowId);
  if (!workflow) return [];

  return contextNodeIds
    .map((nodeId) => workflow.nodes.find((node) => node.id === nodeId))
    .filter(Boolean)
    .map((node) => ({
      id: node!.id,
      label: String(node!.data.label),
      nodeType: node!.data.nodeType,
      icon: node!.data.icon,
      accent: node!.data.accent,
      parameters: node!.data.parameters,
      config: node!.data.config,
    }));
}

async function handleReadResource(uri: string) {
  if (uri === "flowmerge://workspace/snapshot") {
    return buildTextResource(uri, buildWorkspaceSnapshot());
  }

  if (uri === "flowmerge://license/status") {
    return buildTextResource(uri, useAuthStore.getState().license);
  }

  return resolveWorkflowResource(uri);
}

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function coerceHistory(
  value: unknown,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as { role?: unknown; content?: unknown };
      if (
        (candidate.role !== "user" && candidate.role !== "assistant") ||
        typeof candidate.content !== "string"
      ) {
        return null;
      }

      return {
        role: candidate.role,
        content: candidate.content,
      };
    })
    .filter(Boolean) as Array<{ role: "user" | "assistant"; content: string }>;
}

export function McpRuntimeBridge() {
  const license = useAuthStore((state) => state.license);
  const hydrate = useMcpStore((state) => state.hydrate);
  const hydrated = useMcpStore((state) => state.hydrated);
  const config = useMcpStore((state) => state.config);
  const refreshDesktopStatus = useMcpStore((state) => state.refreshDesktopStatus);
  const syncDesktopConfig = useMcpStore((state) => state.syncDesktopConfig);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshDesktopStatus();
    void syncDesktopConfig();
  }, [hydrated, refreshDesktopStatus, syncDesktopConfig]);

  useEffect(() => {
    if (!hydrated) return;
    void syncDesktopConfig();
  }, [
    config.authToken,
    config.enabled,
    config.serverName,
    hydrated,
    syncDesktopConfig,
  ]);

  useEffect(() => {
    if (!hydrated) return;

    const intervalId = window.setInterval(() => {
      void refreshDesktopStatus();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hydrated, refreshDesktopStatus]);

  const onMcpRequest = useEffectEvent(async (request: McpBridgeRequest) => {
    const complete = async (response: McpBridgeResponse) => {
      await completeDesktopMcpRequest(response);
    };

    try {
      switch (request.kind) {
        case "get_workspace_snapshot": {
          await complete({
            requestId: request.requestId,
            ok: true,
            payload: buildWorkspaceSnapshot(),
          });
          return;
        }

        case "get_workflow": {
          const workflowId = coerceString(request.payload?.workflowId);
          const flowState = useFlowStore.getState();
          const workflow =
            flowState.workflows.find((item) => item.id === workflowId) ??
            flowState.workflows.find(
              (item) => item.id === flowState.activeWorkflowId,
            ) ??
            null;

          await complete({
            requestId: request.requestId,
            ok: true,
            payload: workflow,
          });
          return;
        }

        case "set_active_workflow": {
          if (!license.authenticated || !license.canAccessWorkspace) {
            throw new Error("Workspace indisponivel para esta conta.");
          }

          const workflowId = coerceString(request.payload?.workflowId);
          if (!workflowId) {
            throw new Error("workflowId obrigatorio.");
          }

          const flowState = useFlowStore.getState();
          const workflow = flowState.workflows.find((item) => item.id === workflowId);
          if (!workflow) {
            throw new Error("Workflow nao encontrado.");
          }

          flowState.setActiveProject(workflow.projectId);
          flowState.setActiveWorkflow(workflow.id);

          await complete({
            requestId: request.requestId,
            ok: true,
            payload: {
              workflowId: workflow.id,
              projectId: workflow.projectId,
              name: workflow.name,
            },
          });
          return;
        }

        case "read_resource": {
          const uri = coerceString(request.payload?.uri);
          if (!uri) {
            throw new Error("uri obrigatoria.");
          }

          const resource = await handleReadResource(uri);
          if (!resource) {
            throw new Error("Recurso MCP nao encontrado.");
          }

          await complete({
            requestId: request.requestId,
            ok: true,
            payload: resource,
          });
          return;
        }

        case "run_assistant": {
          if (!license.authenticated || !license.canAccessWorkspace) {
            throw new Error("Conta sem acesso ao workspace local.");
          }

          const flowState = useFlowStore.getState();
          const prompt = coerceString(request.payload?.prompt);
          const workflowId =
            coerceString(request.payload?.workflowId) || flowState.activeWorkflowId;
          const applyChanges = request.payload?.applyChanges !== false;
          const history = coerceHistory(request.payload?.history);
          const contextNodeIds = coerceStringArray(request.payload?.contextNodeIds);

          if (!prompt) {
            throw new Error("prompt obrigatorio.");
          }

          const workflow = flowState.workflows.find((item) => item.id === workflowId);
          if (!workflow) {
            throw new Error("Workflow alvo nao encontrado.");
          }

          if (applyChanges && flowState.activeWorkflowId !== workflow.id) {
            flowState.setActiveProject(workflow.projectId);
            flowState.setActiveWorkflow(workflow.id);
          }

          const latestState = useFlowStore.getState();
          const targetWorkflow =
            latestState.workflows.find((item) => item.id === workflow.id) ?? workflow;

          const result = await runFlowMergeAssistant({
            prompt,
            apiKey: latestState.deepseekKey,
            history,
            contextNodes: buildContextNodes(workflow.id, contextNodeIds),
            workflow: targetWorkflow,
            existingNodes: targetWorkflow.nodes,
            applyChanges,
            addAiNodes: latestState.addAiNodes,
            updateNodeData: latestState.updateNodeData,
            deleteNode: latestState.deleteNode,
            onConnect: latestState.onConnect,
          });

          await complete({
            requestId: request.requestId,
            ok: true,
            payload: {
              workflowId: workflow.id,
              applyChanges,
              createdNodeIds: result.createdNodes.map((node) => node.id),
              appliedEdges: result.appliedEdges,
              response: result.response,
            },
          });
          return;
        }

        default:
          throw new Error("Tipo de request MCP nao suportado.");
      }
    } catch (error) {
      await complete({
        requestId: request.requestId,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao processar request MCP.",
      });
    }
  });

  useEffect(() => {
    let dispose = () => {};

    const setup = async () => {
      dispose = await listenDesktopMcpRequests(async (request) => {
        await onMcpRequest(request);
      });
    };

    void setup();

    return () => {
      dispose();
    };
  }, [onMcpRequest]);

  return null;
}
