import { describe, expect, it } from "vitest";
import {
  clampReleaseChannel,
  getEffectiveReleaseAccess,
  getReleaseAccess,
  getVisibleReleaseChannels,
} from "@/lib/release-access";

describe("release-access", () => {
  it("expande canais corretamente por role", () => {
    expect(getReleaseAccess("stable")).toEqual({
      level: "stable",
      allowedChannels: ["stable"],
    });
    expect(getReleaseAccess("beta")).toEqual({
      level: "beta",
      allowedChannels: ["stable", "beta"],
    });
    expect(getReleaseAccess("internal")).toEqual({
      level: "internal",
      allowedChannels: ["stable", "beta", "internal"],
    });
  });

  it("impede subir acima da role real ao selecionar canal ativo", () => {
    const betaAccess = getReleaseAccess("beta");
    expect(getEffectiveReleaseAccess(betaAccess, "internal")).toEqual(betaAccess);
    expect(getEffectiveReleaseAccess(betaAccess, "stable")).toEqual(
      getReleaseAccess("stable"),
    );
  });

  it("filtra os canais visiveis pela intersecao entre suporte e permissao", () => {
    expect(
      getVisibleReleaseChannels(["stable", "beta", "internal"], ["stable", "beta"]),
    ).toEqual(["stable", "beta"]);
    expect(clampReleaseChannel("internal", ["stable"], ["stable", "beta", "internal"])).toBe(
      "stable",
    );
  });
});
