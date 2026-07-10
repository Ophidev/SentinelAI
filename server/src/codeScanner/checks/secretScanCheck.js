// Lightweight "SAST-lite" — this is NOT full static analysis (no AST, no
// data-flow tracing). It's a regex sweep over a bounded set of file
// contents looking for text that's SHAPED like a hardcoded credential —
// the same basic technique tools like git-secrets/truffleHog use for this
// specific check. Genuinely useful, genuinely simple, no false claim of
// being a full SAST engine.
const SECRET_PATTERNS = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "Private key header", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "Generic API key assignment",
    // Matches things like: apiKey = "sk_live_abcdef1234567890abcdef"
    // Requires a reasonably long quoted value so we don't flag short,
    // clearly-placeholder strings like "apiKey = 'changeme'".
    pattern: /(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
  },
];

/**
 * @param {Object} fileContents - { "path/to/file.js": "...file text..." }
 *   built once in runCodeScan.js from a bounded set of files, so this
 *   function never makes a network request itself — same "context built
 *   once, checks just read it" pattern as scanner/checks/*.js.
 */
export default async function secretScanCheck(fileContents) {
  const findings = [];

  for (const [path, content] of Object.entries(fileContents)) {
    for (const { name, pattern } of SECRET_PATTERNS) {
      const matches = content.match(pattern);
      if (!matches) continue;

      findings.push({
        checkId: "hardcoded-secret",
        title: `Possible hardcoded secret in ${path}`,
        description: `Found text matching the pattern "${name}". If this is a real credential, it is ` +
          `already exposed to anyone who can read this repository's history.`,
        severity: "critical",
        // We deliberately do NOT include the matched secret text itself in
        // the evidence — that would mean our own scan report becomes a
        // second place the leaked secret is stored in plain text.
        evidence: `${matches.length} match(es) of type "${name}" in ${path}`,
      });
    }
  }

  return findings;
}
