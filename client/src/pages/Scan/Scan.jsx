import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { triggerScan } from "../../services/scans.api";

const SEVERITY_COLOR = {
  critical: "text-red-500",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
  info: "text-gray-400",
};

function Scan() {
  // :projectId comes from the route path /projects/:projectId/scan
  const { projectId } = useParams();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleScan = async () => {
    setError("");
    setLoading(true);
    setScan(null);
    try {
      // This call blocks until the scan is fully done (backend runs it
      // synchronously) — see server/src/controllers/scanController.js.
      const data = await triggerScan(projectId);
      setScan(data.scan);
    } catch (err) {
      setError(err.response?.data?.message || "Scan failed to start");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between">
          <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">
            &larr; Back to Projects
          </Link>
          <Link to={`/projects/${projectId}/history`} className="text-sm text-blue-400 hover:text-blue-300">
            View History
          </Link>
        </div>

        <button
          onClick={handleScan}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Scanning... (this can take a few seconds)" : "Run Scan"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {scan && scan.status === "failed" && (
          <p className="text-red-400">Scan failed: {scan.error}</p>
        )}

        {scan && scan.status === "completed" && (
          <div className="space-y-4">
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-3xl font-bold">{scan.score}/100</p>
              <p className="text-sm text-gray-400">Security Score</p>
            </div>

            <div className="space-y-2">
              <h2 className="font-semibold">Findings ({scan.findings.length})</h2>
              {scan.findings.length === 0 && (
                <p className="text-gray-400">No issues found by this scan.</p>
              )}
              {scan.findings.map((finding, i) => (
                <div key={i} className="bg-gray-900 p-4 rounded-lg">
                  <p className={`font-medium ${SEVERITY_COLOR[finding.severity]}`}>
                    [{finding.severity.toUpperCase()}] {finding.title}
                  </p>
                  <p className="text-sm text-gray-400">{finding.owasp}</p>
                  <p className="text-sm mt-1">{finding.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h2 className="font-semibold mb-2">AI Explanation</h2>
              {/* aiExplanation is markdown text from server/src/ai — rendered
                  as plain text here to keep this build simple; a markdown
                  renderer (e.g. react-markdown) would be the next upgrade. */}
              <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">
                {scan.aiExplanation}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Scan;
