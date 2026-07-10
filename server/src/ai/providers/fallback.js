import AIProvider from "../AIProvider.js";

// This provider needs NO API key and NEVER fails — it builds a readable
// explanation directly from data we already have, using a plain string
// template. It exists so the app always works end-to-end even before a
// real AI key is configured, and so a real provider's outage/rate-limit
// never breaks a scan (see ai/index.js, which falls back to this on error).
export default class FallbackProvider extends AIProvider {
  async explainCheck(check) {
    return (
      `${check.description} ` +
      `This falls under ${check.owasp}. Fix: resolve this on the server before it reaches production.`
    );
  }
}
