// WHY THIS FILE EXISTS (OWASP LLM02 - Insecure Output Handling):
//
// We must never assume an AI response is automatically safe just because
// WE sent a careful, sanitized prompt (see promptSanitizer.js). The model
// itself could still produce something unsafe -- it might hallucinate
// markup, or an injection attempt might slip past our prompt-side defenses
// and cause the model to echo something dangerous back. "Insecure Output
// Handling" means treating an AI's response as trusted, safe text and
// rendering/storing it as-is. We don't do that here -- every AI response
// passes through sanitizeAiOutput() before it is cached or shown to a user.

// Matches anything that looks like an HTML tag, e.g. "<script>" or an
// "<img onerror=...>" attribute-based XSS payload. We never want AI output
// treated as HTML anywhere in this app, so tag-shaped text is stripped
// rather than trusted.
const HTML_TAG_PATTERN = /<[^>]*>/g;

// A hard ceiling on how long a stored explanation can be. This is
// independent of the `maxOutputTokens` limit already set on the Gemini
// request itself (see providers/gemini.js) -- this is "defense in depth":
// even if that request-level setting were ever removed, changed, or
// bypassed, this second, unrelated limit still caps what ends up in our
// database and on screen.
const MAX_LENGTH = 2000;

/**
 * Cleans text that came BACK from an AI provider (real or fallback) before
 * it is cached in AiExplanationCache or stored on a Scan document.
 */
export function sanitizeAiOutput(rawOutput) {
  // Guard against null/undefined, same reasoning as promptSanitizer.js --
  // callers always get back a safe, usable string.
  if (!rawOutput) {
    return "";
  }

  // Step 1: strip anything that looks like an HTML tag. Our frontend
  // already renders this text as plain text, never as raw HTML (see
  // client/src/pages/Scan/Scan.jsx, which puts it inside a <pre> tag rather
  // than using dangerouslySetInnerHTML) -- this is a SECOND, independent
  // layer of protection, so the safety of this text doesn't rely on the
  // frontend alone remembering to render it safely forever.
  let text = rawOutput.replace(HTML_TAG_PATTERN, "");

  // Step 2: enforce the absolute length ceiling described above.
  text = text.slice(0, MAX_LENGTH);

  // Step 3: trim any whitespace left over from the tag removal above.
  return text.trim();
}
