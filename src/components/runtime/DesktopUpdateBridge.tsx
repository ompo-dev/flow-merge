"use client";

import { useEffect } from "react";
import {
  getDesktopUpdaterConfig,
  isDesktopUpdaterAvailable,
  listenDesktopUpdaterEvents,
} from "@/lib/desktop-updater";
import { useFlowStore } from "@/store/useFlowStore";

export function DesktopUpdateBridge() {
  const updater = useFlowStore((state) => state.updater);
  const hydrateUpdaterConfig = useFlowStore((state) => state.hydrateUpdaterConfig);
  const handleUpdaterEvent = useFlowStore((state) => state.handleUpdaterEvent);
  const checkForUpdates = useFlowStore((state) => state.checkForUpdates);

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      const config = await getDesktopUpdaterConfig();
      if (!mounted) return;
      hydrateUpdaterConfig(config);
    };

    void loadConfig();

    return () => {
      mounted = false;
    };
  }, [hydrateUpdaterConfig]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    const setup = async () => {
      cleanup = await listenDesktopUpdaterEvents((event) => {
        if (!disposed) {
          handleUpdaterEvent(event);
        }
      });
    };

    void setup();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [handleUpdaterEvent]);

  useEffect(() => {
    if (!isDesktopUpdaterAvailable()) return;
    if (!updater.enabled || !updater.autoUpdateEnabled) return;

    void checkForUpdates({ autoDownload: true });

    const interval = window.setInterval(() => {
      void checkForUpdates({ autoDownload: true });
    }, updater.checkIntervalMs);

    return () => window.clearInterval(interval);
  }, [
    checkForUpdates,
    updater.autoUpdateEnabled,
    updater.checkIntervalMs,
    updater.enabled,
    updater.releaseChannel,
  ]);

  useEffect(() => {
    if (!isDesktopUpdaterAvailable()) return;

    let applying = false;
    let cleanup = () => {};

    const setup = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();

      cleanup = await currentWindow.onCloseRequested(async (event) => {
        const state = useFlowStore.getState();
        if (applying || state.updater.updateState !== "ready_to_install") return;

        applying = true;
        event.preventDefault();

        try {
          await state.installReadyUpdate({ relaunch: false });
        } finally {
          await currentWindow.destroy();
        }
      });
    };

    void setup();

    return () => {
      cleanup();
    };
  }, []);

  return null;
}
