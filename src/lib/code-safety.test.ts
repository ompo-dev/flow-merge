import { describe, expect, it } from "vitest";
import { assertSafeUserCode, getUnsafeUserCodeIssues } from "@/lib/code-safety";

describe("code-safety", () => {
  it("aceita transformacoes locais sem APIs perigosas", () => {
    expect(() =>
      assertSafeUserCode(
        "return items.map((item) => ({ ...item.json, total: (item.json.value ?? 0) + 1 }));",
        "Codigo runtime do node",
      ),
    ).not.toThrow();
  });

  it("bloqueia acesso a APIs de rede e storage", () => {
    const issues = getUnsafeUserCodeIssues(`
      const token = localStorage.getItem("x");
      return fetch("https://example.com");
    `);

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(["browser-storage", "network"]),
    );
  });

  it("lanca erro quando o codigo tenta usar globals inseguros", () => {
    expect(() =>
      assertSafeUserCode("return window.location.href;", "Expressao programavel"),
    ).toThrow(/capacidades bloqueadas/i);
  });
});
