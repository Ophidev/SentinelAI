// Small wrapper around GitHub's REST API — every other file in this folder
// talks to GitHub only through these three functions, so if GitHub's API
// shape ever changes, this is the only file that needs updating.

// Every request includes this header if a token is configured. Without a
// token, GitHub still answers these same requests, just at a lower rate
// limit (60/hour instead of 5,000/hour) — see server/.env.example.
function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, "User-Agent": "SentinelAI" } : { "User-Agent": "SentinelAI" };
}

/**
 * Turns a GitHub URL like "https://github.com/Ophidev/FitFlow" into
 * { owner: "Ophidev", repo: "FitFlow" }. Throws on anything else, so a bad
 * URL fails fast with a clear message instead of a confusing API error later.
 */
export function parseRepoUrl(repoUrl) {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) {
    throw new Error("repoUrl must look like https://github.com/<owner>/<repo>");
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Returns a flat array of every file path in the repo's default branch
 * (main or master, whichever the repo actually uses — fetched dynamically
 * rather than assumed). Used to check "does a .env file exist" and to pick
 * which files to secret-scan, without downloading the whole repo.
 */
export async function getRepoFileTree(owner, repo) {
  // Step 1: find the default branch — assuming "main" would break on any
  // older repo that still uses "master" (or a custom branch name).
  const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: authHeaders(),
  });
  if (!repoInfoResponse.ok) {
    throw new Error(`GitHub repo lookup failed: ${repoInfoResponse.status}`);
  }
  const repoInfo = await repoInfoResponse.json();
  const defaultBranch = repoInfo.default_branch;

  // Step 2: fetch the full file tree for that branch in ONE request
  // (?recursive=1) instead of walking directories one by one.
  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers: authHeaders() }
  );
  if (!treeResponse.ok) {
    throw new Error(`GitHub tree fetch failed: ${treeResponse.status}`);
  }
  const treeData = await treeResponse.json();

  // Only "blob" entries are files — "tree" entries are folders themselves.
  return treeData.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path);
}

/**
 * Fetches and decodes ONE file's text content from a repo. GitHub's
 * contents API returns file bodies as base64, which we decode here so
 * every caller just gets a plain string.
 */
export async function getFileContent(owner, repo, path) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`GitHub file fetch failed for ${path}: ${response.status}`);
  }
  const data = await response.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}
