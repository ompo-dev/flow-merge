import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteProjectRuntimeStore,
  getAllProjectRuntimeStores,
  getProjectRuntimeStore,
  saveProjectRuntimeStore,
} from "@/lib/storage/runtime-store";
import {
  cleanupIndexedDbForTests,
  createRuntimeCollectionRecord,
  createRuntimeStoreFixture,
  resetIndexedDbForTests,
} from "../../../tests/helpers/storage-test-utils";

describe("storage/runtime-store", () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  afterEach(async () => {
    await cleanupIndexedDbForTests();
  });

  it("retorna store vazio quando o projeto ainda nao possui colecoes", async () => {
    await expect(getProjectRuntimeStore("project_empty")).resolves.toEqual({
      collections: {},
      lastUpdatedAt: null,
    });
  });

  it("salva colecoes por projeto e substitui entradas antigas", async () => {
    await saveProjectRuntimeStore(
      "project_1",
      createRuntimeStoreFixture({
        collections: {
          logs: [createRuntimeCollectionRecord({ id: "log_1" })],
          alerts: [createRuntimeCollectionRecord({ id: "alert_1" })],
        },
        lastUpdatedAt: 111,
      }),
    );

    await saveProjectRuntimeStore(
      "project_1",
      createRuntimeStoreFixture({
        collections: {
          logs: [createRuntimeCollectionRecord({ id: "log_2" })],
        },
        lastUpdatedAt: 222,
      }),
    );

    await expect(getProjectRuntimeStore("project_1")).resolves.toEqual({
      collections: {
        logs: [expect.objectContaining({ id: "log_2" })],
      },
      lastUpdatedAt: 222,
    });
  });

  it("remove todas as colecoes de um projeto", async () => {
    await saveProjectRuntimeStore("project_1", createRuntimeStoreFixture());

    await deleteProjectRuntimeStore("project_1");

    await expect(getProjectRuntimeStore("project_1")).resolves.toEqual({
      collections: {},
      lastUpdatedAt: null,
    });
  });

  it("reconstroi todos os stores persistidos por projeto", async () => {
    await saveProjectRuntimeStore(
      "project_a",
      createRuntimeStoreFixture({
        collections: {
          logs: [createRuntimeCollectionRecord({ id: "log_a" })],
        },
        lastUpdatedAt: 100,
      }),
    );
    await saveProjectRuntimeStore(
      "project_b",
      createRuntimeStoreFixture({
        collections: {
          revenue: [createRuntimeCollectionRecord({ id: "rev_b" })],
        },
        lastUpdatedAt: 200,
      }),
    );

    await expect(getAllProjectRuntimeStores()).resolves.toEqual({
      project_a: {
        collections: {
          logs: [expect.objectContaining({ id: "log_a" })],
        },
        lastUpdatedAt: 100,
      },
      project_b: {
        collections: {
          revenue: [expect.objectContaining({ id: "rev_b" })],
        },
        lastUpdatedAt: 200,
      },
    });
  });
});
