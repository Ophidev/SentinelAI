import Project from "../models/Project.js";
import Scan from "../models/Scan.js";
import runScan from "../scanner/runScan.js";
import runCodeScan from "../codeScanner/runCodeScan.js";
import { attachImpact, buildSummary } from "../ai/index.js";

// Triggers a WEBSITE scan and returns the finished result in one request.
// A real scan only takes 1-3 seconds (one fetch + a few header checks), so
// running it synchronously keeps this build simple and easy to explain.
// (See Scan.js model comment: a background-job + polling version is the
// natural next step once scans get slower or more numerous.)
export const createScan = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    let scanResult;
    try {
      // runScan() does the SSRF check + fetch + all 4 checks + scoring.
      scanResult = await runScan(project.url);
    } catch (scanError) {
      // A failed scan (site down, SSRF blocked, DNS failure, etc.) is still
      // worth recording — it's useful history ("last 3 scans all failed").
      const failedScan = await Scan.create({
        project: project._id,
        type: "website",
        status: "failed",
        error: scanError.message,
      });
      return res.status(200).json({ success: true, scan: failedScan });
    }

    const { score, severityCounts, findings } = scanResult;

    // Attaches `impact` directly onto each finding (alongside the
    // `remediation` scoring.js already attached) — see ai/index.js for why
    // this replaced building one big separate markdown blob.
    const findingsWithImpact = await attachImpact(findings);

    // A short, one-line summary — no per-finding detail repeated here,
    // since that all now lives on each finding itself.
    const aiExplanation = buildSummary(findings.length, score);

    const scan = await Scan.create({
      project: project._id,
      type: "website",
      status: "completed",
      score,
      severityCounts,
      findings: findingsWithImpact,
      aiExplanation,
    });

    res.status(201).json({ success: true, scan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Triggers a CODE scan (SAST-lite + SCA against a GitHub repo). Mirrors
// createScan above almost exactly — same synchronous-request pattern, same
// AI impact-attachment step, same Scan model — the only real difference is
// which scanner runs (runCodeScan vs runScan) and which project field it
// reads (repoUrl vs url).
export const createCodeScan = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!project.repoUrl) {
      return res
        .status(400)
        .json({ success: false, message: "This project has no repoUrl set — add one before running a code scan" });
    }

    let scanResult;
    try {
      scanResult = await runCodeScan(project.repoUrl);
    } catch (scanError) {
      const failedScan = await Scan.create({
        project: project._id,
        type: "code",
        status: "failed",
        error: scanError.message,
      });
      return res.status(200).json({ success: true, scan: failedScan });
    }

    const { score, severityCounts, findings } = scanResult;
    const findingsWithImpact = await attachImpact(findings);
    const aiExplanation = buildSummary(findings.length, score);

    const scan = await Scan.create({
      project: project._id,
      type: "code",
      status: "completed",
      score,
      severityCounts,
      findings: findingsWithImpact,
      aiExplanation,
    });

    res.status(201).json({ success: true, scan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Lists all past scans for a project, newest first — powers the History view.
// `?type=code` returns code scans instead of website scans (default).
// Uses `type: { $ne: "code" }` rather than `type: "website"` for the
// default case so scans created BEFORE this field existed (which have no
// `type` stored at all) still show up as website scans instead of vanishing
// from history.
export const getScansForProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const typeFilter = req.query.type === "code" ? { type: "code" } : { type: { $ne: "code" } };

    const scans = await Scan.find({ project: project._id, ...typeFilter }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, scans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Gets a single scan by id. We check ownership via the parent project so a
// user can never fetch another user's scan just by guessing a scan id.
export const getScanById = async (req, res) => {
  try {
    const scan = await Scan.findById(req.params.id).populate("project");

    if (!scan || String(scan.project.owner) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: "Scan not found" });
    }

    res.status(200).json({ success: true, scan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
