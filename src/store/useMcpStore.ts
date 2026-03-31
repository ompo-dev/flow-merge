"use client";

import { create } from "zustand";
import {
  createDefaultMcpConfig,
  MCP_STORAGE_KEY,
  type DesktopMcpStatus,
  type McpLocalConfig,
} from "@/lib/mcp";
import { configureDesktopMcp, getDesktopMcpStatus } from "@/lib/tauri-mcp";

interface McpState {
  hydrated: boolean;
  syncing: boolean;
  config: McpLocalConfig;
  desktopStatus: DesktopMcpStatus | null;
  hydrate: () => void;
  refreshDesktopStatus: () => Promise<DesktopMcpStatus | null>;
  syncDesktopConfig: () => Promise<DesktopMcpStatus | null>;
  setEnabled: (enabled: boolean) => void;
  rotateToken: () => void;
}

function readStoredConfig(): McpLocalConfig {
  if (typeof window === "undefined") {
    return createDefaultMcpConfig();
  }

  try {
    const raw = window.localStorage.getItem(MCP_STORAGE_KEY);
    if (!raw) return createDefaultMcpConfig();

    const parsed = JSON.parse(raw) as Partial<McpLocalConfig>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      authToken:
        typeof parsed.authToken === "string" && parsed.authToken.trim()
          ? parsed.authToken
          : createDefaultMcpConfig().authToken,
      serverName:
        typeof parsed.serverName === "string" && parsed.serverName.trim()
          ? parsed.serverName
          : createDefaultMcpConfig().serverName,
    };
  } catch {
    return createDefaultMcpConfig();
  }
}

function persistConfig(config: McpLocalConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(config));
}

export const useMcpStore = create<McpState>((set, get) => ({
  hydrated: false,
  syncing: false,
  config: readStoredConfig(),
  desktopStatus: null,

  hydrate: () => {
    if (get().hydrated) return;
    const config = readStoredConfig();
    persistConfig(config);
    set({ hydrated: true, config });
  },

  refreshDesktopStatus: async () => {
    const status = await getDesktopMcpStatus();
    set({ desktopStatus: status });
    return status;
  },

  syncDesktopConfig: async () => {
    const { config } = get();
    set({ syncing: true });

    try {
      const status = await configureDesktopMcp(config);
      set({ syncing: false, desktopStatus: status });
      return status;
    } catch (error) {
      console.error("Failed to sync Flow Merge MCP config", error);
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
      persistConfig(config);
      return { config };
    }),

  rotateToken: () =>
    set((state) => {
      const next = createDefaultMcpConfig();
      const config = {
        ...state.config,
        authToken: next.authToken,
      };
      persistConfig(config);
      return { config };
    }),
}));
