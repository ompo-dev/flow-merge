import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const rootDir = process.cwd();
export const versionFilePaths = [
  "package.json",
  "src-tauri/Cargo.toml",
  "src-tauri/tauri.conf.json",
] as const;
const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

type CliOptions = {
  allowNonMain: boolean;
  dryRun: boolean;
  version: string;
};

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function normalizeVersion(rawValue?: string | null) {
  const value = rawValue?.trim();
  if (!value) return null;

  const withoutPrefix = value.startsWith("v") ? value.slice(1) : value;
  return semverPattern.test(withoutPrefix) ? withoutPrefix : null;
}

export function parseCliOptions(actionName: string) {
  const args = process.argv.slice(2);
  const versionToken = args.find((value) => !value.startsWith("--"));
  const version = normalizeVersion(versionToken);

  if (!version) {
    fail(
      `Usage: bun run release:${actionName} <version> [--dry-run] [--allow-non-main]\nExample: bun run release:${actionName} 0.2.4`,
    );
  }

  const options: CliOptions = {
    version,
    dryRun: args.includes("--dry-run"),
    allowNonMain: args.includes("--allow-non-main"),
  };

  return options;
}

export function runCommand(
  command: string,
  args: string[],
  options?: {
    env?: Record<string, string | undefined>;
    stdio?: SpawnSyncOptions["stdio"];
  },
) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options?.stdio ?? "pipe",
    env: {
      ...process.env,
      ...options?.env,
    },
  });

  if (result.error) {
    fail(`Failed to run '${command} ${args.join(" ")}': ${result.error.message}`);
  }

  if (result.status !== 0) {
    if ((options?.stdio ?? "pipe") !== "inherit") {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    fail(`Command failed: ${command} ${args.join(" ")}`);
  }

  return (result.stdout ?? "").trim();
}

export function getCurrentBranch() {
  return runCommand("git", ["branch", "--show-current"]);
}

export function ensureMainBranch(allowNonMain: boolean) {
  const branch = getCurrentBranch();
  if (allowNonMain || branch === "main") {
    return branch;
  }

  fail(
    `Release scripts default to main. Current branch: ${branch}\nUse --allow-non-main only if you intentionally want to override this guard.`,
  );
}

export function ensureCleanWorkingTree() {
  const status = runCommand("git", ["status", "--short"]);
  if (status.length > 0) {
    fail("Working tree is not clean. Commit, stash or discard changes before running release automation.");
  }
}

export function localTagExists(tagName: string) {
  const result = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "ignore",
  });

  return result.status === 0;
}

export function remoteTagExists(tagName: string) {
  const result = spawnSync("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tagName}`], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "ignore",
  });

  return result.status === 0;
}

function extractCargoVersion(cargoToml: string) {
  const match = cargoToml.match(/^version = "(.*)"$/m);
  return match?.[1] ?? null;
}

export function readVersionFiles() {
  const packageJsonRaw = readFileSync(join(rootDir, "package.json"), "utf8");
  const packageJson = JSON.parse(packageJsonRaw) as { version?: string };
  const cargoTomlRaw = readFileSync(join(rootDir, "src-tauri", "Cargo.toml"), "utf8");
  const tauriConfigRaw = readFileSync(join(rootDir, "src-tauri", "tauri.conf.json"), "utf8");
  const tauriConfig = JSON.parse(tauriConfigRaw) as { version?: string };

  return {
    "package.json": normalizeVersion(packageJson.version),
    "src-tauri/Cargo.toml": normalizeVersion(extractCargoVersion(cargoTomlRaw)),
    "src-tauri/tauri.conf.json": normalizeVersion(tauriConfig.version),
  };
}

export function ensureVersionFilesMatch(expectedVersion: string) {
  const versionState = readVersionFiles();
  const mismatches = Object.entries(versionState).filter(([, value]) => value !== expectedVersion);

  if (mismatches.length === 0) {
    return;
  }

  const details = mismatches
    .map(([filePath, value]) => `- ${filePath}: found ${value ?? "missing"}, expected ${expectedVersion}`)
    .join("\n");
  fail(`Version files are not aligned with ${expectedVersion}:\n${details}`);
}

export function ensureTagDoesNotExist(tagName: string) {
  if (localTagExists(tagName)) {
    fail(`Tag ${tagName} already exists locally. Delete or move it before publishing another release with the same version.`);
  }

  if (remoteTagExists(tagName)) {
    fail(`Tag ${tagName} already exists on origin. Choose a new version or move the existing tag intentionally.`);
  }
}

export function runBunScript(scriptName: string, env?: Record<string, string | undefined>) {
  runCommand("bun", ["run", scriptName], {
    env,
    stdio: "inherit",
  });
}

export function stageVersionFiles() {
  runCommand("git", ["add", ...versionFilePaths], {
    stdio: "inherit",
  });
}

export function commitVersionBump(version: string) {
  runCommand(
    "git",
    ["commit", "-m", `Update version to ${version} in package.json, Cargo.toml, and tauri.conf.json`],
    {
      stdio: "inherit",
    },
  );
}

export function pushMain() {
  runCommand("git", ["push", "origin", "main"], {
    stdio: "inherit",
  });
}

export function createTag(tagName: string) {
  runCommand("git", ["tag", tagName], {
    stdio: "inherit",
  });
}

export function pushTag(tagName: string) {
  runCommand("git", ["push", "origin", tagName], {
    stdio: "inherit",
  });
}
