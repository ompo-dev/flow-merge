import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyProjectRuntimeStore, getDb } from "@/lib/storage/db";
import {
  cleanupIndexedDbForTests,
  resetIndexedDbForTests,
} from "../../../tests/helpers/storage-test-utils";

describe("storage/db", () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  afterEach(async () => {
    await cleanupIndexedDbForTests();
  });

  it("cria o schema completo do IndexedDB com stores e indices esperados", async () => {
    const db = await getDb();

    expect(Array.from(db.objectStoreNames)).toEqual([
      "chat_threads",
      "projects",
      "runtime_collections",
      "settings",
      "workflows",
    ]);

    const workflowStore = db.transaction("workflows").store;
    const runtimeStore = db.transaction("runtime_collections").store;
    const chatStore = db.transaction("chat_threads").store;

    expect(Array.from(workflowStore.indexNames)).toEqual(["by_project"]);
    expect(Array.from(runtimeStore.indexNames)).toEqual(["by_project"]);
    expect(Array.from(chatStore.indexNames)).toEqual(["by_updatedAt"]);
  });

  it("retorna um runtime store vazio por padrao", () => {
    expect(createEmptyProjectRuntimeStore()).toEqual({
      collections: {},
      lastUpdatedAt: null,
    });
  });
});
