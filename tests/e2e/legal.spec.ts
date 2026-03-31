import { expect, test } from "@playwright/test";
import { createLicensePayload, mockLicenseStatus } from "./helpers/license-fixtures";

test("renders the legal public page on /legal", async ({ page }) => {
  const anonymousLicense = createLicensePayload({
    authenticated: false,
    accessState: null,
  });

  await mockLicenseStatus(page, () => anonymousLicense);
  await page.goto("/legal");

  await expect(page).toHaveURL(/\/legal$/);
  await expect(page.locator("body")).toContainText("Termos, responsabilidade e privacidade no mesmo canvas.");
  await expect(page.locator("body")).toContainText("Privacidade e dados");
  await expect(page.locator("body")).toContainText("Responsabilidade operacional");
  await expect(page.locator("body")).toContainText("Billing, cancelamento e delecao");
});
