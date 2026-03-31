import type { Project } from "@/lib/flow-types";
import { getDb } from "@/lib/storage/db";

export async function getAllProjects() {
  const db = await getDb();
  return await db.getAll("projects");
}

export async function getProject(id: string) {
  const db = await getDb();
  return await db.get("projects", id);
}

export async function saveProject(project: Project) {
  const db = await getDb();
  await db.put("projects", project);
}

export async function saveAllProjects(projects: Project[]) {
  const db = await getDb();
  const transaction = db.transaction("projects", "readwrite");
  await transaction.store.clear();
  for (const project of projects) {
    await transaction.store.put(project);
  }
  await transaction.done;
}

export async function deleteProject(id: string) {
  const db = await getDb();
  await db.delete("projects", id);
}
