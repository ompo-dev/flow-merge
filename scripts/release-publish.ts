import {
  createTag,
  ensureCleanWorkingTree,
  ensureMainBranch,
  ensureTagDoesNotExist,
  ensureVersionFilesMatch,
  parseCliOptions,
  pushMain,
  pushTag,
} from "./release-utils";

const { allowNonMain, dryRun, version } = parseCliOptions("publish");
const tagName = `v${version}`;
const branch = ensureMainBranch(allowNonMain);

ensureCleanWorkingTree();
ensureVersionFilesMatch(version);
ensureTagDoesNotExist(tagName);

if (dryRun) {
  console.log("Release publish dry run");
  console.log(`- branch: ${branch}`);
  console.log(`- version: ${version}`);
  console.log(`- tag: ${tagName}`);
  console.log("- actions: git push origin main, git tag, git push origin <tag>");
  process.exit(0);
}

pushMain();
createTag(tagName);
pushTag(tagName);

console.log(`Release ${tagName} published successfully.`);
