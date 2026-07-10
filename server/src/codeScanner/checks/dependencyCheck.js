// This check is real Software Composition Analysis (SCA) — the same
// underlying technique `npm audit` uses: take a project's dependency list
// and ask a vulnerability database whether any of them have a known CVE.
//
// OSV.dev (Open Source Vulnerabilities) is a free, public, no-API-key-
// required database maintained by Google/the open-source community — see
// https://osv.dev. We batch every dependency into ONE request rather than
// one request per package, since OSV's API supports batching and that's
// far kinder to a free public service than 50 separate requests.
//
// @param packageJsonFiles - [{ path: "Backend/package.json", content: {...parsed...} }, ...]
//   A repo can have MORE THAN ONE package.json — e.g. a monorepo with
//   separate Frontend/ and Backend/ folders (exactly this project's own
//   layout, and FitFlow's). Checking only the root package.json would
//   silently miss every real dependency in a repo laid out that way, so
//   runCodeScan.js finds every package.json in the repo and this function
//   checks all of them, one OSV.dev call per file.
export default async function dependencyCheck(packageJsonFiles) {
  const findings = [];

  for (const { path, content: packageJson } of packageJsonFiles) {
    // Merge dependencies + devDependencies into one flat list of {name, version}.
    const dependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    const packageNames = Object.keys(dependencies);
    if (packageNames.length === 0) continue;

    // OSV's batch query format: one "query" object per package, each with
    // the package name/ecosystem and the version currently in use.
    const queries = packageNames.map((name) => ({
      package: { name, ecosystem: "npm" },
      // Strip a leading ^ or ~ (e.g. "^4.18.2" -> "4.18.2") since OSV expects
      // an exact version, not a semver range.
      version: dependencies[name].replace(/^[~^]/, ""),
    }));

    const response = await fetch("https://api.osv.dev/v1/querybatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`OSV.dev API error: ${response.status}`);
    }

    const data = await response.json();

    // data.results is a parallel array to `queries` above — results[i]
    // corresponds to queries[i], so we zip them back together by index to
    // know WHICH package each vulnerability result belongs to.
    data.results.forEach((result, index) => {
      const vulns = result.vulns || [];
      if (vulns.length === 0) return; // this package has no known vulnerabilities

      const packageName = packageNames[index];
      const version = dependencies[packageName];
      // Collect just the advisory IDs (e.g. "GHSA-xxxx", "CVE-2023-...") —
      // short, and exactly what a developer needs to go look up the details.
      const advisoryIds = vulns.map((v) => v.id).join(", ");

      findings.push({
        checkId: "vulnerable-dependency",
        title: `Vulnerable dependency: ${packageName}@${version} (in ${path})`,
        description: `This package has ${vulns.length} known vulnerability record(s) in the OSV.dev database.`,
        // Any known CVE/advisory on a directly-used dependency is treated as
        // high severity by default — we don't have enough information here
        // to judge exploitability, so we don't understate the risk.
        severity: "high",
        evidence: advisoryIds,
      });
    });
  }

  return findings;
}
