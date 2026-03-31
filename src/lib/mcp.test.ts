import { describe, expect, it } from "vitest";
import { MCP_RESOURCE_CATALOG, MCP_TOOL_CATALOG } from "@/lib/mcp-catalog";
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

    const cursor = snippets.find((e) => e.id === "cursor")!;
    expect(cursor.snippet).toContain("Authorization");
    expect(cursor.snippet).toContain("http://127.0.0.1:45431/mcp");
    expect(cursor.snippet).not.toContain("?token=");
  });

  it("documents direct MCP tools instead of the native assistant bridge", () => {
    const toolNames = MCP_TOOL_CATALOG.map((entry) => entry.name);

    expect(toolNames).toContain("flow_merge_get_node_catalog");
    expect(toolNames).toContain("flow_merge_create_workflow");
    expect(toolNames).toContain("flow_merge_apply_workspace_change_set");
    expect(toolNames).toContain("flow_merge_apply_workflow_change_set");
    expect(toolNames).not.toContain("flow_merge_run_assistant");
  });

  it("documents canvas tools as a readable MCP resource", () => {
    const resourceNames = MCP_RESOURCE_CATALOG.map((entry) => entry.name);

    expect(resourceNames).toContain("flowmerge://canvas/tools");
  });
});
