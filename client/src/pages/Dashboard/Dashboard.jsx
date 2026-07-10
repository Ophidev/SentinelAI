import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProjects, createProject } from "../../services/projects.api";
import { getDashboardSummary } from "../../services/dashboard.api";
import { useAuth } from "../../context/AuthContext";

// This page doubles as the "Projects" list AND the account-wide dashboard
// (stats row at the top) — the user's home base after login. Kept as one
// page instead of splitting Dashboard/Projects because with only one
// entity type (Project) today, a separate page would just duplicate this
// list — see docs/LLD.md for a fuller Dashboard planned for later.
function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();

  // Fetch the user's projects AND the account-wide summary once when the
  // page first renders. Two independent requests — neither depends on the
  // other's result, so no need to chain them.
  useEffect(() => {
    listProjects()
      .then((data) => setProjects(data.projects))
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));

    getDashboardSummary()
      .then((data) => setSummary(data.summary))
      .catch(() => {
        // Non-critical — the page still works fine without the stats row.
      });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await createProject(name, url);
      // Prepend the new project instead of re-fetching the whole list.
      setProjects((prev) => [data.project, ...prev]);
      setName("");
      setUrl("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-white">
            Logout
          </button>
        </div>

        {summary && (
          <div className="grid grid-cols-4 gap-3">
            <StatTile label="Projects" value={summary.totalProjects} />
            <StatTile label="Scans" value={summary.totalScans} />
            <StatTile label="Avg Score" value={summary.averageScore ?? "-"} />
            <StatTile
              label="High/Critical"
              value={summary.severityCounts.critical + summary.severityCounts.high}
            />
          </div>
        )}

        <form onSubmit={handleCreate} className="bg-gray-900 p-4 rounded-lg space-y-3">
          <h2 className="font-semibold">Add a project to scan</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <input
            type="text"
            placeholder="Project name (e.g. My Portfolio)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
          />
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
          />
          <button type="submit" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700">
            Add Project
          </button>
        </form>

        <div className="space-y-2">
          <h2 className="font-semibold">Your Projects</h2>
          {loading && <p className="text-gray-400">Loading...</p>}
          {!loading && projects.length === 0 && (
            <p className="text-gray-400">No projects yet — add one above to run your first scan.</p>
          )}
          {projects.map((project) => (
            <Link
              key={project._id}
              to={`/projects/${project._id}/scan`}
              className="block bg-gray-900 hover:bg-gray-800 p-4 rounded-lg"
            >
              <p className="font-medium">{project.name}</p>
              <p className="text-sm text-gray-400">{project.url}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Small reusable stat box — kept in this file since it's only used here.
function StatTile({ label, value }) {
  return (
    <div className="bg-gray-900 p-3 rounded-lg text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

export default Dashboard;
