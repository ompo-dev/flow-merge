import type {
  DesktopMcpStatus,
  McpBridgeRequest,
  McpBridgeResponse,
  McpLocalConfig,
} from "@/lib/mcp";

function isDesktopMcpAvailable() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getDesktopMcpStatus(): Promise<DesktopMcpStatus | null> {
  if (!isDesktopMcpAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopMcpStatus>("mcp_status");
}

export async function configureDesktopMcp(config: McpLocalConfig) {
  if (!isDesktopMcpAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopMcpStatus>("mcp_configure", { config });
}

export async function completeDesktopMcpRequest(response: McpBridgeResponse) {
  if (!isDesktopMcpAvailable()) return false;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("mcp_complete_request", { response });
}

export async function listenDesktopMcpRequests(
  handler: (request: McpBridgeRequest) => void | Promise<void>,
) {
  if (!isDesktopMcpAvailable()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<McpBridgeRequest>("mcp://request", (event) => {
    void handler(event.payload);
  });

  return unlisten;
}
