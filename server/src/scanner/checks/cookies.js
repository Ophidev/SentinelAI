// This check inspects any cookies the site set (via the Set-Cookie response
// header) and flags missing security flags on them. Cookies often carry
// session tokens, so a poorly-flagged cookie is a direct path to session
// hijacking. Maps to OWASP A05:2021 - Security Misconfiguration.
export default async function cookiesCheck(url, context) {
  const findings = [];

  // context.setCookieHeaders is an array of raw "Set-Cookie" header strings,
  // e.g. ["session=abc123; Path=/", "theme=dark; Secure; HttpOnly; SameSite=Strict"]
  const cookies = context.setCookieHeaders || [];

  if (cookies.length === 0) {
    // No cookies set at all — nothing to check, and nothing wrong either.
    return findings;
  }

  for (const rawCookie of cookies) {
    const cookieName = rawCookie.split("=")[0].trim();
    const lower = rawCookie.toLowerCase();

    if (!lower.includes("secure")) {
      findings.push({
        checkId: "cookie-missing-secure",
        title: `Cookie "${cookieName}" missing Secure flag`,
        description:
          "Without 'Secure', this cookie can be sent over an unencrypted HTTP connection, " +
          "exposing it to interception even on a site that otherwise supports HTTPS.",
        severity: "medium",
        evidence: rawCookie,
      });
    }

    if (!lower.includes("httponly")) {
      findings.push({
        checkId: "cookie-missing-httponly",
        title: `Cookie "${cookieName}" missing HttpOnly flag`,
        description:
          "Without 'HttpOnly', client-side JavaScript can read this cookie's value. If the " +
          "site has any XSS flaw, an attacker's injected script could steal this cookie " +
          "(e.g. a session token) directly.",
        severity: "high",
        evidence: rawCookie,
      });
    }

    if (!lower.includes("samesite")) {
      findings.push({
        checkId: "cookie-missing-samesite",
        title: `Cookie "${cookieName}" missing SameSite attribute`,
        description:
          "Without 'SameSite', this cookie is sent along with requests that originate from " +
          "other websites, which is what makes Cross-Site Request Forgery (CSRF) attacks possible.",
        severity: "medium",
        evidence: rawCookie,
      });
    }
  }

  return findings;
}
