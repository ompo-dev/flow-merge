import type { ProjectRuntimeStore } from "@/lib/runtime-types";
import {
  deleteProjectRuntimeStore,
  getAllProjectRuntimeStores,
  getProjectRuntimeStore as readProjectRuntimeStore,
  saveProjectRuntimeStore,
} from "@/lib/storage/runtime-store";

function createEmptyProjectStore(): ProjectRuntimeStore {
  return {
    collections: {},
    lastUpdatedAt: null,
  };
}

export function getEmptyProjectStore() {
  return createEmptyProjectStore();
}

export async function readPersistedRuntimeStores(): Promise<Record<string, ProjectRuntimeStore>> {
  if (typeof window === "undefined") {
    return {};
  }

  return await getAllProjectRuntimeStores();
}

export function persistRuntimeStores(projects: Record<string, ProjectRuntimeStore>): void {
  if (typeof window === "undefined") return;

  for (const [projectId, store] of Object.entries(projects)) {
    void saveProjectRuntimeStore(projectId, store).catch(() => {});
  }
}

export function deleteProjectStore(projectId: string): void {
  if (typeof window === "undefined") return;
  void deleteProjectRuntimeStore(projectId).catch(() => {});
}

export function getProjectRuntimeStore(
  projects: Record<string, ProjectRuntimeStore>,
  projectId: string,
) {
  return projects[projectId] ?? createEmptyProjectStore();
}

export async function readSingleProjectRuntimeStore(projectId: string) {
  if (typeof window === "undefined") {
    return createEmptyProjectStore();
  }

  return await readProjectRuntimeStore(projectId);
}
