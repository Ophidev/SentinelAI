import Project from "../models/Project.js";
import Scan from "../models/Scan.js";
import runScan from "../scanner/runScan.js";
import generateExplanation from "../ai/index.js";

// Triggers a scan and returns the finished result in one request.
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
        status: "failed",
        error: scanError.message,
      });
      return res.status(200).json({ success: true, scan: failedScan });
    }

    const { score, severityCounts, findings } = scanResult;

    // AI call happens ONCE, after scoring is already final — see ai/index.js.
    const aiExplanation = await generateExplanation(findings, { score, severityCounts });

    const scan = await Scan.create({
      project: project._id,
      status: "completed",
      score,
      severityCounts,
      findings,
      aiExplanation,
    });

    res.status(201).json({ success: true, scan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Lists all past scans for a project, newest first — powers the History view.
export const getScansForProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const scans = await Scan.find({ project: project._id }).sort({ createdAt: -1 });

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
