import express from "express";
import protect from "../middleware/authMiddleware.js";
import scanRateLimiter from "../middleware/scanRateLimiter.js";
import { createScan, getScansForProject, getScanById } from "../controllers/scanController.js";

const router = express.Router();

// Nested under a project: POST /api/projects/:projectId/scans
router.post("/projects/:projectId/scans", protect, scanRateLimiter, createScan);
router.get("/projects/:projectId/scans", protect, getScansForProject);

// Standalone: GET /api/scans/:id
router.get("/scans/:id", protect, getScanById);

export default router;
