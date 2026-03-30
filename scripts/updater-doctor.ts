import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cwd = process.cwd();

interface TauriConfig {
  productName?: string;
  version?: string;
  plugins?: {
    updater?: {
      pubkey?: string;
    };
  };
}

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function maybeRead(path: string) {
  if (!(await fileExists(path))) return null;
  return readFile(path, "utf8");
}

async function getGitRemote() {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function findUpdaterBundles(rootPath: string): Promise<string[]> {
  if (!(await fileExists(rootPath))) return [];

  const matches: string[] = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (
        !entry.name.endsWith(".sig") &&
        (/-setup\.exe$/i.test(entry.name) ||
          /\.AppImage$/i.test(entry.name) ||
          /\.app\.tar\.gz$/i.test(entry.name))
      ) {
        matches.push(entryPath);
      }
    }
  }

  await walk(rootPath);
  matches.sort();
  return matches;
}

let hasFailures = false;

function printCheck(ok: boolean, label: string, details?: string) {
  const status = ok ? "OK" : "FAIL";
  if (!ok) {
    hasFailures = true;
  }
  console.log(`${status}  ${label}`);
  if (details) {
    console.log(`     ${details}`);
  }
}

const privateKeyPath = join(cwd, ".codex-temp", "updater.key");
const publicKeyPath = `${privateKeyPath}.pub`;
const devPublicKeyPath = join(cwd, "src-tauri", "updater.dev.pubkey");
const workflowReleasePath = join(cwd, ".github", "workflows", "release-desktop.yml");
const workflowPromotePath = join(cwd, ".github", "workflows", "promote-channel.yml");
const manifestScriptPath = join(cwd, "scripts", "build-updater-manifest.ts");
const tauriConfigPath = join(cwd, "src-tauri", "tauri.conf.json");
const bundleRootPath = join(cwd, "src-tauri", "target", "release", "bundle");

const [remoteUrl, localPublicKeyRaw, devPublicKeyRaw, tauriConfigRaw, updaterBundles] =
  await Promise.all([
    getGitRemote(),
    maybeRead(publicKeyPath),
    maybeRead(devPublicKeyPath),
    maybeRead(tauriConfigPath),
    findUpdaterBundles(bundleRootPath),
  ]);

const tauriConfig = tauriConfigRaw ? (JSON.parse(tauriConfigRaw) as TauriConfig) : null;
const configuredProductName = tauriConfig?.productName?.trim() || null;
const configuredVersion = tauriConfig?.version?.trim() || null;
const tauriConfigPublicKey = tauriConfig?.plugins?.updater?.pubkey?.trim() || null;
const matchingUpdaterBundle =
  configuredVersion == null
    ? null
    : updaterBundles.find(
        (bundlePath) =>
          basename(bundlePath).includes(`_${configuredVersion}_`) ||
          basename(bundlePath).includes(configuredVersion),
      ) ?? null;
const selectedUpdaterBundle = matchingUpdaterBundle ?? updaterBundles.at(-1) ?? null;
const selectedUpdaterSignaturePath = selectedUpdaterBundle ? `${selectedUpdaterBundle}.sig` : null;
const effectivePublicKey = localPublicKeyRaw?.trim() || devPublicKeyRaw?.trim() || null;
const selectedUpdaterSignatureExists = selectedUpdaterSignaturePath
  ? await fileExists(selectedUpdaterSignaturePath)
  : false;

console.log("Flow Merge updater doctor\n");

printCheck(Boolean(remoteUrl), "Git remote configurado", remoteUrl ?? "origin ausente");
printCheck(await fileExists(privateKeyPath), "Chave privada local", privateKeyPath);
printCheck(await fileExists(publicKeyPath), "Chave publica local", publicKeyPath);
printCheck(await fileExists(devPublicKeyPath), "Chave publica default do app", devPublicKeyPath);
printCheck(Boolean(tauriConfig), "Configuracao Tauri", tauriConfigPath);
printCheck(
  Boolean(configuredProductName && configuredVersion),
  "Produto e versao da configuracao",
  configuredProductName && configuredVersion
    ? `${configuredProductName} ${configuredVersion}`
    : "productName/version ausentes",
);
printCheck(
  Boolean(devPublicKeyRaw?.trim()) &&
    Boolean(tauriConfigPublicKey) &&
    devPublicKeyRaw?.trim() === tauriConfigPublicKey,
  "Chave publica default consistente",
  devPublicKeyRaw?.trim() === tauriConfigPublicKey
    ? "src-tauri/updater.dev.pubkey e tauri.conf.json estao alinhados"
    : "a chave default do app difere da chave configurada no tauri.conf.json",
);
printCheck(await fileExists(workflowReleasePath), "Workflow de release", workflowReleasePath);
printCheck(await fileExists(workflowPromotePath), "Workflow de promocao", workflowPromotePath);
printCheck(await fileExists(manifestScriptPath), "Gerador de latest.json", manifestScriptPath);
printCheck(
  updaterBundles.length > 0,
  "Artefato local de updater",
  selectedUpdaterBundle ?? `nenhum artefato encontrado em ${bundleRootPath}`,
);
printCheck(
  selectedUpdaterSignatureExists,
  "Assinatura de artefato local",
  selectedUpdaterSignaturePath ?? "nenhum artefato encontrado para validar .sig",
);

if (selectedUpdaterBundle && configuredVersion) {
  printCheck(
    basename(selectedUpdaterBundle).includes(`_${configuredVersion}_`) ||
      basename(selectedUpdaterBundle).includes(configuredVersion),
    "Artefato combina com a versao configurada",
    basename(selectedUpdaterBundle),
  );
}

if (effectivePublicKey) {
  const keySource = localPublicKeyRaw?.trim() ? publicKeyPath : devPublicKeyPath;
  console.log(
    "\nPublic key para GitHub Repository Variable FLOW_MERGE_UPDATE_PUBLIC_KEY:\n",
  );
  console.log(effectivePublicKey);
  console.log(`\nOrigem da chave exibida: ${keySource}`);
}

console.log("\nSecrets esperados no GitHub:");
console.log("- TAURI_SIGNING_PRIVATE_KEY");
console.log("- TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
console.log("- Variable: FLOW_MERGE_UPDATE_PUBLIC_KEY");

if (hasFailures) {
  console.error("\nUpdater doctor encontrou pendencias.");
  process.exitCode = 1;
} else {
  console.log("\nUpdater doctor finalizado sem pendencias.");
}
