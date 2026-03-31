import { getDb } from "@/lib/storage/db";

const FLOW_MERGE_LOCAL_STORAGE_KEYS = [
  "flow-merge-projects",
  "flow-merge-workflows",
  "flow-merge-runtime-store",
  "flow-merge-deepseek-key",
  "flow-merge-updater",
  "flow-merge-chat-threads",
  "flow-merge-active-chat-id",
  "flow-merge-license-cache",
  "flow-merge-last-user-id",
  "flow-merge-mcp-config",
] as const;

export function clearFlowMergeLocalStorage() {
  if (typeof window === "undefined") return;

  for (const key of FLOW_MERGE_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export async function clearFlowMergeStorage() {
  if (typeof window === "undefined") return;

  clearFlowMergeLocalStorage();

  const db = await getDb();
  const transaction = db.transaction(
    ["projects", "workflows", "runtime_collections", "chat_threads", "settings"],
    "readwrite",
  );

  await Promise.all([
    transaction.objectStore("projects").clear(),
    transaction.objectStore("workflows").clear(),
    transaction.objectStore("runtime_collections").clear(),
    transaction.objectStore("chat_threads").clear(),
    transaction.objectStore("settings").clear(),
  ]);
  await transaction.done;
}
