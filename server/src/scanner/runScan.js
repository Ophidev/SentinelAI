import assertPublicUrl from "../utils/ssrfGuard.js";
import httpHeadersCheck from "./checks/httpHeaders.js";
import httpsCheck from "./checks/https.js";
import cookiesCheck from "./checks/cookies.js";
import corsCheck from "./checks/cors.js";
import { scoreFindings } from "./scoring.js";

// Every check function goes in this list. Adding a new check later means:
// 1. write checks/newCheck.js  2. import it  3. add it here. Nothing else changes.
const CHECKS = [httpHeadersCheck, httpsCheck, cookiesCheck, corsCheck];

/**
 * Runs a full scan against `url` and returns the scored result.
 * This function has NO Express/DB dependency — it's a plain async function,
 * which means it can be unit tested or reused (e.g. in a CLI tool) without
 * needing a running server.
 */
export default async function runScan(url) {
  // Step 1: refuse to scan internal/private infrastructure (see ssrfGuard.js).
  const parsedUrl = await assertPublicUrl(url);

  // Step 2: fetch the target ONCE. Every check below reads from this same
  // response instead of each making its own request to the target site —
  // that's both faster and more polite to the site being scanned.
  const response = await fetch(parsedUrl.toString(), {
    redirect: "follow",
    signal: AbortSignal.timeout(10_000), // don't hang forever on a slow/dead site
  });

  // Headers come out of `fetch` as a case-insensitive Headers object;
  // normalize to a plain lower-cased object so checks can do simple lookups.
  const headers = {};
  for (const [key, value] of response.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  // fetch()'s Headers object collapses multiple Set-Cookie headers into one
  // string, so we use getSetCookie() (Node 18.14+) to get them individually.
  const setCookieHeaders =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];

  const context = {
    headers,
    setCookieHeaders,
    finalUrl: response.url, // where we ended up after following redirects
    status: response.status,
  };

  // Step 3: run every check in parallel. Promise.allSettled means if one
  // check throws (e.g. a bug, or an unexpected response shape), the others
  // still complete instead of the whole scan failing.
  const results = await Promise.allSettled(
    CHECKS.map((check) => check(parsedUrl.toString(), context))
  );

  const rawFindings = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  // Step 4: turn raw findings into a score + OWASP-tagged findings.
  const { score, severityCounts, findings } = scoreFindings(rawFindings);

  return { score, severityCounts, findings, finalUrl: context.finalUrl };
}
