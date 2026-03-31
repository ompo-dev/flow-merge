import { expect, test } from "@playwright/test";
import {
  createCharge,
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
  seedWorkspaceArtifacts,
} from "./helpers/license-fixtures";

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

  const storageSnapshot = await page.evaluate(() => ({
    runtimeStore: window.localStorage.getItem("flow-merge-runtime-store"),
    deepseekKey: window.localStorage.getItem("flow-merge-deepseek-key"),
    chatThreads: window.localStorage.getItem("flow-merge-chat-threads"),
    activeChatId: window.localStorage.getItem("flow-merge-active-chat-id"),
    licenseCache: window.localStorage.getItem("flow-merge-license-cache"),
  }));

  expect(storageSnapshot.runtimeStore).toBeNull();
  expect(storageSnapshot.deepseekKey).toBeNull();
  expect(storageSnapshot.chatThreads).toBeNull();
  expect(storageSnapshot.activeChatId).toBeNull();
  expect(storageSnapshot.licenseCache).not.toBeNull();
});
