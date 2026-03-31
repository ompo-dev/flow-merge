import type { ChatThread, Project, Workflow } from "@/lib/flow-types";
import type { LicenseStatusPayload } from "@/lib/license";
import type { McpLocalConfig } from "@/lib/mcp";
import type { AppUpdateSnapshot } from "@/lib/flow-types";
import { saveAllProjects } from "@/lib/storage/projects-store";
import { saveAllWorkflows } from "@/lib/storage/workflows-store";
import { saveAllProjectRuntimeStores } from "@/lib/storage/runtime-storage-internal";
import { saveAllThreads } from "@/lib/storage/chat-store";
import { getSetting, setSetting } from "@/lib/storage/settings-store";
import type { ProjectRuntimeStore } from "@/lib/runtime-types";

const RUNTIME_STORE_STORAGE_KEY = "flow-merge-runtime-store";
const DEEPSEEK_STORAGE_KEY = "flow-merge-deepseek-key";
const UPDATER_STORAGE_KEY = "flow-merge-updater";
const CHAT_THREADS_STORAGE_KEY = "flow-merge-chat-threads";
const CHAT_ACTIVE_ID_STORAGE_KEY = "flow-merge-active-chat-id";
const LICENSE_CACHE_STORAGE_KEY = "flow-merge-license-cache";
const LAST_AUTH_USER_STORAGE_KEY = "flow-merge-last-user-id";
const MCP_STORAGE_KEY = "flow-merge-mcp-config";

function readJsonValue<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readStringValue(key: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export async function migrateFromLocalStorageIfNeeded(
  seedProjects: Project[],
  seedWorkflows: Workflow[],
) {
  if (typeof window === "undefined") return;
  const alreadyMigrated = await getSetting("migrated_v1");
  if (alreadyMigrated) return;

  const persistedProjects = readJsonValue<Project[]>("flow-merge-projects");
  const persistedWorkflows = readJsonValue<Workflow[]>("flow-merge-workflows");
  const runtimeWrapper = readJsonValue<{
    version?: number;
    projects?: Record<string, ProjectRuntimeStore>;
  }>(RUNTIME_STORE_STORAGE_KEY);
  const chatThreads = readJsonValue<ChatThread[]>(CHAT_THREADS_STORAGE_KEY);
  const deepseekKey = readStringValue(DEEPSEEK_STORAGE_KEY);
  const activeChatId = readStringValue(CHAT_ACTIVE_ID_STORAGE_KEY);
  const updater = readJsonValue<AppUpdateSnapshot>(UPDATER_STORAGE_KEY);
  const licenseCache = readJsonValue<LicenseStatusPayload>(LICENSE_CACHE_STORAGE_KEY);
  const lastUserId = readStringValue(LAST_AUTH_USER_STORAGE_KEY);
  const mcpConfig = readJsonValue<McpLocalConfig>(MCP_STORAGE_KEY);

  await saveAllProjects(persistedProjects?.length ? persistedProjects : seedProjects);
  await saveAllWorkflows(persistedWorkflows?.length ? persistedWorkflows : seedWorkflows);
  await saveAllProjectRuntimeStores(runtimeWrapper?.projects ?? {});

  if (chatThreads?.length) {
    await saveAllThreads(chatThreads);
  }

  if (deepseekKey) {
    await setSetting("deepseek-key", deepseekKey);
  }

  if (activeChatId) {
    await setSetting("active-chat-id", activeChatId);
  }

  if (updater) {
    await setSetting("updater", updater);
  }

  if (licenseCache) {
    await setSetting("license-cache", licenseCache);
  }

  if (lastUserId) {
    await setSetting("last-user-id", lastUserId);
  }

  if (mcpConfig) {
    await setSetting("mcp-config", mcpConfig);
  }

  await setSetting("migrated_v1", true);

  for (const key of [
    "flow-merge-projects",
    "flow-merge-workflows",
    RUNTIME_STORE_STORAGE_KEY,
    DEEPSEEK_STORAGE_KEY,
    UPDATER_STORAGE_KEY,
    CHAT_THREADS_STORAGE_KEY,
    CHAT_ACTIVE_ID_STORAGE_KEY,
    LICENSE_CACHE_STORAGE_KEY,
    LAST_AUTH_USER_STORAGE_KEY,
    MCP_STORAGE_KEY,
  ]) {
    window.localStorage.removeItem(key);
  }
}
