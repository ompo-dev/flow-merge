import type { ProjectRuntimeStore } from "@/lib/runtime-types";
import { deleteProjectRuntimeStore, saveProjectRuntimeStore } from "@/lib/storage/runtime-store";

export async function saveAllProjectRuntimeStores(projects: Record<string, ProjectRuntimeStore>) {
  const projectIds = Object.keys(projects);
  for (const [projectId, store] of Object.entries(projects)) {
    await saveProjectRuntimeStore(projectId, store);
  }
  return projectIds;
}

export async function deleteMissingProjectRuntimeStores(
  previousProjectIds: string[],
  nextProjects: Record<string, ProjectRuntimeStore>,
) {
  const nextIds = new Set(Object.keys(nextProjects));
  for (const projectId of previousProjectIds) {
    if (!nextIds.has(projectId)) {
      await deleteProjectRuntimeStore(projectId);
    }
  }
}
