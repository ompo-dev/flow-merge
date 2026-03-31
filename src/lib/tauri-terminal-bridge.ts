import type {
  DesktopTerminalBridgeStatus,
  TerminalBridgeLocalConfig,
} from "@/lib/terminal-bridge";
import { isDesktopRuntimeAvailable } from "@/lib/tauri-runtime";

export async function getDesktopTerminalBridgeStatus() {
  if (!isDesktopRuntimeAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopTerminalBridgeStatus>("terminal_bridge_status");
}

export async function configureDesktopTerminalBridge(
  config: Pick<TerminalBridgeLocalConfig, "enabled" | "authToken">,
) {
  if (!isDesktopRuntimeAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopTerminalBridgeStatus>("terminal_bridge_configure", {
    config: {
      enabled: config.enabled,
      authToken: config.authToken.trim(),
    },
  });
}
