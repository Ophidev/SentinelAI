import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import scanRoutes from "./routes/scanRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

const allowedOrigins = [
  process.env.DEV_FRONTEND_URL,
  process.env.PROD_FRONTEND_URL,

].filter(Boolean);

// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
// scanRoutes defines its own full paths (/projects/:projectId/scans and /scans/:id),
// so it's mounted at /api directly rather than nested under one fixed prefix.
app.use("/api", scanRoutes);
app.use("/api/dashboard", dashboardRoutes);
// Deliberately mounted with NO auth middleware — see badgeController.js.

// Health Check Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to SentinelAI Backend 🚀",
    version: "1.0.0",
  });
});

export default app;
