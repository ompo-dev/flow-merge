import type { Workflow } from "@/lib/flow-types";
import { getDb } from "@/lib/storage/db";

export async function getAllWorkflows() {
  const db = await getDb();
  return await db.getAll("workflows");
}

export async function getWorkflowsByProject(projectId: string) {
  const db = await getDb();
  return await db.getAllFromIndex("workflows", "by_project", projectId);
}

export async function getWorkflow(id: string) {
  const db = await getDb();
  return await db.get("workflows", id);
}

export async function saveWorkflow(workflow: Workflow) {
  const db = await getDb();
  await db.put("workflows", workflow);
}

export async function saveAllWorkflows(workflows: Workflow[]) {
  const db = await getDb();
  const transaction = db.transaction("workflows", "readwrite");
  await transaction.store.clear();
  for (const workflow of workflows) {
    await transaction.store.put(workflow);
  }
  await transaction.done;
}

export async function deleteWorkflow(id: string) {
  const db = await getDb();
  await db.delete("workflows", id);
}

export async function deleteWorkflowsByProject(projectId: string) {
  const db = await getDb();
  const transaction = db.transaction("workflows", "readwrite");
  const index = transaction.store.index("by_project");
  let cursor = await index.openCursor(projectId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await transaction.done;
}
