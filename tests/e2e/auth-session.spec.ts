import { expect, test } from "@playwright/test";
import {
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
  seedWorkspaceArtifacts,
} from "./helpers/license-fixtures";
import { readFlowMergeDbSnapshot } from "./helpers/storage-fixtures";

test("starts the Google login flow from the landing access node", async ({ page }) => {
  const anonymousLicense = createLicensePayload({
    authenticated: false,
    accessState: null,
  });

  await mockLicenseStatus(page, () => anonymousLicense);
  await page.route("**/api/auth/sign-in/social", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: "http://127.0.0.1:3001/mock-google-consent",
      }),
    });
  });
  await page.route("**/mock-google-consent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body><h1>Mock Google Consent</h1></body></html>",
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Ir para access" }).click();
  await page.getByTestId("landing-login-google-button").click();

  await expect(page).toHaveURL("http://127.0.0.1:3001/mock-google-consent");
  await expect(page.getByRole("heading", { name: "Mock Google Consent" })).toBeVisible();
});

test("signs out from the account modal and returns to the landing surface", async ({ page }) => {
  const activeLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
  });

  await seedClientState(page, activeLicense, { releaseChannel: "stable" });
  await mockLicenseStatus(page, () => activeLicense);
  await page.route("**/api/auth/sign-out", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto("/");
  await page.getByTestId("toolbar-settings-button").click();
  await page.getByTestId("settings-tab-account").click();
  await page.getByTestId("account-signout-button").click();

  await expect(
    page
      .getByTestId("rf__node-landing-home-hero")
      .getByText("Automacao e analytics no mesmo canvas."),
  ).toBeVisible();
  await expect(page.getByTestId("toolbar-settings-button")).toHaveCount(0);

  const storageSnapshot = await readFlowMergeDbSnapshot(page);
  expect(storageSnapshot.settings["license-cache"]).toBeUndefined();
  expect(storageSnapshot.settings["last-user-id"]).toBe(activeLicense.user?.id ?? null);
});

test("wipes local workspace when the authenticated user changes across refresh", async ({
  page,
}) => {
  const initialLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
    user: {
      id: "user_e2e_1",
      name: "Usuario Um",
      email: "um@example.com",
    },
  });
  const switchedLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
    user: {
      id: "user_e2e_2",
      name: "Usuario Dois",
      email: "dois@example.com",
    },
  });

  await seedClientState(page, initialLicense, { releaseChannel: "stable" });
  await seedWorkspaceArtifacts(page);
  await mockLicenseStatus(page, () => switchedLicense);

  await page.goto("/");

  await expect(page.getByTestId("toolbar-settings-button")).toBeVisible();

  const storageSnapshot = await readFlowMergeDbSnapshot(page);
  expect(storageSnapshot.runtimeCollections).toEqual([]);
  expect(storageSnapshot.chatThreads).toEqual([]);
  expect(storageSnapshot.settings["deepseek-key"]).toBeUndefined();
  expect(storageSnapshot.settings["active-chat-id"]).toBeUndefined();
  expect(storageSnapshot.settings["license-cache"]).toEqual(
    expect.objectContaining({
      user: expect.objectContaining({ id: "user_e2e_2" }),
    }),
  );
  expect(storageSnapshot.settings["last-user-id"]).toBe("user_e2e_2");
});
