import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const rootDir = process.cwd();
const packageJsonPath = join(rootDir, "package.json");
const cargoTomlPath = join(rootDir, "src-tauri", "Cargo.toml");
const tauriConfigPath = join(rootDir, "src-tauri", "tauri.conf.json");
const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function normalizeVersion(rawValue?: string | null) {
  const value = rawValue?.trim();
  if (!value) return null;

  const withoutPrefix = value.startsWith("v") ? value.slice(1) : value;
  return semverPattern.test(withoutPrefix) ? withoutPrefix : null;
}

async function syncVersion() {
  const packageJsonRaw = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonRaw) as { version: string };
  const packageVersion = normalizeVersion(packageJson.version);

  if (!packageVersion) {
    throw new Error(`Versao invalida em package.json: ${packageJson.version}`);
  }

  // FLOW_MERGE_VERSION / RELEASE_VERSION: release scripts or CI overrides.
  // package.json is the canonical source for normal dev and for `bun run build`
  // after a version commit — never let GITHUB_REF_NAME (often set in shells/CI)
  // override it or local prepare regresses (e.g. 0.2.6 -> 0.2.2).
  const desiredVersion =
    normalizeVersion(process.env.FLOW_MERGE_VERSION) ??
    normalizeVersion(process.env.RELEASE_VERSION) ??
    packageVersion;

  const changes: string[] = [];

  if (packageJson.version !== desiredVersion) {
    packageJson.version = desiredVersion;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
    changes.push(`package.json -> ${desiredVersion}`);
  }

  const cargoTomlRaw = await readFile(cargoTomlPath, "utf8");
  const nextCargoToml = cargoTomlRaw.replace(
    /^version = ".*"$/m,
    `version = "${desiredVersion}"`,
  );
  if (nextCargoToml !== cargoTomlRaw) {
    await writeFile(cargoTomlPath, nextCargoToml, "utf8");
    changes.push(`src-tauri/Cargo.toml -> ${desiredVersion}`);
  }

  const tauriConfigRaw = await readFile(tauriConfigPath, "utf8");
  const tauriConfig = JSON.parse(tauriConfigRaw) as { version: string };
  if (tauriConfig.version !== desiredVersion) {
    tauriConfig.version = desiredVersion;
    await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`, "utf8");
    changes.push(`src-tauri/tauri.conf.json -> ${desiredVersion}`);
  }

  if (changes.length === 0) {
    console.log(`Version already synced at ${desiredVersion}`);
    return;
  }

  console.log("Synced desktop version:");
  for (const change of changes) {
    console.log(`- ${change}`);
  }
}

await syncVersion();
