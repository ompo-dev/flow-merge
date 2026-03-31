import { describe, expect, it } from "vitest";
import {
  buildMcpConnectionUrl,
  buildMcpPresetSnippets,
  createDefaultMcpConfig,
} from "@/lib/mcp";

describe("mcp helpers", () => {
  it("builds a tokenized local connection url", () => {
    const config = createDefaultMcpConfig();
    const url = buildMcpConnectionUrl(
      {
        endpointUrl: "http://127.0.0.1:45431/mcp",
      },
      config,
    );

    expect(url).toContain("http://127.0.0.1:45431/mcp");
    expect(url).toContain("token=");
    expect(url).toContain(config.authToken);
  });

  it("builds snippets for every supported preset", () => {
    const snippets = buildMcpPresetSnippets(
      "http://127.0.0.1:45431/mcp?token=test-token",
    );

    expect(snippets).toHaveLength(4);
    expect(snippets.map((entry) => entry.id)).toEqual([
      "codex",
      "cursor",
      "claude_code",
      "vscode",
    ]);
    expect(snippets.every((entry) => entry.snippet.includes("test-token"))).toBe(
      true,
    );
  });
});
