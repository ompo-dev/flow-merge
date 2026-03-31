import { expect, test } from "@playwright/test";
import {
  createCharge,
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
  seedWorkspaceArtifacts,
} from "./helpers/license-fixtures";
import { readFlowMergeDbSnapshot } from "./helpers/storage-fixtures";

test("recovers the workspace after a blocked account gets paid", async ({ page }) => {
  let currentLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "blocked",
    planType: "monthly",
    activeCharge: createCharge("monthly"),
  });

  await seedClientState(page, currentLicense, { releaseChannel: "stable" });
  await mockLicenseStatus(page, () => currentLicense);

  await page.goto("/");

  await expect(page.getByText("Conta bloqueada")).toBeVisible();
  await expect(page.getByText("O canvas foi bloqueado ate o pagamento entrar.")).toBeVisible();

  currentLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
    activeCharge: null,
  });

  await page.getByRole("button", { name: "Atualizar" }).click();

  await expect(page.getByText("Conta bloqueada")).toHaveCount(0);
  await expect(page.getByTestId("toolbar-settings-button")).toBeVisible();
});

test("wipes local workspace artifacts when the license payload requests deletion", async ({
  page,
}) => {
  const deletedLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "deleted",
    planType: "monthly",
    shouldWipeLocalData: true,
    timeline: {
      deleteAt: "2026-04-27T12:00:00.000Z",
    },
  });

  await seedClientState(page, deletedLicense, { releaseChannel: "stable" });
  await seedWorkspaceArtifacts(page);
  await mockLicenseStatus(page, () => deletedLicense);

  await page.goto("/");

  await expect(page.getByText("Conta removida")).toBeVisible();
  await expect(page.getByText("A grace terminou e os dados locais foram limpos.")).toBeVisible();

  const storageSnapshot = await readFlowMergeDbSnapshot(page);
  expect(storageSnapshot.runtimeCollections).toEqual([]);
  expect(storageSnapshot.chatThreads).toEqual([]);
  expect(storageSnapshot.settings["deepseek-key"]).toBeUndefined();
  expect(storageSnapshot.settings["active-chat-id"]).toBeUndefined();
  expect(storageSnapshot.settings["license-cache"]).toEqual(
    expect.objectContaining({
      accessState: "deleted",
      shouldWipeLocalData: true,
    }),
  );
});
