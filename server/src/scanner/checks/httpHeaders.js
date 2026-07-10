// This check looks at the HTTP response headers a website sends back and
// flags well-known "security headers" that are missing. These headers don't
// stop an attack on their own, but they tell the BROWSER to enforce extra
// protection (e.g. "don't let this page be put in an iframe on another site").
// Missing them is one of the most common real-world findings — OWASP calls
// this class of issue "Security Misconfiguration" (A05:2021).

// Each entry: the header name to look for, what it protects against,
// and how severe we consider it missing.
const HEADER_RULES = [
  {
    header: "content-security-policy",
    checkId: "missing-csp",
    title: "Missing Content-Security-Policy header",
    description:
      "CSP tells the browser which sources of scripts/styles/images are allowed to load. " +
      "Without it, the site is more exposed to Cross-Site Scripting (XSS) attacks, because " +
      "the browser will happily run injected scripts from anywhere.",
    severity: "high",
  },
  {
    header: "x-frame-options",
    checkId: "missing-x-frame-options",
    title: "Missing X-Frame-Options header",
    description:
      "Without this header, the page can be embedded inside an <iframe> on another site, " +
      "enabling 'clickjacking' — tricking users into clicking something different from what they see.",
    severity: "medium",
  },
  {
    header: "x-content-type-options",
    checkId: "missing-x-content-type-options",
    title: "Missing X-Content-Type-Options header",
    description:
      "Without 'nosniff', some browsers try to guess a file's type instead of trusting the " +
      "declared Content-Type, which can be abused to run a malicious file as if it were a script.",
    severity: "low",
  },
  {
    header: "strict-transport-security",
    checkId: "missing-hsts",
    title: "Missing Strict-Transport-Security (HSTS) header",
    description:
      "HSTS tells browsers to only ever talk to this site over HTTPS, even if a user types " +
      "http:// or clicks an old http:// link. Without it, a first visit can be downgraded to " +
      "plain HTTP and intercepted.",
    severity: "medium",
  },
];

// `context.headers` is a plain object of lower-cased header-name -> value,
// built once in runScan.js so every check reads from the same fetch.
export default async function httpHeadersCheck(url, context) {
  const findings = [];

  for (const rule of HEADER_RULES) {
    const isPresent = Object.prototype.hasOwnProperty.call(context.headers, rule.header);

    if (!isPresent) {
      findings.push({
        checkId: rule.checkId,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        evidence: `Response did not include a "${rule.header}" header`,
      });
    }
  }

  return findings;
}
