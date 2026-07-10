import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { listScans } from "../../services/scans.api";

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
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link to={`/projects/${projectId}/scan`} className="text-sm text-gray-400 hover:text-white">
          &larr; Back to Scan
        </Link>

        <h1 className="text-2xl font-bold">Scan History</h1>

        {loading && <p className="text-gray-400">Loading...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && scans.length === 0 && (
          <p className="text-gray-400">No scans yet for this project.</p>
        )}

        <div className="space-y-2">
          {scans.map((scan) => (
            <div key={scan._id} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400">
                  {new Date(scan.createdAt).toLocaleString()}
                </p>
                {scan.status === "failed" ? (
                  <p className="text-red-400 text-sm">Failed: {scan.error}</p>
                ) : (
                  <p className="text-sm">{scan.findings.length} finding(s)</p>
                )}
              </div>

              {scan.status === "completed" && (
                <p className="text-2xl font-bold">{scan.score}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default History;
