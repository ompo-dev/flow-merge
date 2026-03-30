import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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

async function runVersionSync(args: string[]) {
  const isBuildLikeCommand = args.some((value) => value === "build" || value === "bundle");
  if (!isBuildLikeCommand) return;

  await new Promise<void>((resolve, reject) => {
    const syncProcess = spawn(process.execPath, ["scripts/sync-version.ts"], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
      shell: false,
    });

    syncProcess.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Version sync interrupted by signal ${signal}`));
        return;
      }
      if (code && code !== 0) {
        reject(new Error(`Version sync failed with exit code ${code}`));
        return;
      }
      resolve();
    });

    syncProcess.on("error", reject);
  });
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

async function buildConfigArgs(args: string[], env: NodeJS.ProcessEnv) {
  const isBuildLikeCommand = args.some((value) => value === "build" || value === "bundle");
  if (!isBuildLikeCommand) {
    return args;
  }

  const frontendDist = env.FLOW_MERGE_DESKTOP_FRONTEND_DIST?.trim();
  if (!frontendDist) {
    throw new Error(
      "FLOW_MERGE_DESKTOP_FRONTEND_DIST nao definido. Configure a URL web hospedada para empacotar o desktop sem depender de static export.",
    );
  }

  const tempDir = join(rootDir, ".codex-temp");
  const configPath = join(tempDir, "tauri.remote.conf.json");

  await mkdir(tempDir, { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify(
      {
        build: {
          frontendDist,
          beforeBuildCommand: null,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return [...args, "--config", configPath];
}

const args = process.argv.slice(2);
await runVersionSync(args);
const env = await loadUpdaterSigningEnv();
const tauriArgs = await buildConfigArgs(args, env);

const child = spawn(tauriBinary, tauriArgs, {
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
