import {
  commitVersionBump,
  ensureCleanWorkingTree,
  ensureMainBranch,
  ensureTagDoesNotExist,
  ensureVersionFilesMatch,
  parseCliOptions,
  runBunScript,
  stageVersionFiles,
} from "./release-utils";

const { allowNonMain, dryRun, version } = parseCliOptions("prepare");
const tagName = `v${version}`;
const versionEnv = {
  FLOW_MERGE_VERSION: version,
};

ensureCleanWorkingTree();
const branch = ensureMainBranch(allowNonMain);
ensureTagDoesNotExist(tagName);

if (dryRun) {
  console.log("Release prepare dry run");
  console.log(`- branch: ${branch}`);
  console.log(`- version: ${version}`);
  console.log(`- tag: ${tagName}`);
  console.log("- checks: clean working tree, branch gate, tag availability");
  console.log("- actions: version sync, version commit, build validation");
  process.exit(0);
}

runBunScript("version:sync", versionEnv);
ensureVersionFilesMatch(version);
stageVersionFiles();
commitVersionBump(version);
runBunScript("build", versionEnv);
ensureCleanWorkingTree();

console.log(`Release ${version} prepared successfully.`);
console.log(`Next step: bun run release:publish ${version}`);
