import { describe, expect, it } from "vitest";
import type { AppNode, Project, Workflow } from "@/lib/flow-types";
import { executeProgrammableNode } from "@/lib/node-programming";
import type { ProjectRuntimeStore, RuntimeEnvelope, RuntimeEvaluationContext } from "@/lib/runtime-types";

function createProgrammableNode(code: string) {
  return {
    id: "node_programmable",
    type: "default",
    position: { x: 0, y: 0 },
    data: {
      label: "Programmable",
      nodeType: "action_code",
      parameters: {},
      config: {},
      programmable: {
        mode: "code",
        code,
        outputTemplate: "",
      },
    },
  } as unknown as AppNode;
}

function createContext(node: AppNode) {
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

  return {
    project,
    workflow,
    nodesById: {
      [node.id]: node,
    },
    incomingCounts: {},
    store,
    request: {
      source: "manual",
    },
    logs: [],
  } as RuntimeEvaluationContext;
}

describe("executeProgrammableNode", () => {
  it("executa codigo programavel seguro e retorna a saida", () => {
    const node = createProgrammableNode(`
      return {
        result: {
          total: helpers.toNumber(input.first.amount) + 1,
        },
        summary: "Processed",
      };
    `);

    const input = {
      items: [{ json: { amount: "41" } }],
      meta: {},
      artifacts: [],
    } as RuntimeEnvelope;

    const result = executeProgrammableNode({
      node,
      input,
      context: createContext(node),
    });

    expect(result?.summary).toBe("Processed");
    expect(result?.outputs?.default).toEqual([{ total: 42 }]);
  });

  it("bloqueia codigo programavel que tenta acessar globals inseguros", () => {
    const node = createProgrammableNode(`
      return {
        result: localStorage.getItem("secret"),
      };
    `);

    const input = {
      items: [{ json: { amount: 1 } }],
      meta: {},
      artifacts: [],
    } as RuntimeEnvelope;

    expect(() =>
      executeProgrammableNode({
        node,
        input,
        context: createContext(node),
      }),
    ).toThrow(/capacidades bloqueadas/i);
  });
});
