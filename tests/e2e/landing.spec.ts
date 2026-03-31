import { expect, test } from "@playwright/test";
import { createLicensePayload, mockLicenseStatus } from "./helpers/license-fixtures";

test("renders the landing positioning for anonymous visitors", async ({ page }) => {
  const anonymousLicense = createLicensePayload({
    authenticated: false,
    accessState: null,
  });

  await mockLicenseStatus(page, () => anonymousLicense);
  await page.goto("/");

  await expect(page.locator("body")).toContainText("Automacao e analytics no mesmo canvas.");
  await expect(page.locator("body")).toContainText(
    "Capture qualquer dado, transforme em workflow e entenda impacto real no negocio sem trocar de ferramenta.",
  );
  await expect(page.locator("body")).toContainText("n8n executa");
  await expect(page.locator("body")).toContainText("PostHog analisa");
  await expect(page.locator("body")).toContainText("Flow Merge junta");
});
