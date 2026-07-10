// This is an "interface" — in plain JS there's no `interface` keyword like
// in TypeScript, so we express it as a base class whose method just throws.
// Every real provider (Gemini, OpenAI, Ollama, fallback) extends this and
// implements `explainCheck()`. The rest of the app only ever talks to THIS
// shape, never to a specific provider's SDK directly — that's what makes
// swapping providers later a one-line change instead of a rewrite.
//
// Note this asks about ONE finding TYPE at a time (identified by checkId),
// not a whole scan's worth of findings. That's deliberate — see ai/index.js
// for why: it's what makes caching by checkId possible.
export default class AIProvider {
  /**
   * @param {Object} check - { checkId, title, description, severity, owasp }
   * @returns {Promise<string>} short explanation + fix, for this ONE issue type
   */
  async explainCheck(check) {
    throw new Error("explainCheck() not implemented by this provider");
  }
}
