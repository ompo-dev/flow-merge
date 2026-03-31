import { readFile } from "node:fs/promises";
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

function extractCargoVersion(cargoToml: string) {
  const match = cargoToml.match(/^version = "(.*)"$/m);
  return match?.[1] ?? null;
}

async function main() {
  const expectedVersion = normalizeVersion(process.env.GITHUB_REF_NAME);

  if (!expectedVersion) {
    console.log("Skipping tagged release verification outside a version tag context.");
    return;
  }

  const packageJsonRaw = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonRaw) as { version?: string };
  const cargoTomlRaw = await readFile(cargoTomlPath, "utf8");
  const tauriConfigRaw = await readFile(tauriConfigPath, "utf8");
  const tauriConfig = JSON.parse(tauriConfigRaw) as { version?: string };

  const actualVersions = {
    "package.json": normalizeVersion(packageJson.version),
    "src-tauri/Cargo.toml": normalizeVersion(extractCargoVersion(cargoTomlRaw)),
    "src-tauri/tauri.conf.json": normalizeVersion(tauriConfig.version),
  };

  const mismatches = Object.entries(actualVersions).filter(([, value]) => value !== expectedVersion);

  if (mismatches.length === 0) {
    console.log(`Tagged commit already matches ${expectedVersion}.`);
    return;
  }

  console.error(`Release tag ${process.env.GITHUB_REF_NAME} points to a commit with mismatched version files.`);
  for (const [filePath, value] of mismatches) {
    console.error(`- ${filePath}: found ${value ?? "missing"}, expected ${expectedVersion}`);
  }

  console.error(
    "Fix: sync the version files, commit that change, push main, then create and push the tag on that exact commit.",
  );
  process.exit(1);
}

await main();
