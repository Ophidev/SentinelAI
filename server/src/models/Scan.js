import mongoose from "mongoose";

// One document per scan run against a Project. We keep the full findings
// list AND the AI explanation on the same document so History/Report pages
// can render everything from a single query, no joins needed.
const findingSchema = new mongoose.Schema(
  {
    checkId: String,
    title: String,
    description: String,
    severity: { type: String, enum: ["critical", "high", "medium", "low", "info"] },
    owasp: String,
    evidence: String,
    // Concrete fix text, looked up deterministically in scanner/remediationMap.js
    // — never AI-generated, so it's always correct and always present.
    remediation: String,
    // AI-generated "what could an attacker actually do with this" text —
    // see ai/index.js attachImpact(). Deliberately doesn't repeat title/
    // description/remediation, which all live elsewhere on this same object.
    impact: String,
  },
  { _id: false } // findings are embedded, they don't need their own id
);

const scanSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // "website" = the existing DAST-style scan (scanner/). "code" = the
    // new SAST-lite + SCA scan against a GitHub repo (codeScanner/).
    // Both produce findings in the exact same shape, so this field is the
    // ONLY thing that distinguishes them at the data level.
    type: {
      type: String,
      enum: ["website", "code"],
      default: "website",
    },

    status: {
      type: String,
      enum: ["completed", "failed"],
      // NOTE: for the v1 build the scan runs synchronously inside the
      // request (see scanController.js) so we only ever save it once it's
      // already finished — there's no "pending"/"running" state yet.
      // A future version would run this as a background job and add those
      // statuses back, with the client polling GET /scans/:id.
      default: "completed",
    },

    findings: [findingSchema],

    score: Number,

    severityCounts: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      info: { type: Number, default: 0 },
    },

    aiExplanation: String,

    error: String, // populated only when status === "failed"
  },
  { timestamps: true }
);

const Scan = mongoose.model("Scan", scanSchema);

export default Scan;
