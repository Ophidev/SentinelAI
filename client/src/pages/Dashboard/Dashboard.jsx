import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProjects, createProject } from "../../services/projects.api";
import { getDashboardSummary } from "../../services/dashboard.api";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/layout/Header";
import { Card, CardBody } from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Label from "../../components/ui/Label";
import Button from "../../components/ui/Button";

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
  const [repoUrl, setRepoUrl] = useState("");
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
      const data = await createProject(name, url, repoUrl);
      // Prepend the new project instead of re-fetching the whole list.
      setProjects((prev) => [data.project, ...prev]);
      setName("");
      setUrl("");
      setRepoUrl("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header
        right={
          <>
            <span className="text-sm text-zinc-500">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Projects" value={summary.totalProjects} />
            <StatTile label="Scans" value={summary.totalScans} />
            <StatTile label="Avg Score" value={summary.averageScore ?? "—"} />
            <StatTile
              label="High / Critical"
              value={summary.severityCounts.critical + summary.severityCounts.high}
              accent={summary.severityCounts.critical + summary.severityCounts.high > 0}
            />
          </div>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">Add a project</h2>
          <Card>
            <CardBody>
              <form onSubmit={handleCreate} className="space-y-3">
                {error && (
                  <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {error}
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="My Portfolio"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="url">Website URL</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="repoUrl">GitHub repo URL (optional — enables code scanning)</Label>
                    <Input
                      id="repoUrl"
                      type="url"
                      placeholder="https://github.com/owner/repo"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                    />
                  </div>
                  <Button type="submit">Add project</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">Your projects</h2>

          {loading && <p className="text-sm text-zinc-500">Loading...</p>}
          {!loading && projects.length === 0 && (
            <Card>
              <CardBody className="text-center text-sm text-zinc-500">
                No projects yet — add one above to run your first scan.
              </CardBody>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <Link key={project._id} to={`/projects/${project._id}/scan`}>
                <Card className="transition-colors hover:border-zinc-700 hover:bg-zinc-900">
                  <CardBody className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-zinc-500">{project.url}</p>
                      {project.repoUrl && (
                        <p className="mt-0.5 text-xs text-zinc-600">📦 Code scanning enabled</p>
                      )}
                    </div>
                    <span className="text-zinc-600">→</span>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// Small reusable stat box — kept in this file since it's only used here.
// `accent` highlights the value in a warning color when it represents
// something that needs attention (e.g. a non-zero High/Critical count).
function StatTile({ label, value, accent = false }) {
  return (
    <Card>
      <CardBody>
        <p className={`text-2xl font-semibold ${accent ? "text-red-400" : "text-zinc-100"}`}>{value}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
      </CardBody>
    </Card>
  );
}

export default Dashboard;
