// This file is a lookup table: "which OWASP Top 10 (2021) category does this
// finding belong to?". Keeping it separate from the checks themselves means
// we can re-map findings to a newer OWASP list in the future without
// touching any scanning logic — the checks just emit a checkId, and this
// table decides what that checkId "means" in security terms.
const OWASP_MAP = {
  "missing-csp": "A05:2021 - Security Misconfiguration",
  "missing-x-frame-options": "A05:2021 - Security Misconfiguration",
  "missing-x-content-type-options": "A05:2021 - Security Misconfiguration",
  "missing-hsts": "A02:2021 - Cryptographic Failures",
  "not-using-https": "A02:2021 - Cryptographic Failures",
  "cookie-missing-secure": "A05:2021 - Security Misconfiguration",
  "cookie-missing-httponly": "A05:2021 - Security Misconfiguration",
  "cookie-missing-samesite": "A01:2021 - Broken Access Control",
  "cors-wildcard-with-credentials": "A01:2021 - Broken Access Control",
  "cors-wildcard-origin": "A05:2021 - Security Misconfiguration",
};

export function mapToOwasp(checkId) {
  return OWASP_MAP[checkId] || "Uncategorized";
}
