import rateLimit from "express-rate-limit";

// Limits how often a user can trigger scans. Without this, SentinelAI's
// "scan this URL" feature could be abused to hammer a third-party site with
// repeated requests through our server — effectively turning our own
// scanner into a denial-of-service tool. 10 scans per 10 minutes per IP is
// generous for a demo but still a real ceiling.
const scanRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many scans requested, please try again later" },
});

export default scanRateLimiter;
