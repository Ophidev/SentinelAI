import { mapToOwasp } from "./owaspMap.js";
import { getRemediation } from "./remediationMap.js";

// How much each severity level costs, out of a starting score of 100.
// These numbers are a judgment call, not a standard — documented here so
// they're easy to explain/defend and easy to tune later.
const SEVERITY_WEIGHTS = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

/**
 * Pure function: takes the raw list of findings a scan produced, and returns
 * a score + summary. No I/O, no DB, no network — easy to unit test with a
 * hand-written findings array.
 */
export function scoreFindings(findings) {
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  let deduction = 0;

  const findingsWithOwasp = findings.map((finding) => {
    severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
    deduction += SEVERITY_WEIGHTS[finding.severity] || 0;

    return {
      ...finding,
      owasp: mapToOwasp(finding.checkId),
      // Attached here, deterministically, from our own lookup table — every
      // finding always has a concrete fix available even if the AI layer
      // (ai/index.js) is slow, rate-limited, or fails entirely.
      remediation: getRemediation(finding.checkId),
    };
  });

  // Score can't go below 0, and a site with zero findings should score 100.
  const score = Math.max(0, 100 - deduction);

  return {
    score,
    severityCounts,
    findings: findingsWithOwasp,
  };
}
