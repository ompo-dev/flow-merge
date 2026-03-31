import { expect, test } from "@playwright/test";
import {
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
} from "./helpers/license-fixtures";
import { seedLegacyFlowMergeStorage } from "./helpers/storage-fixtures";

test("executa um trigger no canvas e propaga o resultado para os nodes seguintes", async ({
  page,
}) => {
  const license = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
  });

  const project = {
    id: "proj_exec",
    name: "Projeto Execucao",
    accent: "#1f6feb",
    active: true,
  };
  const workflow = {
    id: "wf_exec",
    projectId: project.id,
    name: "Workflow Execucao",
    accent: "#58a6ff",
    active: true,
    nodes: [
      {
        id: "exec-trigger",
        type: "triggerNode",
        position: { x: 80, y: 180 },
        data: {
          label: "Exec Trigger",
          nodeType: "trigger_manual",
          parameters: {},
          config: {},
        },
      },
      {
        id: "exec-set",
        type: "actionNode",
        position: { x: 360, y: 180 },
        data: {
          label: "Set Plan",
          nodeType: "action_set",
          parameters: {
            "Field Name": "plan",
            "Field Value": "pro",
          },
          config: {},
        },
      },
      {
        id: "exec-table",
        type: "vizNode",
        position: { x: 660, y: 180 },
        data: {
          label: "Tabela de Saida",
          nodeType: "viz_table",
          parameters: {},
          config: {
            columns: "plan",
            maxRows: 3,
          },
        },
      },
    ],
    edges: [
      { id: "exec-trigger-exec-set", source: "exec-trigger", target: "exec-set" },
      { id: "exec-set-exec-table", source: "exec-set", target: "exec-table" },
    ],
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    tags: ["execution"],
    description: "Workflow simples para validar execucao manual",
  };

  await seedClientState(page, license, { releaseChannel: "stable" });
  await seedLegacyFlowMergeStorage(page, {
    projects: [project],
    workflows: [workflow],
  });
  await mockLicenseStatus(page, () => license);

  await page.goto("/");

  await expect(page.getByTestId("rf__node-exec-trigger")).toBeVisible();

  await page.getByTestId("rf__node-exec-trigger").click();
  await expect(page.getByRole("button", { name: "Testar" })).toBeVisible();
  await page.getByRole("button", { name: "Testar" }).click();
  await page.getByRole("button", { name: "Executar Teste do Trigger" }).click();

  await expect(page.getByTestId("rf__node-exec-trigger")).toContainText(
    "Exec Trigger emitted 1 event",
  );
  await expect(page.getByTestId("rf__node-exec-set")).toContainText("Set plan");
  await expect(page.getByTestId("rf__node-exec-table")).toContainText("pro");
});
