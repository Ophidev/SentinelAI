// This file is a lookup table, exactly like owaspMap.js next to it: for a
// given checkId, what is the CONCRETE, CORRECT fix?
//
// WHY THIS IS HAND-WRITTEN CODE AND NOT AN AI CALL:
// The fix for "missing-hsts" is always the same header, with the same
// syntax, every single time — it never depends on which website was
// scanned. Letting an AI model freely generate this kind of exact
// configuration syntax on every request would mean: (a) paying for
// something that never changes, and (b) risking the model getting the
// syntax subtly wrong (e.g. a typo'd header name), which matters a lot
// more for a REMEDIATION step than it does for an explanation. So the
// fix itself lives here, in code we wrote and can review/test — the AI's
// job (see ai/index.js) is only to explain WHY it matters, never to
// invent HOW to fix it.
const REMEDIATION_MAP = {
  "missing-csp":
    "Add a Content-Security-Policy header, e.g. `Content-Security-Policy: default-src 'self'` — start restrictive and only loosen it for sources you actually trust.",
  "missing-x-frame-options":
    "Add `X-Frame-Options: DENY` (or `SAMEORIGIN` if you intentionally embed your own pages in a frame).",
  "missing-x-content-type-options":
    "Add `X-Content-Type-Options: nosniff` to every response.",
  "missing-hsts":
    "Add `Strict-Transport-Security: max-age=63072000; includeSubDomains` once every subdomain is confirmed to support HTTPS.",
  "not-using-https":
    "Obtain a TLS certificate (e.g. via Let's Encrypt) and redirect all HTTP traffic to HTTPS at the server or load-balancer level.",
  "cookie-missing-secure":
    "Add the `Secure` attribute to this cookie so it is only ever sent over an HTTPS connection.",
  "cookie-missing-httponly":
    "Add the `HttpOnly` attribute to this cookie so client-side JavaScript cannot read its value.",
  "cookie-missing-samesite":
    "Add `SameSite=Strict` (or `Lax` if the cookie must survive cross-site link navigation) to this cookie.",
  "cors-wildcard-with-credentials":
    "Replace `Access-Control-Allow-Origin: *` with an explicit allow-list of trusted origins — `*` combined with credentials is never safe.",
  "cors-wildcard-origin":
    "Restrict `Access-Control-Allow-Origin` to the specific origins that actually need access, instead of `*`.",
};

// Same pattern as mapToOwasp() in owaspMap.js: look up by checkId, and fall
// back to a generic message for any checkId this table doesn't know about
// yet (e.g. a brand-new check someone adds later, before its remediation
// text has been written).
export function getRemediation(checkId) {
  return REMEDIATION_MAP[checkId] || "Review this finding manually — no automated fix is defined yet.";
}
