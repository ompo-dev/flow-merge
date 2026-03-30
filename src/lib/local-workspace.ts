const FLOW_MERGE_LOCAL_STORAGE_KEYS = [
  "flow-merge-runtime-store",
  "flow-merge-deepseek-key",
  "flow-merge-updater",
  "flow-merge-chat-threads",
  "flow-merge-active-chat-id",
  "flow-merge-license-cache",
] as const;

export function clearFlowMergeLocalStorage() {
  if (typeof window === "undefined") return;

  for (const key of FLOW_MERGE_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
