// This check is intentionally simple: is the site even using HTTPS?
// If a website is served over plain HTTP, everything sent between the user's
// browser and the server — passwords, cookies, form data — travels in clear
// text and can be read or modified by anyone on the network path
// (public Wi-Fi, a compromised router, an ISP). OWASP files this under
// A02:2021 - Cryptographic Failures.
export default async function httpsCheck(url, context) {
  const findings = [];

  const parsed = new URL(url);

  if (parsed.protocol !== "https:") {
    findings.push({
      checkId: "not-using-https",
      title: "Site is not served over HTTPS",
      description:
        "This site was reached over plain HTTP. All traffic (including any login form " +
        "submissions) can be intercepted or tampered with in transit. Every production site " +
        "should redirect http:// to https:// and use a valid TLS certificate.",
      severity: "critical",
      evidence: `URL scheme is "${parsed.protocol.replace(":", "")}"`,
    });
    return findings;
  }

  // If the site DID redirect us from http -> https, `context.finalUrl` (set in runScan.js)
  // will differ from the original http:// URL — that's actually the good case, no finding needed.

  return findings;
}
