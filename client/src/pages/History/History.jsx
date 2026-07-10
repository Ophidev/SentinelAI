import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { listScans } from "../../services/scans.api";
import Header from "../../components/layout/Header";
import { Card, CardBody } from "../../components/ui/Card";

// Reuses the same score-color banding as Scan.jsx — kept as a small local
// copy rather than a shared import, since this is the only other place a
// raw score number is displayed on its own.
function scoreColor(score) {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-500";
}

// Shows every past scan for ONE project, newest first — lets a user see
// whether their score is improving or getting worse over time.
function History() {
  const { projectId } = useParams();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listScans(projectId)
      .then((data) => setScans(data.scans))
      .catch(() => setError("Failed to load scan history"))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header
        right={
          <Link to={`/projects/${projectId}/scan`} className="text-sm text-zinc-500 hover:text-zinc-200">
            Back to scan
          </Link>
        }
      />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <h1 className="text-sm font-semibold text-zinc-400">Scan history</h1>

        {loading && <p className="text-sm text-zinc-500">Loading...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && scans.length === 0 && (
          <Card>
            <CardBody className="text-sm text-zinc-500">No scans yet for this project.</CardBody>
          </Card>
        )}

        <div className="space-y-2">
          {scans.map((scan) => (
            <Card key={scan._id}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">{new Date(scan.createdAt).toLocaleString()}</p>
                  {scan.status === "failed" ? (
                    <p className="mt-0.5 text-sm text-red-400">Failed: {scan.error}</p>
                  ) : (
                    <p className="mt-0.5 text-sm text-zinc-300">{scan.findings.length} finding(s)</p>
                  )}
                </div>

                {scan.status === "completed" && (
                  <p className={`text-2xl font-semibold tabular-nums ${scoreColor(scan.score)}`}>
                    {scan.score}
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

export default History;
