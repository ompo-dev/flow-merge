import { expect, test } from "@playwright/test";
import {
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
} from "./helpers/license-fixtures";
import {
  readFlowMergeDbSnapshot,
  readLegacyFlowMergeStorage,
  seedLegacyFlowMergeStorage,
} from "./helpers/storage-fixtures";

test("rehidrata projetos e workflows do IndexedDB apos reload sem depender do localStorage", async ({
  page,
}) => {
  const license = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
  });

  const project = {
    id: "proj_persist",
    name: "Projeto Persistente",
    accent: "#3fb950",
    active: true,
  };
  const workflow = {
    id: "wf_persist",
    projectId: project.id,
    name: "Workflow Persistente",
    accent: "#58a6ff",
    active: true,
    nodes: [
      {
        id: "persist-trigger",
        type: "triggerNode",
        position: { x: 80, y: 180 },
        data: {
          label: "Persist Trigger",
          nodeType: "trigger_manual",
          parameters: {},
          config: {},
        },
      },
    ],
    edges: [],
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    tags: ["persistence"],
    description: "Workflow para validar rehidratacao",
  };

  await seedClientState(page, license, { releaseChannel: "stable" });
  await seedLegacyFlowMergeStorage(page, {
    projects: [project],
    workflows: [workflow],
  });
  await mockLicenseStatus(page, () => license);

  await page.goto("/");
  await expect(page.getByTestId("rf__node-persist-trigger")).toBeVisible();

  let snapshot = await readFlowMergeDbSnapshot(page);
  expect(snapshot.projects[0]?.id).toBe("proj_persist");
  expect(snapshot.workflows[0]?.id).toBe("wf_persist");

  await page.evaluate(() => {
    window.localStorage.removeItem("flow-merge-projects");
    window.localStorage.removeItem("flow-merge-workflows");
  });

  await page.reload();

  await expect(page.getByTestId("rf__node-persist-trigger")).toBeVisible();

  snapshot = await readFlowMergeDbSnapshot(page);
  expect(snapshot.projects[0]?.id).toBe("proj_persist");
  expect(snapshot.workflows[0]?.id).toBe("wf_persist");

  const legacyStorage = await readLegacyFlowMergeStorage(page);
  expect(legacyStorage.projects).toBeNull();
  expect(legacyStorage.workflows).toBeNull();
});
