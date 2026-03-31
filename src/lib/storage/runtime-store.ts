import type { ProjectRuntimeStore } from "@/lib/runtime-types";
import { createEmptyProjectRuntimeStore, getDb } from "@/lib/storage/db";

export async function getProjectRuntimeStore(projectId: string): Promise<ProjectRuntimeStore> {
  const db = await getDb();
  const entries = await db.getAllFromIndex("runtime_collections", "by_project", projectId);
  if (!entries.length) {
    return createEmptyProjectRuntimeStore();
  }

  const collections = Object.fromEntries(
    entries.map((entry) => [entry.collectionName, entry.records]),
  );
  const lastUpdatedAt = entries.reduce<number | null>((latest, entry) => {
    if (entry.lastUpdatedAt === null) return latest;
    if (latest === null) return entry.lastUpdatedAt;
    return Math.max(latest, entry.lastUpdatedAt);
  }, null);

  return {
    collections,
    lastUpdatedAt,
  };
}

export async function saveProjectRuntimeStore(projectId: string, store: ProjectRuntimeStore) {
  const db = await getDb();
  const transaction = db.transaction("runtime_collections", "readwrite");
  const index = transaction.store.index("by_project");
  let cursor = await index.openCursor(projectId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  for (const [collectionName, records] of Object.entries(store.collections)) {
    await transaction.store.put({
      projectId,
      collectionName,
      records,
      lastUpdatedAt: store.lastUpdatedAt,
    });
  }

  await transaction.done;
}

export async function deleteProjectRuntimeStore(projectId: string) {
  const db = await getDb();
  const transaction = db.transaction("runtime_collections", "readwrite");
  const index = transaction.store.index("by_project");
  let cursor = await index.openCursor(projectId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await transaction.done;
}

export async function getAllProjectRuntimeStores() {
  const db = await getDb();
  const entries = await db.getAll("runtime_collections");
  return entries.reduce<Record<string, ProjectRuntimeStore>>((accumulator, entry) => {
    const current = accumulator[entry.projectId] ?? createEmptyProjectRuntimeStore();
    accumulator[entry.projectId] = {
      collections: {
        ...current.collections,
        [entry.collectionName]: entry.records,
      },
      lastUpdatedAt:
        entry.lastUpdatedAt === null
          ? current.lastUpdatedAt
          : current.lastUpdatedAt === null
            ? entry.lastUpdatedAt
            : Math.max(current.lastUpdatedAt, entry.lastUpdatedAt),
    };
    return accumulator;
  }, {});
}
