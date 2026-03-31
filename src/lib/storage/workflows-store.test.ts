import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteWorkflow,
  deleteWorkflowsByProject,
  getAllWorkflows,
  getWorkflow,
  getWorkflowsByProject,
  saveAllWorkflows,
  saveWorkflow,
} from "@/lib/storage/workflows-store";
import {
  cleanupIndexedDbForTests,
  createWorkflowFixture,
  resetIndexedDbForTests,
} from "../../../tests/helpers/storage-test-utils";

describe("storage/workflows-store", () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  afterEach(async () => {
    await cleanupIndexedDbForTests();
  });

  it("salva workflows e consulta por id e por projeto", async () => {
    const workflowA = createWorkflowFixture("project_a", { id: "workflow_a" });
    const workflowB = createWorkflowFixture("project_b", { id: "workflow_b" });

    await saveWorkflow(workflowA);
    await saveWorkflow(workflowB);

    await expect(getWorkflow(workflowA.id)).resolves.toEqual(workflowA);
    await expect(getAllWorkflows()).resolves.toEqual([workflowA, workflowB]);
    await expect(getWorkflowsByProject("project_a")).resolves.toEqual([workflowA]);
  });

  it("saveAllWorkflows substitui a colecao inteira", async () => {
    await saveWorkflow(createWorkflowFixture("project_legacy", { id: "workflow_legacy" }));
    const nextWorkflows = [
      createWorkflowFixture("project_a", { id: "workflow_a" }),
      createWorkflowFixture("project_a", { id: "workflow_b", name: "Workflow B" }),
    ];

    await saveAllWorkflows(nextWorkflows);

    await expect(getAllWorkflows()).resolves.toEqual(nextWorkflows);
    await expect(getWorkflowsByProject("project_legacy")).resolves.toEqual([]);
  });

  it("remove workflow individual e limpa todos de um projeto", async () => {
    const workflowA = createWorkflowFixture("project_a", { id: "workflow_a" });
    const workflowB = createWorkflowFixture("project_a", { id: "workflow_b" });
    const workflowC = createWorkflowFixture("project_b", { id: "workflow_c" });
    await saveAllWorkflows([workflowA, workflowB, workflowC]);

    await deleteWorkflow(workflowA.id);
    await expect(getAllWorkflows()).resolves.toEqual([workflowB, workflowC]);

    await deleteWorkflowsByProject("project_a");
    await expect(getAllWorkflows()).resolves.toEqual([workflowC]);
  });
});
