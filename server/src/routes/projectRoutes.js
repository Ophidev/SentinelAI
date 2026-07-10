import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
} from "../controllers/projectController.js";

const router = express.Router();

// Every route here requires a valid JWT — "protect" runs first on all of them.
router.post("/", protect, createProject);
router.get("/", protect, getProjects);
router.get("/:id", protect, getProjectById);
router.delete("/:id", protect, deleteProject);

export default router;
