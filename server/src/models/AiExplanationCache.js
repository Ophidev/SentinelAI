import mongoose from "mongoose";

// One row per unique finding TYPE (checkId), e.g. "missing-csp" or
// "cookie-missing-httponly" — NOT one row per scan. There are only ~10
// possible checkIds in the whole app (one per rule in scanner/checks/*.js),
// so this table can never grow past ~10 rows no matter how many scans run.
//
// This is the entire "token saving" mechanism: once we have cached an
// explanation for "missing-csp", every future scan on every website that
// finds a missing CSP header reuses this same row instead of calling the
// Gemini API again. See ai/index.js for where this gets read/written.
const aiExplanationCacheSchema = new mongoose.Schema(
  {
    checkId: {
      type: String,
      required: true,
      unique: true, // enforced at the DB level: never two rows for the same checkId
    },
    explanation: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const AiExplanationCache = mongoose.model("AiExplanationCache", aiExplanationCacheSchema);

export default AiExplanationCache;
