// Import the two AI providers — each implements the same explainCheck()
// method (see AIProvider.js), so this file can call either one without
// caring which one it's actually talking to.
import GeminiProvider from "./providers/gemini.js";
import FallbackProvider from "./providers/fallback.js";
// The Mongo model backing our checkId -> explanation cache (see its own
// file for why there can only ever be ~10 rows in this table).
import AiExplanationCache from "../models/AiExplanationCache.js";
// OWASP LLM02 defense — cleans whatever text an AI provider hands back
// before we ever store or display it. See outputSanitizer.js for why.
import { sanitizeAiOutput } from "./outputSanitizer.js";

// Create ONE instance of each provider when this module first loads, and
// reuse them for every call — there's no per-call state inside either
// class, so creating a new instance every time would just be wasted work.
const geminiProvider = new GeminiProvider();
const fallbackProvider = new FallbackProvider();

/**
 * Returns the AI-generated IMPACT statement for ONE finding type (checkId),
 * using the cache whenever possible. This text answers ONE question only:
 * "what could actually happen if this is left unfixed?" — not "what is
 * this?" (already shown via the finding's own title/description) and not
 * "how do I fix it?" (looked up deterministically in remediationMap.js,
 * see scoring.js). Splitting it this way means the AI call only ever
 * produces information the user doesn't already have elsewhere on the page.
 *
 * The cache trick itself is unchanged:
 *   1. Look up this checkId in the database first.
 *   2. If found -> return it immediately. No AI call, no tokens spent.
 *   3. If NOT found -> ask Gemini once, save the answer, then return it.
 *
 * Because there are only ~10 possible checkIds in the entire app (one per
 * rule in scanner/checks/*.js), this cache fills up almost immediately —
 * after the first handful of scans across ANY website, nearly every future
 * scan reuses cached text and makes zero AI calls.
 */
async function explainOneCheck(check) {
  // findOne() returns either a Mongoose document or null — never throws
  // just because nothing matched, so no try/catch needed for "not found".
  const cached = await AiExplanationCache.findOne({ checkId: check.checkId });

  if (cached) {
    // Logged so a cache HIT is visible in the server console while
    // demoing/testing — makes the token-saving behavior observable
    // instead of invisible.
    console.log(`[AI cache] HIT for "${check.checkId}" — reused, no AI call made`);
    return cached.explanation;
  }

  console.log(`[AI cache] MISS for "${check.checkId}" — calling AI provider`);

  let impactText;
  try {
    // Try the real provider first. If GEMINI_API_KEY is missing, or the
    // API call fails/times out/hits a quota limit, this throws and we
    // fall into the catch block below instead of crashing the scan.
    impactText = await geminiProvider.explainCheck(check);
  } catch (error) {
    console.warn(`AI provider failed for "${check.checkId}", using fallback:`, error.message);
    // The fallback provider needs no API key and cannot fail — it always
    // returns a usable string, so `impactText` is guaranteed to be set by
    // the time we reach the line below.
    impactText = await fallbackProvider.explainCheck(check);
  }

  // Whichever provider produced this text — real AI or our own template —
  // it passes through the same output sanitizer before we trust it enough
  // to store it. This is intentional: even our OWN fallback text is run
  // through this, so there is exactly one code path that decides "is this
  // safe to cache/display", not two slightly-different ones per provider.
  const safeImpactText = sanitizeAiOutput(impactText);

  // Save so this exact checkId never needs an AI call again — this write
  // only happens on a cache MISS, so the database only ever grows to the
  // number of distinct checkIds that have ever been seen (~10 max).
  await AiExplanationCache.create({ checkId: check.checkId, explanation: safeImpactText });

  return safeImpactText;
}

/**
 * Takes this scan's findings (already carrying `owasp` + `remediation` from
 * scoring.js) and returns a NEW array where every finding also carries
 * `impact` — the AI's answer to "what could an attacker do with this."
 *
 * Attaching impact directly onto each finding (instead of building one big
 * separate markdown blob) means the frontend can render ONE card per
 * finding with everything it needs — title, OWASP, severity, impact, and
 * fix — instead of that same information appearing twice: once per-finding
 * and once again in a giant AI-generated summary underneath.
 */
export async function attachImpact(findings) {
  // De-duplicate: if this one scan found the same checkId twice (e.g. two
  // cookies both missing HttpOnly), we only need the AI's impact statement
  // for that TYPE once and reuse it for both findings below — another
  // small token saving, on top of the cache itself.
  const impactByCheckId = {};

  const result = [];
  for (const finding of findings) {
    if (!impactByCheckId[finding.checkId]) {
      impactByCheckId[finding.checkId] = await explainOneCheck(finding);
    }
    result.push({ ...finding, impact: impactByCheckId[finding.checkId] });
  }
  return result;
}

/**
 * A short, ONE-line summary for the top of the scan result — score and
 * count only. Deliberately does not repeat any individual finding's
 * details, since those now live entirely on the findings themselves
 * (see attachImpact above). No AI involved — this is plain string formatting.
 */
export function buildSummary(findingCount, score) {
  if (findingCount === 0) {
    return `No issues were found. Score: ${score}/100.`;
  }
  return `This scan found ${findingCount} issue(s). Score: ${score}/100.`;
}
