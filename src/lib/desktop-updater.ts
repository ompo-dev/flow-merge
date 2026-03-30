"use client";

import type {
  AppUpdateEvent,
  DesktopUpdaterCheckResult,
  DesktopUpdaterConfig,
  ReleaseChannel,
} from "@/lib/flow-types";

const UPDATER_EVENT_NAME = "updater://state";

function isDesktopRuntimeAvailable() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isDesktopUpdaterAvailable() {
  return isDesktopRuntimeAvailable();
}

export async function getDesktopUpdaterConfig(): Promise<DesktopUpdaterConfig | null> {
  if (!isDesktopRuntimeAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopUpdaterConfig>("updater_get_config");
}

export async function checkDesktopUpdater(
  channel: ReleaseChannel,
): Promise<DesktopUpdaterCheckResult | null> {
  if (!isDesktopRuntimeAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopUpdaterCheckResult>("updater_check", { channel });
}

export async function downloadDesktopUpdater(
  channel: ReleaseChannel,
): Promise<DesktopUpdaterCheckResult | null> {
  if (!isDesktopRuntimeAvailable()) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopUpdaterCheckResult>("updater_download", { channel });
}

export async function installDesktopUpdater(): Promise<boolean> {
  if (!isDesktopRuntimeAvailable()) return false;

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("updater_install_ready");
}

export async function relaunchDesktopApp() {
  if (!isDesktopRuntimeAvailable()) return;

  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export async function listenDesktopUpdaterEvents(
  handler: (payload: AppUpdateEvent) => void | Promise<void>,
) {
  if (!isDesktopRuntimeAvailable()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<AppUpdateEvent>(UPDATER_EVENT_NAME, (event) => {
    void handler(event.payload);
  });

  return unlisten;
}
