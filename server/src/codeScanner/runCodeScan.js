import { parseRepoUrl, getRepoFileTree, getFileContent } from "./githubClient.js";
import dependencyCheck from "./checks/dependencyCheck.js";
import exposedEnvCheck from "./checks/exposedEnvCheck.js";
import secretScanCheck from "./checks/secretScanCheck.js";
import { scoreFindings } from "../scanner/scoring.js";

// Only fetch content for a BOUNDED set of files — scanning every file in a
// large repo would be slow, expensive on GitHub's rate limit, and mostly
// pointless (compiled output, images, node_modules aren't worth scanning).
// This targets the files most likely to actually contain a hardcoded secret.
const SECRET_SCAN_FILE_PATTERN = /\.(js|jsx|ts|tsx|json|ya?ml|env.*)$/i;
const MAX_FILES_TO_SECRET_SCAN = 15;

// Matches "package.json" anywhere in the tree EXCEPT inside node_modules —
// a monorepo layout like this project's own client/server split (or
// FitFlow's Frontend/Backend split) has multiple real package.json files,
// but a dependency's own bundled package.json inside node_modules is not
// something we scanned as source and would just create noisy duplicates.
const PACKAGE_JSON_PATTERN = /(^|\/)package\.json$/;
function isInsideNodeModules(path) {
  return path.includes("node_modules/");
}

/**
 * Runs a code scan against a GitHub repo and returns the scored result —
 * same shape as scanner/runScan.js, so it plugs into the exact same
 * scoring/OWASP-mapping/remediation pipeline unchanged (see scoring.js).
 * This function has no Express/DB dependency, same as runScan.js.
 */
export default async function runCodeScan(repoUrl) {
  const { owner, repo } = parseRepoUrl(repoUrl);

  // Step 1: get the repo's full file list ONCE — every check below reads
  // from this same list instead of each re-fetching it.
  const fileTree = await getRepoFileTree(owner, repo);

  // Step 2: fetch EVERY package.json in the repo, not just the root one —
  // see PACKAGE_JSON_PATTERN comment above for why that matters.
  const packageJsonPaths = fileTree.filter(
    (path) => PACKAGE_JSON_PATTERN.test(path) && !isInsideNodeModules(path)
  );

  const packageJsonFiles = [];
  await Promise.all(
    packageJsonPaths.map(async (path) => {
      try {
        const raw = await getFileContent(owner, repo, path);
        packageJsonFiles.push({ path, content: JSON.parse(raw) });
      } catch {
        // A malformed package.json at this path just means we skip it —
        // not a reason to fail the whole scan.
      }
    })
  );

  // Step 3: fetch a bounded set of files for the secret scan. Promise.all
  // here (not allSettled) is fine because a single failed file fetch is
  // caught per-file below and just excluded, rather than one bad file
  // aborting every other file's fetch.
  const filesToScan = fileTree
    .filter((path) => SECRET_SCAN_FILE_PATTERN.test(path))
    .slice(0, MAX_FILES_TO_SECRET_SCAN);

  const fileContents = {};
  await Promise.all(
    filesToScan.map(async (path) => {
      try {
        fileContents[path] = await getFileContent(owner, repo, path);
      } catch {
        // Skip files GitHub fails to return (binary content, deleted
        // between listing and fetching, etc.) rather than failing the scan.
      }
    })
  );

  // Step 4: run every check in parallel, same allSettled pattern as
  // scanner/runScan.js — one failing check (e.g. OSV.dev is down) doesn't
  // kill the other two.
  const results = await Promise.allSettled([
    dependencyCheck(packageJsonFiles),
    exposedEnvCheck(fileTree),
    secretScanCheck(fileContents),
  ]);

  const rawFindings = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  // Step 5: score + OWASP-map + attach remediation — the EXACT SAME
  // function scanner/runScan.js uses for website findings. This is the
  // payoff of keeping every check's output in the same {checkId, title,
  // description, severity, evidence} shape: this whole layer needed zero
  // changes to support a completely different kind of scan.
  const { score, severityCounts, findings } = scoreFindings(rawFindings);

  return { score, severityCounts, findings };
}
