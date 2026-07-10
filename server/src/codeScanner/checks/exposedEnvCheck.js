// A very common, very real finding: a real .env file (which usually holds
// database passwords, API keys, JWT secrets — everything this whole app's
// security depends on) committed directly into git history, instead of
// being gitignored. This check only needs the repo's file list, not file
// contents, so it's the cheapest of the three code-scan checks.
export default async function exposedEnvCheck(fileTree) {
  const findings = [];

  // Match ".env" or a nested "something/.env", but deliberately NOT
  // ".env.example", ".env.sample", or ".env.template" — those are meant to
  // be committed (they document which variables exist, with no real values).
  const envFiles = fileTree.filter((path) => /(^|\/)\.env$/.test(path));

  for (const path of envFiles) {
    findings.push({
      checkId: "exposed-env-file",
      title: `Committed .env file found: ${path}`,
      description:
        "A real .env file (not .env.example) is committed to this repository. Anyone with read " +
        "access to the repo — including its full git history, even after the file is later " +
        "deleted — can see every secret it ever contained.",
      severity: "critical",
      evidence: path,
    });
  }

  return findings;
}
