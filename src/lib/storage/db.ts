import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ChatThread, Project, Workflow } from "@/lib/flow-types";
import type { RuntimeCollectionRecord, ProjectRuntimeStore } from "@/lib/runtime-types";
import type { AppUpdateSnapshot } from "@/lib/flow-types";
import type { LicenseStatusPayload } from "@/lib/license";
import type { McpLocalConfig } from "@/lib/mcp";

export const DB_NAME = "flow-merge-db";
export const DB_VERSION = 1;

export type SettingKey =
  | "deepseek-key"
  | "updater"
  | "license-cache"
  | "last-user-id"
  | "active-chat-id"
  | "mcp-config"
  | "migrated_v1";

export interface RuntimeCollectionEntry {
  projectId: string;
  collectionName: string;
  records: RuntimeCollectionRecord[];
  lastUpdatedAt: number | null;
}

export interface SettingValueMap {
  "deepseek-key": string;
  updater: AppUpdateSnapshot;
  "license-cache": LicenseStatusPayload;
  "last-user-id": string;
  "active-chat-id": string;
  "mcp-config": McpLocalConfig;
  migrated_v1: boolean;
}

interface SettingRecord<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingValueMap[K];
}

export interface FlowMergeDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  workflows: {
    key: string;
    value: Workflow;
    indexes: {
      by_project: string;
    };
  };
  runtime_collections: {
    key: [string, string];
    value: RuntimeCollectionEntry;
    indexes: {
      by_project: string;
    };
  };
  chat_threads: {
    key: string;
    value: ChatThread;
    indexes: {
      by_updatedAt: number;
    };
  };
  settings: {
    key: SettingKey;
    value: SettingRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<FlowMergeDB>> | null = null;
let customIndexedDbFactory: IDBFactory | undefined;

function withIndexedDbFactory<T>(callback: () => Promise<T>) {
  if (!customIndexedDbFactory || typeof globalThis === "undefined") {
    return callback();
  }

  const globalScope = globalThis as typeof globalThis & { indexedDB?: IDBFactory };
  const previousFactory = globalScope.indexedDB;
  globalScope.indexedDB = customIndexedDbFactory;

  return callback().finally(() => {
    globalScope.indexedDB = previousFactory;
  });
}

export function setIDBFactory(factory?: IDBFactory) {
  customIndexedDbFactory = factory;
  dbPromise = null;
}

export async function resetDb() {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
  await withIndexedDbFactory(() =>
    deleteDB(DB_NAME, {
      blocked() {
        // noop
      },
    }),
  );
}

export async function getDb(): Promise<IDBPDatabase<FlowMergeDB>> {
  if (!dbPromise) {
    dbPromise = withIndexedDbFactory(() =>
      openDB<FlowMergeDB>(DB_NAME, DB_VERSION, {
        blocked() {
          // noop
        },
        upgrade(db) {
          if (!db.objectStoreNames.contains("projects")) {
            db.createObjectStore("projects", { keyPath: "id" });
          }

          if (!db.objectStoreNames.contains("workflows")) {
            const workflows = db.createObjectStore("workflows", { keyPath: "id" });
            workflows.createIndex("by_project", "projectId", { unique: false });
          }

          if (!db.objectStoreNames.contains("runtime_collections")) {
            const runtimeCollections = db.createObjectStore("runtime_collections", {
              keyPath: ["projectId", "collectionName"],
            });
            runtimeCollections.createIndex("by_project", "projectId", { unique: false });
          }

          if (!db.objectStoreNames.contains("chat_threads")) {
            const chatThreads = db.createObjectStore("chat_threads", { keyPath: "id" });
            chatThreads.createIndex("by_updatedAt", "updatedAt", { unique: false });
          }

          if (!db.objectStoreNames.contains("settings")) {
            db.createObjectStore("settings", { keyPath: "key" });
          }
        },
      }),
    );
  }

  return dbPromise;
}

export function createEmptyProjectRuntimeStore(): ProjectRuntimeStore {
  return {
    collections: {},
    lastUpdatedAt: null,
  };
}
