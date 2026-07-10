import express from "express";
import protect from "../middleware/authMiddleware.js";
import scanRateLimiter from "../middleware/scanRateLimiter.js";
import { createScan, createCodeScan, getScansForProject, getScanById } from "../controllers/scanController.js";

const router = express.Router();

// Website (DAST) scans: POST/GET /api/projects/:projectId/scans
router.post("/projects/:projectId/scans", protect, scanRateLimiter, createScan);
router.get("/projects/:projectId/scans", protect, getScansForProject);

// Code (SAST-lite + SCA) scans against a GitHub repo — same rate limiter,
// since this also makes outbound requests on the user's behalf (to GitHub
// and OSV.dev) and should be protected from abuse the same way.
router.post("/projects/:projectId/codescans", protect, scanRateLimiter, createCodeScan);
// Reuses getScansForProject with ?type=code — see scanController.js.
router.get("/projects/:projectId/codescans", protect, (req, res) => {
  req.query.type = "code";
  return getScansForProject(req, res);
});

// Standalone: GET /api/scans/:id
router.get("/scans/:id", protect, getScanById);

export default router;
