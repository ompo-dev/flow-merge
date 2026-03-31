import { expect, test } from "@playwright/test";
import {
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
} from "./helpers/license-fixtures";

test("shows the active monthly subscription and reopens PIX after cancellation", async ({
  page,
}) => {
  let currentLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
  });

  await seedClientState(page, currentLicense, { releaseChannel: "stable" });
  await mockLicenseStatus(page, () => currentLicense);
  await page.route("**/api/billing/cancel", async (route) => {
    currentLicense = createLicensePayload({
      releaseLevel: "stable",
      accessState: "payment_pending",
      planType: null,
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto("/");
  await page.getByTestId("toolbar-settings-button").click();
  await page.getByTestId("settings-tab-account").click();

  await expect(page.getByTestId("account-plans-section")).toContainText("Pro Mensal ativo");
  await expect(page.getByTestId("account-plans-section")).toContainText(
    "Fazer upgrade para vitalicio",
  );
  await expect(page.getByTestId("account-plans-section").getByText("Gerar PIX mensal")).toHaveCount(0);
  await expect(page.getByTestId("account-internal-tools-section")).toHaveCount(0);

  await page.getByTestId("account-cancel-plan-button").click();

  await expect(page.getByTestId("account-plans-section")).toContainText("Gerar PIX mensal");
  await expect(page.getByText("Pagamento pendente").first()).toBeVisible();
  await expect(page.getByTestId("account-plans-section")).not.toContainText("Pro Mensal ativo");
});

test("toggles internal-only billing tools based on the active local role", async ({ page }) => {
  const internalLicense = createLicensePayload({
    releaseLevel: "internal",
    accessState: "active_monthly",
    planType: "monthly",
  });

  await seedClientState(page, internalLicense, { releaseChannel: "internal" });
  await mockLicenseStatus(page, () => internalLicense);

  await page.goto("/");
  await page.getByTestId("toolbar-settings-button").click();
  await page.getByTestId("settings-tab-account").click();

  await expect(page.getByTestId("account-internal-tools-section")).toBeVisible();
  await expect(page.getByTestId("account-internal-tools-section")).toContainText(
    "Simular upgrade para vitalicio",
  );

  await page.getByTestId("settings-tab-general").click();
  await page.getByTestId("settings-release-role-select").selectOption("beta");
  await page.getByTestId("settings-tab-account").click();

  await expect(page.getByTestId("account-internal-tools-section")).toHaveCount(0);

  await page.getByTestId("settings-tab-general").click();
  await page.getByTestId("settings-release-role-select").selectOption("internal");
  await page.getByTestId("settings-tab-account").click();

  await expect(page.getByTestId("account-internal-tools-section")).toBeVisible();
});
