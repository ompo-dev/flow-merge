import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAllThreads, deleteThread, getAllThreads, saveAllThreads, saveThread } from "@/lib/storage/chat-store";
import {
  cleanupIndexedDbForTests,
  createChatThreadFixture,
  resetIndexedDbForTests,
} from "../../../tests/helpers/storage-test-utils";

describe("storage/chat-store", () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  afterEach(async () => {
    await cleanupIndexedDbForTests();
  });

  it("salva threads e devolve ordenadas por updatedAt desc", async () => {
    const older = createChatThreadFixture({ id: "thread_old", updatedAt: 100 });
    const newer = createChatThreadFixture({ id: "thread_new", updatedAt: 200 });

    await saveThread(older);
    await saveThread(newer);

    await expect(getAllThreads()).resolves.toEqual([newer, older]);
  });

  it("saveAllThreads substitui a colecao inteira", async () => {
    await saveThread(createChatThreadFixture({ id: "legacy_thread" }));
    const nextThreads = [
      createChatThreadFixture({ id: "thread_a", updatedAt: 300 }),
      createChatThreadFixture({ id: "thread_b", updatedAt: 100 }),
    ];

    await saveAllThreads(nextThreads);

    await expect(getAllThreads()).resolves.toEqual([nextThreads[0], nextThreads[1]]);
  });

  it("remove threads individuais e limpa tudo", async () => {
    const threadA = createChatThreadFixture({ id: "thread_a" });
    const threadB = createChatThreadFixture({ id: "thread_b" });
    await saveAllThreads([threadA, threadB]);

    await deleteThread(threadA.id);
    await expect(getAllThreads()).resolves.toEqual([threadB]);

    await clearAllThreads();
    await expect(getAllThreads()).resolves.toEqual([]);
  });
});
