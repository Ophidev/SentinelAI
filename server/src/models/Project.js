import mongoose from "mongoose";

// A "Project" is one website a user wants to keep scanning over time.
// e.g. { name: "My Portfolio", url: "https://ayush.dev" }
// All scans belong to a project, so history/trends are grouped per-website.
const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",       // lets us .populate("owner") later if needed
      required: true,
      index: true,        // we always query projects by owner ("list my projects")
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional — a GitHub repo URL for this project's SOURCE code, separate
    // from `url` (the deployed website). A project can have a website scan,
    // a code scan, both, or neither — this is why it's not `required`.
    repoUrl: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt automatically
  }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
