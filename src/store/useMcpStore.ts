"use client";

import { create } from "zustand";
import {
  createDefaultMcpConfig,
  MCP_STORAGE_KEY,
  type DesktopMcpStatus,
  type McpLocalConfig,
} from "@/lib/mcp";
import { getSetting, setSetting } from "@/lib/storage/settings-store";
import { configureDesktopMcp, getDesktopMcpStatus } from "@/lib/tauri-mcp";

interface McpState {
  hydrated: boolean;
  syncing: boolean;
  config: McpLocalConfig;
  desktopStatus: DesktopMcpStatus | null;
  hydrate: () => Promise<void>;
  refreshDesktopStatus: () => Promise<DesktopMcpStatus | null>;
  syncDesktopConfig: () => Promise<DesktopMcpStatus | null>;
  setEnabled: (enabled: boolean) => void;
  rotateToken: () => void;
}

function readStoredConfig(): McpLocalConfig {
  return createDefaultMcpConfig();
}

function persistConfig(config: McpLocalConfig) {
  if (typeof window === "undefined") return;
  void setSetting("mcp-config", config).catch(() => {});
}

export const useMcpStore = create<McpState>((set, get) => ({
  hydrated: false,
  syncing: false,
  config: readStoredConfig(),
  desktopStatus: null,

  hydrate: async () => {
    if (get().hydrated) return;

    const persisted = await getSetting("mcp-config");
    const fallback = typeof window !== "undefined" ? window.localStorage.getItem(MCP_STORAGE_KEY) : null;
    const legacyConfig = fallback
      ? (() => {
          try {
            return JSON.parse(fallback) as Partial<McpLocalConfig>;
          } catch {
            return null;
          }
        })()
      : null;
    const defaults = createDefaultMcpConfig();
    const config: McpLocalConfig = {
      enabled:
        typeof persisted?.enabled === "boolean"
          ? persisted.enabled
          : typeof legacyConfig?.enabled === "boolean"
            ? legacyConfig.enabled
            : defaults.enabled,
      authToken:
        typeof persisted?.authToken === "string" && persisted.authToken.trim()
          ? persisted.authToken
          : typeof legacyConfig?.authToken === "string" && legacyConfig.authToken.trim()
            ? legacyConfig.authToken
            : defaults.authToken,
      serverName:
        typeof persisted?.serverName === "string" && persisted.serverName.trim()
          ? persisted.serverName
          : typeof legacyConfig?.serverName === "string" && legacyConfig.serverName.trim()
            ? legacyConfig.serverName
            : defaults.serverName,
    };

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
