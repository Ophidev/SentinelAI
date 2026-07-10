import Project from "../models/Project.js";
import Scan from "../models/Scan.js";

// Aggregates stats across ALL of the logged-in user's projects — this is
// what powers the "Dashboard" view (as opposed to a single project's page).
export const getDashboardSummary = async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user._id });
    const projectIds = projects.map((project) => project._id);

    const scans = await Scan.find({ project: { $in: projectIds } });
    const completedScans = scans.filter((scan) => scan.status === "completed");

    const averageScore =
      completedScans.length === 0
        ? null
        : Math.round(
            completedScans.reduce((sum, scan) => sum + scan.score, 0) / completedScans.length
          );

    // Sum up severity counts across every scan, so the dashboard can show
    // "12 high, 3 critical" etc. across the user's whole account, not just
    // one project.
    const totalSeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const scan of completedScans) {
      for (const severity of Object.keys(totalSeverityCounts)) {
        totalSeverityCounts[severity] += scan.severityCounts?.[severity] || 0;
      }
    }

    res.status(200).json({
      success: true,
      summary: {
        totalProjects: projects.length,
        totalScans: scans.length,
        averageScore,
        severityCounts: totalSeverityCounts,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
