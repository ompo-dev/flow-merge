import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAllThreads } from "@/lib/storage/chat-store";
import { migrateFromLocalStorageIfNeeded } from "@/lib/storage/migrate-from-localstorage";
import { getAllProjects } from "@/lib/storage/projects-store";
import { getProjectRuntimeStore } from "@/lib/storage/runtime-store";
import { getSetting, setSetting } from "@/lib/storage/settings-store";
import { getAllWorkflows } from "@/lib/storage/workflows-store";
import {
  cleanupIndexedDbForTests,
  createChatThreadFixture,
  createLicenseFixture,
  createMcpConfigFixture,
  createProjectFixture,
  createRuntimeCollectionRecord,
  createRuntimeStoreFixture,
  createUpdaterFixture,
  createWorkflowFixture,
  installWindowMock,
  resetIndexedDbForTests,
} from "../../../tests/helpers/storage-test-utils";

describe("storage/migrate-from-localstorage", () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  afterEach(async () => {
    await cleanupIndexedDbForTests();
  });

  it("migra dados legados para IndexedDB e limpa as chaves antigas", async () => {
    const project = createProjectFixture({ id: "legacy_project", name: "Legacy Project" });
    const workflow = createWorkflowFixture(project.id, {
      id: "legacy_workflow",
      name: "Legacy Workflow",
    });
    const runtimeStore = createRuntimeStoreFixture({
      collections: {
        revenue: [createRuntimeCollectionRecord({ id: "revenue_1", payload: { amount: 149 } })],
      },
      lastUpdatedAt: 500,
    });
    const chatThread = createChatThreadFixture({ id: "thread_legacy" });
    const updater = createUpdaterFixture({ availableVersion: "0.3.0" });
    const license = createLicenseFixture();
    const mcpConfig = createMcpConfigFixture();

    const windowMock = installWindowMock({
      "flow-merge-projects": JSON.stringify([project]),
      "flow-merge-workflows": JSON.stringify([workflow]),
      "flow-merge-runtime-store": JSON.stringify({
        version: 1,
        projects: {
          [project.id]: runtimeStore,
        },
      }),
      "flow-merge-chat-threads": JSON.stringify([chatThread]),
      "flow-merge-deepseek-key": "sk-legacy",
      "flow-merge-active-chat-id": chatThread.id,
      "flow-merge-updater": JSON.stringify(updater),
      "flow-merge-license-cache": JSON.stringify(license),
      "flow-merge-last-user-id": "user_legacy",
      "flow-merge-mcp-config": JSON.stringify(mcpConfig),
    });

    try {
      await migrateFromLocalStorageIfNeeded(
        [createProjectFixture({ id: "seed_project" })],
        [createWorkflowFixture("seed_project", { id: "seed_workflow" })],
      );

      await expect(getAllProjects()).resolves.toEqual([project]);
      await expect(getAllWorkflows()).resolves.toEqual([workflow]);
      await expect(getProjectRuntimeStore(project.id)).resolves.toEqual(runtimeStore);
      await expect(getAllThreads()).resolves.toEqual([chatThread]);
      await expect(getSetting("deepseek-key")).resolves.toBe("sk-legacy");
      await expect(getSetting("active-chat-id")).resolves.toBe(chatThread.id);
      await expect(getSetting("updater")).resolves.toEqual(updater);
      await expect(getSetting("license-cache")).resolves.toEqual(license);
      await expect(getSetting("last-user-id")).resolves.toBe("user_legacy");
      await expect(getSetting("mcp-config")).resolves.toEqual(mcpConfig);
      await expect(getSetting("migrated_v1")).resolves.toBe(true);

      expect(windowMock.dump()).toEqual({});
    } finally {
      windowMock.restore();
    }
  });

  it("usa os seeds quando nao encontra dados legados", async () => {
    const seedProject = createProjectFixture({ id: "seed_project" });
    const seedWorkflow = createWorkflowFixture(seedProject.id, { id: "seed_workflow" });
    const windowMock = installWindowMock();

    try {
      await migrateFromLocalStorageIfNeeded([seedProject], [seedWorkflow]);

      await expect(getAllProjects()).resolves.toEqual([seedProject]);
      await expect(getAllWorkflows()).resolves.toEqual([seedWorkflow]);
      await expect(getSetting("migrated_v1")).resolves.toBe(true);
    } finally {
      windowMock.restore();
    }
  });

  it("nao remigra quando a flag migrated_v1 ja existe", async () => {
    const existingProject = createProjectFixture({ id: "existing_project" });
    await setSetting("migrated_v1", true);
    const windowMock = installWindowMock({
      "flow-merge-projects": JSON.stringify([
        createProjectFixture({ id: "legacy_project", name: "Legacy Project" }),
      ]),
    });

    try {
      await migrateFromLocalStorageIfNeeded(
        [existingProject],
        [createWorkflowFixture(existingProject.id, { id: "existing_workflow" })],
      );

      await expect(getAllProjects()).resolves.toEqual([]);
      expect(windowMock.dump()).toEqual({
        "flow-merge-projects": JSON.stringify([
          createProjectFixture({ id: "legacy_project", name: "Legacy Project" }),
        ]),
      });
    } finally {
      windowMock.restore();
    }
  });
});
