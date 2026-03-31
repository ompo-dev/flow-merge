import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteProject, getAllProjects, getProject, saveAllProjects, saveProject } from "@/lib/storage/projects-store";
import {
  cleanupIndexedDbForTests,
  createProjectFixture,
  resetIndexedDbForTests,
} from "../../../tests/helpers/storage-test-utils";

describe("storage/projects-store", () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  afterEach(async () => {
    await cleanupIndexedDbForTests();
  });

  it("salva e recupera projetos individualmente", async () => {
    const project = createProjectFixture();

    await saveProject(project);

    await expect(getProject(project.id)).resolves.toEqual(project);
    await expect(getAllProjects()).resolves.toEqual([project]);
  });

  it("saveAllProjects substitui a colecao inteira", async () => {
    await saveProject(createProjectFixture({ id: "old_project" }));
    const nextProjects = [
      createProjectFixture({ id: "project_a", name: "Projeto A" }),
      createProjectFixture({ id: "project_b", name: "Projeto B", active: false }),
    ];

    await saveAllProjects(nextProjects);

    await expect(getAllProjects()).resolves.toEqual(nextProjects);
  });

  it("remove projetos por id", async () => {
    const projectA = createProjectFixture({ id: "project_a" });
    const projectB = createProjectFixture({ id: "project_b" });
    await saveAllProjects([projectA, projectB]);

    await deleteProject(projectA.id);

    await expect(getProject(projectA.id)).resolves.toBeUndefined();
    await expect(getAllProjects()).resolves.toEqual([projectB]);
  });
});
