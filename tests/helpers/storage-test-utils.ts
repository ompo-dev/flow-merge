import "fake-indexeddb/auto";
import { indexedDB } from "fake-indexeddb";
import type { AppUpdateSnapshot, ChatThread, Project, Workflow } from "@/lib/flow-types";
import type { LicenseStatusPayload } from "@/lib/license";
import type { McpLocalConfig } from "@/lib/mcp";
import type { ProjectRuntimeStore, RuntimeCollectionRecord } from "@/lib/runtime-types";
import { resetDb, setIDBFactory } from "@/lib/storage/db";

export async function resetIndexedDbForTests() {
  setIDBFactory(indexedDB as unknown as IDBFactory);
  await resetDb();
}

export async function cleanupIndexedDbForTests() {
  try {
    await resetDb();
  } finally {
    setIDBFactory(undefined);
  }
}

export function createProjectFixture(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "project_1",
    name: overrides.name ?? "Projeto Teste",
    description: overrides.description ?? "Projeto persistido no IndexedDB",
    accent: overrides.accent ?? "#1f6feb",
    active: overrides.active ?? true,
    surface: overrides.surface,
  };
}

export function createWorkflowFixture(
  projectId: string,
  overrides: Partial<Workflow> = {},
): Workflow {
  return {
    id: overrides.id ?? "workflow_1",
    projectId,
    name: overrides.name ?? "Workflow Teste",
    accent: overrides.accent ?? "#58a6ff",
    active: overrides.active ?? true,
    surface: overrides.surface,
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    createdAt: overrides.createdAt ?? "2026-03-31T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-31T00:00:00.000Z",
    tags: overrides.tags ?? [],
    description: overrides.description ?? "Workflow persistido no IndexedDB",
  };
}

export function createRuntimeCollectionRecord(
  overrides: Partial<RuntimeCollectionRecord> = {},
): RuntimeCollectionRecord {
  return {
    id: overrides.id ?? "record_1",
    timestamp: overrides.timestamp ?? Date.now(),
    sourceNodeId: overrides.sourceNodeId ?? "node_seed",
    payload: overrides.payload ?? { event: "seed", amount: 42 },
  };
}

export function createRuntimeStoreFixture(
  overrides: Partial<ProjectRuntimeStore> = {},
): ProjectRuntimeStore {
  return {
    collections: overrides.collections ?? {
      logs: [createRuntimeCollectionRecord()],
    },
    lastUpdatedAt: overrides.lastUpdatedAt ?? 1_774_939_704_446,
  };
}

export function createChatThreadFixture(
  overrides: Partial<ChatThread> = {},
): ChatThread {
  const now = Date.now();
  return {
    id: overrides.id ?? "thread_1",
    title: overrides.title ?? "Thread Teste",
    messages: overrides.messages ?? [],
    isStreaming: overrides.isStreaming ?? false,
    streamingMessageId: overrides.streamingMessageId ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createUpdaterFixture(
  overrides: Partial<AppUpdateSnapshot> = {},
): AppUpdateSnapshot {
  return {
    enabled: overrides.enabled ?? false,
    repository: overrides.repository ?? null,
    currentVersion: overrides.currentVersion ?? "0.3.0",
    releaseChannel: overrides.releaseChannel ?? "stable",
    supportedChannels: overrides.supportedChannels ?? ["stable", "beta", "internal"],
    allowedChannels: overrides.allowedChannels ?? ["stable"],
    autoUpdateEnabled: overrides.autoUpdateEnabled ?? true,
    updateState: overrides.updateState ?? "disabled",
    lastCheckedAt: overrides.lastCheckedAt ?? null,
    pendingVersion: overrides.pendingVersion ?? null,
    availableVersion: overrides.availableVersion ?? null,
    lastUpdateError: overrides.lastUpdateError ?? null,
    downloadedBytes: overrides.downloadedBytes ?? null,
    totalBytes: overrides.totalBytes ?? null,
    releaseNotes: overrides.releaseNotes ?? null,
    publishedAt: overrides.publishedAt ?? null,
    checkIntervalMs: overrides.checkIntervalMs ?? 3_600_000,
    feedUrls: overrides.feedUrls ?? {},
  };
}

export function createLicenseFixture(
  overrides: Partial<LicenseStatusPayload> = {},
): LicenseStatusPayload {
  return {
    authenticated: overrides.authenticated ?? true,
    canAccessWorkspace: overrides.canAccessWorkspace ?? true,
    requiresPayment: overrides.requiresPayment ?? false,
    shouldWipeLocalData: overrides.shouldWipeLocalData ?? false,
    planType: overrides.planType ?? "monthly",
    accessState: overrides.accessState ?? "active_monthly",
    user: overrides.user ?? {
      id: "user_1",
      name: "Usuario Teste",
      email: "teste@example.com",
      imageUrl: null,
    },
    timeline: overrides.timeline ?? {
      trialEndsAt: null,
      paymentDueAt: null,
      blockedAt: null,
      deleteAt: null,
    },
    releaseAccess: overrides.releaseAccess ?? {
      level: "stable",
      allowedChannels: ["stable"],
    },
    billing: overrides.billing ?? {
      planOptions: {
        monthly: {
          label: "Pro Mensal",
          amountInCents: 8_900,
        },
        lifetime: {
          label: "Founder Lifetime",
          amountInCents: 106_800,
        },
      },
      activeCharge: null,
    },
  };
}

export function createMcpConfigFixture(
  overrides: Partial<McpLocalConfig> = {},
): McpLocalConfig {
  return {
    enabled: overrides.enabled ?? true,
    authToken: overrides.authToken ?? "token-local",
    serverName: overrides.serverName ?? "flow-merge-local",
  };
}

type LocalStorageShape = {
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
  readonly length: number;
};

export function installWindowMock(storageSeed: Record<string, string> = {}) {
  const store = new Map(Object.entries(storageSeed));
  const globalScope = globalThis as typeof globalThis & {
    localStorage?: LocalStorageShape;
    window?: { localStorage: LocalStorageShape };
  };
  const previousWindow = globalScope.window;
  const previousLocalStorage = globalScope.localStorage;

  const localStorage: LocalStorageShape = {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(globalScope, "localStorage", {
    value: localStorage,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalScope, "window", {
    value: { localStorage },
    writable: true,
    configurable: true,
  });

  return {
    dump() {
      return Object.fromEntries(store.entries());
    },
    localStorage,
    restore() {
      if (previousLocalStorage === undefined) {
        Reflect.deleteProperty(globalScope, "localStorage");
      } else {
        Object.defineProperty(globalScope, "localStorage", {
          value: previousLocalStorage,
          writable: true,
          configurable: true,
        });
      }

      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalScope, "window");
      } else {
        Object.defineProperty(globalScope, "window", {
          value: previousWindow,
          writable: true,
          configurable: true,
        });
      }
    },
  };
}
