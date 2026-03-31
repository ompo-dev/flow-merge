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

test("migra workspace legado para IndexedDB no primeiro boot", async ({ page }) => {
  const license = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
  });

  const project = {
    id: "proj_migration",
    name: "Projeto Migrado",
    accent: "#1f6feb",
    active: true,
  };
  const workflow = {
    id: "wf_migration",
    projectId: project.id,
    name: "Workflow Migrado",
    accent: "#58a6ff",
    active: true,
    nodes: [
      {
        id: "migration-trigger",
        type: "triggerNode",
        position: { x: 80, y: 180 },
        data: {
          label: "Migration Trigger",
          nodeType: "trigger_manual",
          parameters: {},
          config: {},
        },
      },
    ],
    edges: [],
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    tags: ["migration"],
    description: "Workflow legado vindo do localStorage",
  };
  const runtimeStore = {
    version: 1,
    projects: {
      [project.id]: {
        collections: {
          revenue: [
            {
              id: "revenue_1",
              timestamp: 1774939704446,
              sourceNodeId: "seed",
              payload: { amount: 149, product: "starter" },
            },
          ],
        },
        lastUpdatedAt: 1774939704446,
      },
    },
  };
  const chatThreads = [
    {
      id: "thread_migration",
      title: "Thread migrada",
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      createdAt: 1774939704446,
      updatedAt: 1774939704446,
    },
  ];
  const mcpConfig = {
    enabled: true,
    authToken: "token-migration",
    serverName: "flow-merge-mcp",
  };

  await seedClientState(page, license, { releaseChannel: "stable" });
  await seedLegacyFlowMergeStorage(page, {
    projects: [project],
    workflows: [workflow],
    runtimeStore,
    deepseekKey: "sk-migration",
    chatThreads,
    activeChatId: "thread_migration",
    mcpConfig,
  });
  await mockLicenseStatus(page, () => license);

  await page.goto("/");

  await expect(page.getByTestId("rf__node-migration-trigger")).toBeVisible();

  const snapshot = await readFlowMergeDbSnapshot(page);
  expect(snapshot.projects).toEqual([project]);
  expect(snapshot.workflows).toHaveLength(1);
  expect(snapshot.workflows[0]?.id).toBe("wf_migration");
  expect(snapshot.runtimeCollections).toHaveLength(1);
  expect(snapshot.chatThreads).toHaveLength(1);
  expect(snapshot.settings["deepseek-key"]).toBe("sk-migration");
  expect(snapshot.settings["active-chat-id"]).toBe("thread_migration");
  expect(snapshot.settings["mcp-config"]).toEqual(mcpConfig);
  expect(snapshot.settings.migrated_v1).toBe(true);

  const legacyStorage = await readLegacyFlowMergeStorage(page);
  expect(legacyStorage).toEqual({
    projects: null,
    workflows: null,
    runtimeStore: null,
    deepseekKey: null,
    updater: null,
    chatThreads: null,
    activeChatId: null,
    licenseCache: null,
    lastUserId: null,
    mcpConfig: null,
  });
});
