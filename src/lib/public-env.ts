export const publicEnv = {
  apiBaseUrl: process.env.NEXT_PUBLIC_FLOW_MERGE_API_BASE_URL?.trim() || "",
};

export function getPublicApiBaseUrl() {
  return publicEnv.apiBaseUrl || undefined;
}
