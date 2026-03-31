import type { Page } from "@playwright/test";

type LegacySeed = Partial<{
  projects: unknown;
  workflows: unknown;
  runtimeStore: unknown;
  deepseekKey: string;
  updater: unknown;
  chatThreads: unknown;
  activeChatId: string;
  licenseCache: unknown;
  lastUserId: string;
  mcpConfig: unknown;
}>;

const LEGACY_KEYS = {
  projects: "flow-merge-projects",
  workflows: "flow-merge-workflows",
  runtimeStore: "flow-merge-runtime-store",
  deepseekKey: "flow-merge-deepseek-key",
  updater: "flow-merge-updater",
  chatThreads: "flow-merge-chat-threads",
  activeChatId: "flow-merge-active-chat-id",
  licenseCache: "flow-merge-license-cache",
  lastUserId: "flow-merge-last-user-id",
  mcpConfig: "flow-merge-mcp-config",
} as const;

export async function seedLegacyFlowMergeStorage(page: Page, seed: LegacySeed) {
  await page.addInitScript((payload: LegacySeed & { marker: string }) => {
    if (window.sessionStorage.getItem(payload.marker) === "1") {
      return;
    }

    const pairs: Array<[string, unknown]> = [
      ["flow-merge-projects", payload.projects],
      ["flow-merge-workflows", payload.workflows],
      ["flow-merge-runtime-store", payload.runtimeStore],
      ["flow-merge-deepseek-key", payload.deepseekKey],
      ["flow-merge-updater", payload.updater],
      ["flow-merge-chat-threads", payload.chatThreads],
      ["flow-merge-active-chat-id", payload.activeChatId],
      ["flow-merge-license-cache", payload.licenseCache],
      ["flow-merge-last-user-id", payload.lastUserId],
      ["flow-merge-mcp-config", payload.mcpConfig],
    ];

    for (const [key, value] of pairs) {
      if (value === undefined || value === null) continue;
      window.localStorage.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
    }

    window.sessionStorage.setItem(payload.marker, "1");
  }, {
    ...seed,
    marker: "__flow_merge_legacy_seeded__",
  });
}

export async function readFlowMergeDbSnapshot(page: Page) {
  return await page.evaluate(async () => {
    function requestToPromise<T>(request: IDBRequest<T>) {
      return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("flow-merge-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    async function readStore<T>(storeName: string) {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const rows = await requestToPromise(store.getAll());
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      return rows as T[];
    }

    const [projects, workflows, runtimeCollections, chatThreads, settingsRows] =
      await Promise.all([
        readStore<Record<string, unknown>>("projects"),
        readStore<Record<string, unknown>>("workflows"),
        readStore<Record<string, unknown>>("runtime_collections"),
        readStore<Record<string, unknown>>("chat_threads"),
        readStore<{ key: string; value: unknown }>("settings"),
      ]);

    db.close();

    return {
      projects,
      workflows,
      runtimeCollections,
      chatThreads,
      settings: Object.fromEntries(settingsRows.map((row) => [row.key, row.value])),
    };
  });
}

export async function readLegacyFlowMergeStorage(page: Page) {
  return await page.evaluate((keys) => {
    return Object.fromEntries(
      Object.entries(keys).map(([label, key]) => [label, window.localStorage.getItem(key)]),
    );
  }, LEGACY_KEYS);
}
