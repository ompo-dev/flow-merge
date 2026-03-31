import { describe, expect, it } from "vitest";
import type { AppNode, Project, Workflow } from "@/lib/flow-types";
import { executeWorkflowRun } from "@/lib/runtime-engine";
import type { ProjectRuntimeStore } from "@/lib/runtime-types";

function createActionCodeNode(code: string) {
  return {
    id: "node_action_code",
    type: "default",
    position: { x: 0, y: 0 },
    data: {
      label: "Code",
      nodeType: "action_code",
      parameters: {
        Code: code,
      },
      config: {},
    },
  } as unknown as AppNode;
}

function createWorkflowFixture(node: AppNode) {
  const project = {
    id: "project_1",
    name: "Project",
    active: true,
  } as Project;

  const workflow = {
    id: "workflow_1",
    projectId: "project_1",
    name: "Workflow",
    active: true,
    nodes: [node],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  } as Workflow;

  const store = {
    collections: {},
    lastUpdatedAt: null,
  } as ProjectRuntimeStore;

  return { project, workflow, store };
}

describe("executeWorkflowRun", () => {
  it("mantem o workflow funcional com action_code seguro", async () => {
    const node = createActionCodeNode(`
      return items.map((item) => ({
        echoedEvent: item.json.event,
      }));
    `);
    const { project, workflow, store } = createWorkflowFixture(node);

    const result = await executeWorkflowRun({
      project,
      workflow,
      store,
      request: {
        source: "manual",
      },
    });

    expect(result.executionStatus).toBe("success");
    expect(result.nodeSnapshots[node.id]?.status).toBe("success");
    expect(result.itemsProcessed).toBeGreaterThan(0);
  });

  it("marca erro quando action_code tenta usar capacidades bloqueadas", async () => {
    const node = createActionCodeNode(`
      return localStorage.getItem("token");
    `);
    const { project, workflow, store } = createWorkflowFixture(node);

    const result = await executeWorkflowRun({
      project,
      workflow,
      store,
      request: {
        source: "manual",
      },
    });

    expect(result.executionStatus).toBe("error");
    expect(result.nodeSnapshots[node.id]?.status).toBe("error");
    expect(result.nodeSnapshots[node.id]?.summary).toMatch(/capacidades bloqueadas/i);
  });
});
