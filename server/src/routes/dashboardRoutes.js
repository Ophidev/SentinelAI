import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/summary", protect, getDashboardSummary);

export default router;
