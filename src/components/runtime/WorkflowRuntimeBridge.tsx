"use client";

import { useEffect, useMemo } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import type { RuntimeWebhookRoute } from "@/lib/runtime-types";
import {
  completeDesktopWebhookDelivery,
  getDesktopRuntimeStatus,
  listenDesktopWebhookDeliveries,
  syncDesktopWebhookRoutes,
} from "@/lib/tauri-runtime";

function normalizeParameterLookup(parameters: Record<string, string> | undefined, label: string) {
  const entries = Object.entries(parameters ?? {});
  const match = entries.find(([key]) => key.trim().toLowerCase() === label.trim().toLowerCase());
  return (match?.[1] ?? "").trim();
}

function parseScheduleInterval(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 300_000;
  if (normalized.includes("15")) return 900_000;
  if (normalized.includes("30")) return 1_800_000;
  if (normalized.includes("hour")) return 3_600_000;
  if (normalized.includes("day")) return 86_400_000;
  if (normalized.includes("minute")) {
    const match = normalized.match(/(\d+)/);
    const amount = match ? Number(match[1]) : 5;
    return amount * 60_000;
  }
  return 300_000;
}

export function WorkflowRuntimeBridge() {
  const workflows = useFlowStore((state) => state.workflows);
  const projects = useFlowStore((state) => state.projects);
  const runWorkflow = useFlowStore((state) => state.runWorkflow);
  const runWorkflowFromWebhook = useFlowStore((state) => state.runWorkflowFromWebhook);
  const setRuntimeBaseUrl = useFlowStore((state) => state.setRuntimeBaseUrl);

  const webhookRoutes = useMemo(() => {
    return workflows.flatMap((workflow) =>
      workflow.nodes
        .filter((node) => node.data.nodeType === "trigger_webhook")
        .map((node) => ({
          path:
            normalizeParameterLookup(node.data.parameters, "Path") ||
            `/webhooks/${workflow.id}/${node.id}`,
          workflowId: workflow.id,
          nodeId: node.id,
          method:
            normalizeParameterLookup(node.data.parameters, "HTTP Method") || "POST",
          secretToken:
            normalizeParameterLookup(node.data.parameters, "Secret Token") || undefined,
        })),
    );
  }, [workflows]);

  useEffect(() => {
    let disposed = false;

    const syncRuntime = async () => {
      const status = await getDesktopRuntimeStatus();
      if (disposed) return;

      if (status?.running) {
        setRuntimeBaseUrl(status.baseUrl);
      } else {
        setRuntimeBaseUrl(null);
      }

      await syncDesktopWebhookRoutes(webhookRoutes as RuntimeWebhookRoute[]);
    };

    void syncRuntime();

    return () => {
      disposed = true;
    };
  }, [setRuntimeBaseUrl, webhookRoutes]);

  useEffect(() => {
    let mounted = true;
    let disposeListener = () => {};

    const setup = async () => {
      disposeListener = await listenDesktopWebhookDeliveries(async (delivery) => {
        const response = await runWorkflowFromWebhook(delivery);
        if (!mounted || !response) return;

        await completeDesktopWebhookDelivery({
          deliveryId: delivery.deliveryId,
          status: response.status,
          body: response.body,
          headers: response.headers,
        });
      });
    };

    void setup();

    return () => {
      mounted = false;
      disposeListener();
    };
  }, [runWorkflowFromWebhook]);

  useEffect(() => {
    const intervals = workflows.flatMap((workflow) => {
      const project = projects.find((item) => item.id === workflow.projectId);
      if (!workflow.active || !project?.active) return [];

      return workflow.nodes
        .filter((node) => node.data.nodeType === "trigger_schedule")
        .map((node) => {
          const interval = parseScheduleInterval(
            normalizeParameterLookup(node.data.parameters, "Trigger Interval"),
          );
          return window.setInterval(() => {
            void runWorkflow({
              source: "schedule",
              triggerNodeId: node.id,
              payload: {
                timestamp: new Date().toISOString(),
                trigger: "schedule",
                workflowId: workflow.id,
                nodeId: node.id,
              },
            });
          }, interval);
        });
    });

    return () => {
      intervals.forEach((intervalId) => {
        window.clearInterval(intervalId);
      });
    };
  }, [projects, runWorkflow, workflows]);

  return null;
}
