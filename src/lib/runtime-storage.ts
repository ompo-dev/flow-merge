import type { ProjectRuntimeStore } from "@/lib/runtime-types";

const RUNTIME_STORE_STORAGE_KEY = "flow-merge-runtime-store";

interface PersistedRuntimeStore {
  version: 1;
  projects: Record<string, ProjectRuntimeStore>;
}

function createEmptyProjectStore(): ProjectRuntimeStore {
  return {
    collections: {},
    lastUpdatedAt: null,
  };
}

export function getEmptyProjectStore() {
  return createEmptyProjectStore();
}

export function readPersistedRuntimeStores() {
  if (typeof window === "undefined") return {} as Record<string, ProjectRuntimeStore>;

  try {
    const raw = window.localStorage.getItem(RUNTIME_STORE_STORAGE_KEY);
    if (!raw) return {} as Record<string, ProjectRuntimeStore>;

    const parsed = JSON.parse(raw) as Partial<PersistedRuntimeStore>;
    if (parsed.version !== 1 || typeof parsed.projects !== "object" || !parsed.projects) {
      return {} as Record<string, ProjectRuntimeStore>;
    }

    return parsed.projects;
  } catch {
    return {} as Record<string, ProjectRuntimeStore>;
  }
}

export function persistRuntimeStores(projects: Record<string, ProjectRuntimeStore>) {
  if (typeof window === "undefined") return;

  const payload: PersistedRuntimeStore = {
    version: 1,
    projects,
  };

  window.localStorage.setItem(RUNTIME_STORE_STORAGE_KEY, JSON.stringify(payload));
}

export function getProjectRuntimeStore(
  projects: Record<string, ProjectRuntimeStore>,
  projectId: string,
) {
  return projects[projectId] ?? createEmptyProjectStore();
}
