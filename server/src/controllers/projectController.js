import Project from "../models/Project.js";
import Scan from "../models/Scan.js";

// Create a new project (one website the user wants to track).
// req.user is set by the authMiddleware "protect" function after verifying the JWT.
export const createProject = async (req, res) => {
  try {
    const { name, url } = req.body;

    if (!name || !url) {
      return res.status(400).json({ success: false, message: "name and url are required" });
    }

    // Basic sanity check here; the deep SSRF check happens later, right before
    // we actually scan the URL (see scanController). We don't need the full
    // DNS-resolution guard just to *save* a project — only before fetching it.
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: "url must be a valid URL" });
    }

    const project = await Project.create({ owner: req.user._id, name, url });

    res.status(201).json({ success: true, project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// List all projects belonging to the logged-in user.
// We never let a user see another user's projects — always filter by owner.
export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, projects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get one project by id, plus its most recent scan (handy for a project detail page).
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });

    if (!project) {
      // Same 404 whether the project doesn't exist OR belongs to someone else —
      // this avoids leaking "that id exists but isn't yours" information.
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const latestScan = await Scan.findOne({ project: project._id }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, project, latestScan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Delete a project and all scans that belong to it (cascade delete).
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    await Scan.deleteMany({ project: project._id });

    res.status(200).json({ success: true, message: "Project deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
