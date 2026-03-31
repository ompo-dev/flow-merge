import type { ChatThread } from "@/lib/flow-types";
import { getDb } from "@/lib/storage/db";

export async function getAllThreads() {
  const db = await getDb();
  const threads = await db.getAll("chat_threads");
  return threads.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveThread(thread: ChatThread) {
  const db = await getDb();
  await db.put("chat_threads", thread);
}

export async function saveAllThreads(threads: ChatThread[]) {
  const db = await getDb();
  const transaction = db.transaction("chat_threads", "readwrite");
  await transaction.store.clear();
  for (const thread of threads) {
    await transaction.store.put(thread);
  }
  await transaction.done;
}

export async function deleteThread(id: string) {
  const db = await getDb();
  await db.delete("chat_threads", id);
}

export async function clearAllThreads() {
  const db = await getDb();
  await db.clear("chat_threads");
}
