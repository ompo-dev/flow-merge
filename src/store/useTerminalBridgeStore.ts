"use client";

import { create } from "zustand";
import {
  createDefaultTerminalBridgeConfig,
  persistTerminalBridgeConfig,
  probeTerminalBridgeStatus,
  readStoredTerminalBridgeConfig,
  type DesktopTerminalBridgeStatus,
  type TerminalBridgeLocalConfig,
} from "@/lib/terminal-bridge";
import {
  configureDesktopTerminalBridge,
  getDesktopTerminalBridgeStatus,
} from "@/lib/tauri-terminal-bridge";

interface TerminalBridgeState {
  hydrated: boolean;
  syncing: boolean;
  config: TerminalBridgeLocalConfig;
  status: DesktopTerminalBridgeStatus | null;
  hydrate: () => void;
  refreshStatus: () => Promise<DesktopTerminalBridgeStatus | null>;
  syncDesktopConfig: () => Promise<DesktopTerminalBridgeStatus | null>;
  setEnabled: (enabled: boolean) => void;
  setEndpointUrl: (endpointUrl: string) => void;
  setAuthToken: (authToken: string) => void;
  rotateToken: () => void;
}

export const useTerminalBridgeStore = create<TerminalBridgeState>((set, get) => ({
  hydrated: false,
  syncing: false,
  config: readStoredTerminalBridgeConfig(),
  status: null,

  hydrate: () => {
    if (get().hydrated) return;
    const config = readStoredTerminalBridgeConfig();
    persistTerminalBridgeConfig(config);
    set({ hydrated: true, config });
  },

  refreshStatus: async () => {
    const desktopStatus = await getDesktopTerminalBridgeStatus();
    if (desktopStatus) {
      set({ status: desktopStatus });
      return desktopStatus;
    }

    const browserStatus = await probeTerminalBridgeStatus(get().config.endpointUrl);
    set({ status: browserStatus });
    return browserStatus;
  },

  syncDesktopConfig: async () => {
    const { config } = get();
    set({ syncing: true });

    try {
      const desktopStatus = await configureDesktopTerminalBridge(config);
      if (desktopStatus) {
        set({ syncing: false, status: desktopStatus });
        return desktopStatus;
      }

      const browserStatus = await probeTerminalBridgeStatus(config.endpointUrl);
      set({ syncing: false, status: browserStatus });
      return browserStatus;
    } catch (error) {
      console.error("Failed to sync Flow Merge terminal bridge config", error);
      set({ syncing: false });
      return null;
    }
  },

  setEnabled: (enabled) =>
    set((state) => {
      const config = {
        ...state.config,
        enabled,
      };
      persistTerminalBridgeConfig(config);
      return { config };
    }),

  setEndpointUrl: (endpointUrl) =>
    set((state) => {
      const config = {
        ...state.config,
        endpointUrl,
      };
      persistTerminalBridgeConfig(config);
      return { config };
    }),

  setAuthToken: (authToken) =>
    set((state) => {
      const config = {
        ...state.config,
        authToken,
      };
      persistTerminalBridgeConfig(config);
      return { config };
    }),

  rotateToken: () =>
    set((state) => {
      const next = createDefaultTerminalBridgeConfig();
      const config = {
        ...state.config,
        authToken: next.authToken,
      };
      persistTerminalBridgeConfig(config);
      return { config };
    }),
}));
