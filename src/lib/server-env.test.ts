import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("server-env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("inclui a base da aplicacao, localhost, tauri e origens extras sem duplicar", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/flowmerge");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret");
    vi.stubEnv("BETTER_AUTH_URL", "https://flowmerge.app");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    vi.stubEnv(
      "FLOW_MERGE_TRUSTED_ORIGINS",
      "https://desktop.flowmerge.app, https://flowmerge.app",
    );

    const { getTrustedOrigins } = await import("./server-env");
    expect(getTrustedOrigins()).toEqual([
      "https://flowmerge.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "tauri://localhost",
      "https://desktop.flowmerge.app",
    ]);
  });
});
