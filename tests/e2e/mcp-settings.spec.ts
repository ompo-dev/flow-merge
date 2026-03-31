import { expect, test } from "@playwright/test";
import {
  createLicensePayload,
  mockLicenseStatus,
  seedClientState,
} from "./helpers/license-fixtures";

test("shows the MCP settings tab with local endpoint snippets", async ({ page }) => {
  const activeLicense = createLicensePayload({
    releaseLevel: "stable",
    accessState: "active_monthly",
    planType: "monthly",
  });

  await seedClientState(page, activeLicense, { releaseChannel: "stable" });
  await mockLicenseStatus(page, () => activeLicense);

  await page.goto("/");
  await page.getByTestId("toolbar-settings-button").click();
  await page.getByTestId("settings-tab-mcp").click();

  await expect(page.getByTestId("settings-mcp-panel")).toBeVisible();
  await expect(page.getByTestId("settings-mcp-endpoint-card")).toContainText(
    "http://127.0.0.1:45431/mcp",
  );
  await expect(page.getByTestId("settings-mcp-clients-card")).toContainText(
    "Codex",
  );
  await expect(page.getByTestId("settings-mcp-clients-card")).toContainText(
    "Cursor",
  );
  await expect(page.getByTestId("settings-mcp-clients-card")).toContainText(
    "Claude Code",
  );
  await expect(page.getByTestId("settings-mcp-panel")).toContainText(
    "mutacoes deterministicas",
  );
  await expect(page.getByTestId("settings-mcp-panel")).toContainText(
    "Apply workflow change set",
  );
});
