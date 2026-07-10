import AIProvider from "../AIProvider.js";
import { sanitizeForPrompt } from "../promptSanitizer.js";

// Real adapter for Google's Gemini API. This is the ONLY file in the whole
// project that knows Gemini's specific request/response shape — if we ever
// swap to OpenAI or Ollama instead, only a new file like this one is added,
// nothing else in the app changes (that's the point of the AIProvider interface).
export default class GeminiProvider extends AIProvider {
  async explainCheck(check) {
    // Read the key fresh from process.env on every call (rather than once
    // at import time) so a key added/changed in .env is picked up the next
    // time the server restarts, without needing any other code changes.
    const apiKey = process.env.GEMINI_API_KEY;

    // Fail fast with a clear error if no key is configured — this error
    // is caught by ai/index.js, which then falls back to the template
    // provider, so a missing key never breaks a scan for the user.
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    // Build the actual text we send to the model — see buildPrompt() below.
    const prompt = buildPrompt(check);

    // fetch() is Node's built-in HTTP client (Node 18+) — no extra HTTP
    // library dependency needed just to call one REST API.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Gemini's request shape: "contents" is an array of turns, each
          // turn has "parts" — we only ever send one turn with one text part.
          contents: [{ parts: [{ text: prompt }] }],
          // Caps the OUTPUT side of token usage — without this, the model
          // can ramble and cost more output tokens than the explanation
          // actually needs. Input tokens are kept small by only sending
          // one short finding (see buildPrompt), not a whole scan's worth.
          generationConfig: { maxOutputTokens: 200 },
        }),
        // Give up after 15s rather than hang the whole scan request if
        // Gemini is slow/unresponsive — ai/index.js treats a timeout the
        // same as any other failure and falls back to the template provider.
        signal: AbortSignal.timeout(15_000),
      }
    );

    // Gemini returns a non-2xx status (e.g. 429 quota, 503 overloaded) as a
    // normal HTTP response, not a thrown error — fetch() only throws on
    // network-level failures, so we have to check response.ok ourselves.
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Optional chaining (?.) walks down this deeply nested response shape
    // and returns undefined at the first missing piece, instead of
    // throwing a "cannot read property of undefined" error.
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Belt-and-suspenders: even a 200 OK response could theoretically come
    // back with no usable text (e.g. the model refused to answer) — treat
    // that the same as any other failure so the fallback provider kicks in.
    if (!text) {
      throw new Error("Gemini API returned no explanation text");
    }

    // NOTE: the raw text returned here still gets passed through
    // sanitizeAiOutput() in ai/index.js before it's cached or shown to a
    // user — this file's job is only to talk to Gemini, not to decide
    // whether its response is safe to display (see outputSanitizer.js).
    return text;
  }
}

// One short, fixed prompt about ONE finding TYPE — not a whole scan's
// worth of findings, and NOT this specific scan's raw evidence. Small
// input = fewer input tokens, and because this result gets cached by
// checkId (see ai/index.js), most scans never call this function at all.
function buildPrompt(check) {
  // check.title and check.description are text WE wrote ourselves in
  // scanner/checks/*.js — not attacker-controlled today. We still run them
  // through sanitizeForPrompt() as defense-in-depth: if a future check is
  // ever added whose title/description is built dynamically from scanned
  // content instead of a hand-written string, this line means that risk is
  // already covered without anyone needing to remember to add it later.
  const safeTitle = sanitizeForPrompt(check.title);
  const safeDescription = sanitizeForPrompt(check.description);

  // Deliberately NOT included: check.evidence. Evidence (a specific cookie
  // value, a specific header value) is (a) attacker-influenced, since it
  // comes straight from the website we scanned, and (b) different on every
  // scan of the same checkId — including it here would poison the cache in
  // ai/index.js, which assumes one checkId always maps to one reusable
  // explanation. Evidence is shown to the user separately, straight from
  // our own deterministic code (see scanner/checks/*.js), never through
  // the AI at all.
  return (
    "Explain this website security finding to a junior developer, in plain English, " +
    "in 2-3 short sentences. Then add one line starting with 'Fix:' giving a concrete fix. " +
    "Do not invent extra findings — only explain the one below.\n\n" +
    `Issue: ${safeTitle}\n` +
    `Severity: ${check.severity}\n` +
    `OWASP category: ${check.owasp}\n` +
    `Technical detail: ${safeDescription}`
  );
}
