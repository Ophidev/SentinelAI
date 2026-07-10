import dns from "node:dns/promises";
import net from "node:net";

// Why this file exists:
// SentinelAI lets a logged-in user tell the backend "go fetch this URL for me".
// Without a check like this, an attacker could enter an INTERNAL address
// (e.g. http://169.254.169.254/ which is the AWS metadata endpoint, or
// http://localhost:6379 which might be an internal Redis/Mongo instance)
// and use SentinelAI's server as a proxy to attack infrastructure it can
// reach but the attacker's own browser cannot. This is a real, well-known
// vulnerability class called SSRF (Server-Side Request Forgery) — OWASP A10:2021.

// Private / internal IP ranges we must refuse to scan.
// Each entry is [rangeStart, rangeEnd] as 32-bit integers, for fast lookup.
const BLOCKED_RANGES = [
  ["10.0.0.0", "10.255.255.255"],       // Private network (RFC1918)
  ["172.16.0.0", "172.31.255.255"],     // Private network (RFC1918)
  ["192.168.0.0", "192.168.255.255"],   // Private network (RFC1918)
  ["127.0.0.0", "127.255.255.255"],     // Loopback (localhost)
  ["169.254.0.0", "169.254.255.255"],   // Link-local (includes cloud metadata IP)
  ["0.0.0.0", "0.255.255.255"],         // "This network"
];

// Converts "192.168.1.1" into a single number so we can do simple range math.
function ipToLong(ip) {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isBlockedIPv4(ip) {
  const value = ipToLong(ip);
  return BLOCKED_RANGES.some(([start, end]) => {
    return value >= ipToLong(start) && value <= ipToLong(end);
  });
}

// IPv6 loopback (::1) and unique-local addresses (fc00::/7) are blocked too.
function isBlockedIPv6(ip) {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd");
}

/**
 * Throws if `urlString` points at localhost/private/internal infrastructure.
 * Call this BEFORE the scanner ever makes an HTTP request to a user-supplied URL.
 */
export default async function assertPublicUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  // Only allow the two protocols a "website" scan makes sense for.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are allowed");
  }

  // Resolve the hostname to actual IP address(es) — this is the important part.
  // Checking the hostname string alone is not enough because DNS can point
  // a normal-looking domain at an internal IP (a technique called "DNS rebinding").
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });

  for (const record of records) {
    if (net.isIPv4(record.address) && isBlockedIPv4(record.address)) {
      throw new Error(`Refusing to scan: ${url.hostname} resolves to a private/internal address`);
    }
    if (net.isIPv6(record.address) && isBlockedIPv6(record.address)) {
      throw new Error(`Refusing to scan: ${url.hostname} resolves to a private/internal address`);
    }
  }

  return url;
}
