import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const tauriBinary =
  process.platform === "win32"
    ? join(rootDir, "node_modules", ".bin", "tauri.exe")
    : join(rootDir, "node_modules", ".bin", "tauri");

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadUpdaterSigningEnv() {
  const env = { ...process.env };
  const args = process.argv.slice(2);
  const isBuildLikeCommand = args.some((value) => value === "build" || value === "bundle");

  if (!isBuildLikeCommand) {
    return env;
  }

  if (!env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
    const privateKeyPath =
      env.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim() || join(rootDir, ".codex-temp", "updater.key");

    if (await fileExists(privateKeyPath)) {
      env.TAURI_SIGNING_PRIVATE_KEY = await readFile(privateKeyPath, "utf8");
      if (!env.TAURI_SIGNING_PRIVATE_KEY_PATH) {
        console.log(`Using updater private key from ${privateKeyPath}`);
      }
      if (env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD == null) {
        env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
      }

      const publicKeyPath = `${privateKeyPath}.pub`;
      if (!env.FLOW_MERGE_UPDATE_PUBLIC_KEY?.trim() && (await fileExists(publicKeyPath))) {
        env.FLOW_MERGE_UPDATE_PUBLIC_KEY = (await readFile(publicKeyPath, "utf8")).trim();
      }
    }
  }

  if (!env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
    throw new Error(
      "TAURI_SIGNING_PRIVATE_KEY nao definido. Defina a variavel ou salve a chave em .codex-temp/updater.key.",
    );
  }

  return env;
}

const env = await loadUpdaterSigningEnv();
const args = process.argv.slice(2);

const child = spawn(tauriBinary, args, {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
