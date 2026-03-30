import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface GithubReleaseAsset {
  name: string;
  browser_download_url?: string;
}

interface GithubReleaseResponse {
  tag_name?: string;
  body?: string | null;
  published_at?: string | null;
  assets?: GithubReleaseAsset[];
}

interface PlatformEntry {
  url: string;
  signature: string;
}

type PlatformKey =
  | "windows-x86_64"
  | "windows-aarch64"
  | "darwin-x86_64"
  | "darwin-aarch64"
  | "linux-x86_64"
  | "linux-aarch64";

const releaseJsonPath = process.env.UPDATER_RELEASE_JSON_PATH;
const assetDir = process.env.UPDATER_ASSET_DIR;
const outputPath = process.env.UPDATER_OUTPUT_PATH ?? ".release-assets/latest.json";

if (!releaseJsonPath || !assetDir) {
  throw new Error(
    "UPDATER_RELEASE_JSON_PATH e UPDATER_ASSET_DIR sao obrigatorios para gerar latest.json.",
  );
}

const resolvedReleaseJsonPath = releaseJsonPath;
const resolvedAssetDir = assetDir;

const release = JSON.parse(await readFile(resolvedReleaseJsonPath, "utf8")) as GithubReleaseResponse;
const assets = release.assets ?? [];

async function requireSignature(assetName: string) {
  const signaturePath = join(resolvedAssetDir, `${assetName}.sig`);
  return (await readFile(signaturePath, "utf8")).trim();
}

function normalizeArch(value: string | undefined): "x86_64" | "aarch64" | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "x64" || normalized === "x86_64" || normalized === "amd64") return "x86_64";
  if (normalized === "arm64" || normalized === "aarch64") return "aarch64";
  return null;
}

function detectPlatforms(assetName: string): PlatformKey[] {
  const windowsMatch = assetName.match(/_(x64|x86_64|amd64|arm64|aarch64)-setup\.exe$/i);
  if (windowsMatch) {
    const arch = normalizeArch(windowsMatch[1]);
    return arch ? [`windows-${arch}`] : [];
  }

  const macMatch = assetName.match(/_(x64|x86_64|amd64|arm64|aarch64)\.app\.tar\.gz$/i);
  if (macMatch) {
    const arch = normalizeArch(macMatch[1]);
    return arch ? [`darwin-${arch}`] : [];
  }

  if (/\.app\.tar\.gz$/i.test(assetName)) {
    return ["darwin-x86_64", "darwin-aarch64"];
  }

  const linuxMatch = assetName.match(/_(x64|x86_64|amd64|arm64|aarch64)\.AppImage$/i);
  if (linuxMatch) {
    const arch = normalizeArch(linuxMatch[1]);
    return arch ? [`linux-${arch}`] : [];
  }

  return [];
}

const updaterAssets = assets.filter(
  (entry): entry is Required<Pick<GithubReleaseAsset, "name" | "browser_download_url">> =>
    !entry.name.endsWith(".sig") && typeof entry.browser_download_url === "string",
);

const platforms: Partial<Record<PlatformKey, PlatformEntry>> = {};

for (const asset of updaterAssets) {
  const platformKeys = detectPlatforms(asset.name);
  if (platformKeys.length === 0) continue;

  const signature = await requireSignature(asset.name);
  for (const platformKey of platformKeys) {
    platforms[platformKey] = {
      url: asset.browser_download_url,
      signature,
    };
  }
}

if (Object.keys(platforms).length === 0) {
  throw new Error("Nenhum artefato de updater compativel foi encontrado na release.");
}

const manifest = {
  version: (release.tag_name ?? "v0.0.0").replace(/^v/, ""),
  notes: release.body ?? "",
  pub_date: release.published_at ?? new Date().toISOString(),
  platforms,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Updater manifest written to ${outputPath}`);
