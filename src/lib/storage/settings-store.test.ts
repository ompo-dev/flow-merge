import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteSetting, getSetting, setSetting } from "@/lib/storage/settings-store";
import {
  cleanupIndexedDbForTests,
  createMcpConfigFixture,
  createUpdaterFixture,
  resetIndexedDbForTests,
} from "../../../tests/helpers/storage-test-utils";

describe("storage/settings-store", () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  afterEach(async () => {
    await cleanupIndexedDbForTests();
  });

  it("retorna null quando a chave ainda nao existe", async () => {
    await expect(getSetting("deepseek-key")).resolves.toBeNull();
  });

  it("persiste e recupera configuracoes tipadas", async () => {
    const updater = createUpdaterFixture({ availableVersion: "0.3.0" });
    const mcpConfig = createMcpConfigFixture({ serverName: "flow-merge-mcp" });

    await setSetting("deepseek-key", "sk-local-test");
    await setSetting("updater", updater);
    await setSetting("mcp-config", mcpConfig);

    await expect(getSetting("deepseek-key")).resolves.toBe("sk-local-test");
    await expect(getSetting("updater")).resolves.toEqual(updater);
    await expect(getSetting("mcp-config")).resolves.toEqual(mcpConfig);
  });

  it("remove configuracoes por chave", async () => {
    await setSetting("active-chat-id", "thread_123");

    await deleteSetting("active-chat-id");

    await expect(getSetting("active-chat-id")).resolves.toBeNull();
  });
});
