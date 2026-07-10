import Project from "../models/Project.js";
import Scan from "../models/Scan.js";

// Same score-color banding used on the frontend (client/src/pages/Scan/Scan.jsx
// and History.jsx) — kept as its own copy here since this file has no
// reasonable way to share code with the client bundle, and the mapping is
// simple enough that duplicating it is clearer than adding a shared package
// just for four color thresholds.
function scoreColor(score) {
  if (score >= 90) return "#10b981"; // emerald
  if (score >= 70) return "#eab308"; // yellow
  if (score >= 40) return "#f97316"; // orange
  return "#ef4444"; // red
}

// Builds a small two-part SVG badge (label on the left, value on the right)
// in the same visual style as shields.io / GitHub Actions status badges —
// this is what makes it recognizable as "a badge" the moment someone sees
// it in a README, without needing any explanation.
function buildBadgeSvg(label, value, color) {
  // Rough width estimate based on character count — not pixel-perfect
  // kerning, but good enough for a small flat badge with a monospace-ish feel.
  const labelWidth = label.length * 7 + 10;
  const valueWidth = String(value).length * 7 + 20;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <rect width="${labelWidth}" height="20" fill="#3f3f46"/>
  <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
  <text x="${labelWidth / 2}" y="14" fill="#fff" font-family="Verdana,Geneva,sans-serif" font-size="11" text-anchor="middle">${label}</text>
  <text x="${labelWidth + valueWidth / 2}" y="14" fill="#fff" font-family="Verdana,Geneva,sans-serif" font-size="11" text-anchor="middle">${value}</text>
</svg>`;
}

/**
 * GET /api/projects/:id/badge.svg?type=website|code
 *
 * Deliberately has NO auth middleware — this route is meant to be embedded
 * in a public README (`![Security](.../badge.svg)`), which only works if
 * anyone's browser/GitHub's own servers can load it without a login. It
 * only ever reveals a score number and a color, never any finding detail,
 * which is the whole reason this is safe to expose publicly (see
 * docs/HLD.md / LLD.md for the fuller reasoning). A project's MongoDB
 * ObjectId is also not realistically guessable, so this doesn't expose an
 * enumerable "list of everyone's scores" either.
 */
export const getProjectBadge = async (req, res) => {
  res.set("Content-Type", "image/svg+xml");
  // The whole point of a badge is that it updates after every scan — an
  // aggressively cached image would show a stale score, defeating that.
  res.set("Cache-Control", "no-cache, max-age=0");

  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).send(buildBadgeSvg("security", "not found", "#9ca3af"));
    }

    const type = req.query.type === "code" ? "code" : "website";
    const typeFilter = type === "code" ? { type: "code" } : { type: { $ne: "code" } };

    const latestScan = await Scan.findOne({
      project: project._id,
      status: "completed",
      ...typeFilter,
    }).sort({ createdAt: -1 });

    const label = type === "code" ? "code security" : "security";

    if (!latestScan) {
      return res.status(200).send(buildBadgeSvg(label, "no scans yet", "#9ca3af"));
    }

    const svg = buildBadgeSvg(label, `${latestScan.score}/100`, scoreColor(latestScan.score));
    res.status(200).send(svg);
  } catch (error) {
    console.error(error);
    res.status(500).send(buildBadgeSvg("security", "error", "#9ca3af"));
  }
};
