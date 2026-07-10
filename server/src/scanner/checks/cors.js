// CORS (Cross-Origin Resource Sharing) headers tell the browser which OTHER
// websites are allowed to make requests to this site and read the response.
// The dangerous combination is:
//   Access-Control-Allow-Origin: *          (any website may call this API)
//   Access-Control-Allow-Credentials: true   (...and the browser should send cookies with it)
// Together, that means ANY site on the internet can make an authenticated
// request on behalf of a logged-in user and read the response — effectively
// bypassing the same-origin policy that's supposed to isolate sites from
// each other. Maps to OWASP A05:2021 - Security Misconfiguration.
export default async function corsCheck(url, context) {
  const findings = [];

  const allowOrigin = context.headers["access-control-allow-origin"];
  const allowCredentials = context.headers["access-control-allow-credentials"];

  if (allowOrigin === "*" && allowCredentials === "true") {
    findings.push({
      checkId: "cors-wildcard-with-credentials",
      title: "Dangerous CORS configuration: wildcard origin with credentials allowed",
      description:
        "This site sends 'Access-Control-Allow-Origin: *' together with " +
        "'Access-Control-Allow-Credentials: true'. Browsers normally block this exact " +
        "combination, but some proxies/older setups don't enforce it — and even when " +
        "blocked, it signals a misconfigured CORS policy that should be scoped to specific " +
        "trusted origins instead of '*'.",
      severity: "high",
      evidence: `Access-Control-Allow-Origin: ${allowOrigin}, Access-Control-Allow-Credentials: ${allowCredentials}`,
    });
  } else if (allowOrigin === "*") {
    findings.push({
      checkId: "cors-wildcard-origin",
      title: "CORS allows any origin",
      description:
        "'Access-Control-Allow-Origin: *' means any website can read responses from this " +
        "one via JavaScript. This is fine for a truly public API, but risky if the API " +
        "returns any user-specific or sensitive data.",
      severity: "low",
      evidence: `Access-Control-Allow-Origin: ${allowOrigin}`,
    });
  }

  return findings;
}
