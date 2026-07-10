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
 * Builds the full AI explanation section for a scan's findings.
 * findings: scored findings for THIS scan — already carry a `remediation`
 *   field attached deterministically in scanner/scoring.js, no AI involved
 *   in that part at all.
 * summary: { score, severityCounts }
 */
export default async function generateExplanation(findings, summary) {
  // A clean scan has nothing to explain — skip the whole AI/cache pipeline
  // entirely and return a short, hand-written summary instead.
  if (findings.length === 0) {
    return `## Summary\nNo issues were found. Score: **${summary.score}/100**.`;
  }

  // De-duplicate: if this one scan found the same checkId twice (e.g. two
  // cookies both missing HttpOnly), we only need the AI's impact statement
  // for that TYPE once and reuse it for both findings below — another
  // small token saving, on top of the cache itself.
  // impactByCheckId ends up as e.g. { "missing-csp": "...", "cookie-missing-httponly": "..." }
  const impactByCheckId = {};
  for (const finding of findings) {
    if (!impactByCheckId[finding.checkId]) {
      impactByCheckId[finding.checkId] = await explainOneCheck(finding);
    }
  }

  return buildReport(findings, summary, impactByCheckId);
}

// Plain string formatting — NO AI involved here at all. The AI's only job
// (via explainOneCheck above) is producing the per-checkId IMPACT text;
// everything else — grouping by severity, and pulling in each finding's
// deterministic `remediation` field — is ordinary, hand-written code.
function buildReport(findings, summary, impactByCheckId) {
  // Bucket every finding by its severity so the report can show CRITICAL
  // issues before LOW ones, regardless of the order checks ran in.
  const bySeverity = { critical: [], high: [], medium: [], low: [] };
  for (const finding of findings) {
    // If a finding somehow has an unrecognized severity, fall back to the
    // "low" bucket rather than throwing — a display bug should never be
    // able to break the whole report.
    (bySeverity[finding.severity] || bySeverity.low).push(finding);
  }

  let markdown = `## Summary\nThis scan found **${findings.length} issue(s)**. Score: **${summary.score}/100**.\n\n`;

  // Object.entries() preserves the insertion order of bySeverity above, so
  // this loop naturally prints critical -> high -> medium -> low.
  for (const [severity, group] of Object.entries(bySeverity)) {
    // Skip severities with zero findings instead of printing an empty
    // "### HIGH (0)" section.
    if (group.length === 0) continue;

    markdown += `### ${severity.toUpperCase()} (${group.length})\n`;
    for (const finding of group) {
      // Three distinct pieces of information, from three distinct
      // sources, laid out separately so nothing is repeated twice:
      //   - finding.title / finding.owasp -> our own deterministic checks
      //   - impactByCheckId[...]          -> the AI's "why it matters"
      //   - finding.remediation           -> our own deterministic fix table
      markdown +=
        `- **${finding.title}** (${finding.owasp})\n` +
        `  *Impact:* ${impactByCheckId[finding.checkId]}\n` +
        `  *Recommended fix:* ${finding.remediation}\n`;
    }
    markdown += "\n";
  }

  return markdown;
}
