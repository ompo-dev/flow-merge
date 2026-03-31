import { expect, test } from "@playwright/test";
import {
  createCharge,
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
} from "./helpers/license-fixtures";

test("renders the billing lock screen with the active PIX details", async ({ page }) => {
  const blockedLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "blocked",
    planType: "monthly",
    activeCharge: createCharge("monthly"),
  });

  await seedClientState(page, blockedLicense, { releaseChannel: "stable" });
  await mockLicenseStatus(page, () => blockedLicense);

  await page.goto("/");

  await expect(page.getByText("Conta bloqueada")).toBeVisible();
  await expect(page.getByText("O canvas foi bloqueado ate o pagamento entrar.")).toBeVisible();
  await expect(page.getByText("Codigo copia e cola")).toBeVisible();
  await expect(page.getByText("000201FLOWMERGEPIX1234567890")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible();
});
