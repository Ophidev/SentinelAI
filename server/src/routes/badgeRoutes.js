import express from "express";
import { getProjectBadge } from "../controllers/badgeController.js";

const router = express.Router();

// No `protect` middleware here — see the long comment in badgeController.js
// for why this route is intentionally public.
router.get("/projects/:id/badge.svg", getProjectBadge);

export default router;
