import AIProvider from "../AIProvider.js";

// This provider needs NO API key and NEVER fails — it exists so the app
// always works end-to-end even before a real AI key is configured, and so
// a real provider's outage/rate-limit never breaks a scan (see ai/index.js,
// which falls back to this on any error from the real provider).
//
// Same rule as the Gemini prompt (see providers/gemini.js): this text must
// NOT repeat the finding's own description (already shown in the findings
// list on screen) and must NOT include a fix — the fix comes deterministically
// from scanner/remediationMap.js, not from either AI provider. This
// template's only job is a short, severity-appropriate statement of impact.
const IMPACT_BY_SEVERITY = {
  critical:
    "left unfixed, this is the kind of gap attackers actively scan the internet for, and it can often be exploited immediately with little further effort.",
  high:
    "an attacker who spots this can likely use it as a direct step toward compromising user data or user accounts.",
  medium:
    "on its own this is unlikely to fully compromise the site, but it removes a layer of defense an attacker would otherwise have to work around.",
  low:
    "this is a minor weakness by itself, but it's the kind of small gap that becomes more useful to an attacker once combined with something else.",
  info:
    "this doesn't directly expose a weakness, but it's still worth being aware of.",
};

export default class FallbackProvider extends AIProvider {
  async explainCheck(check) {
    // Look up a canned impact line for this severity, defaulting to "low"
    // if an unrecognized severity ever shows up (defensive, should never
    // actually happen given the fixed severity enum on the Scan model).
    const impact = IMPACT_BY_SEVERITY[check.severity] || IMPACT_BY_SEVERITY.low;

    // check.owasp is our own deterministic category label (see
    // scanner/owaspMap.js) — safe to interpolate directly, no external
    // input involved here at all.
    return `Under ${check.owasp}: ${impact}`;
  }
}
