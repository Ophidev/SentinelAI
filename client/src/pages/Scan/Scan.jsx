import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { triggerScan } from "../../services/scans.api";
import Header from "../../components/layout/Header";
import { Card, CardBody } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

// Maps a finding's severity to the Badge "tone" prop (see Badge.jsx) — one
// place that decides how severity maps to color, reused everywhere a
// severity shows up on this page.
const SEVERITY_TONE = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
};

// A score of 85 and a score of 30 should not look the same at a glance —
// this buckets the score into a color so the number itself carries meaning
// before anyone reads a single finding.
function scoreColor(score) {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-500";
}

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header
        right={
          <>
            <Link to="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-200">
              Projects
            </Link>
            <Link to={`/projects/${projectId}/history`} className="text-sm text-zinc-500 hover:text-zinc-200">
              History
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Button onClick={handleScan} disabled={loading}>
          {loading ? "Scanning…" : "Run scan"}
        </Button>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {scan && scan.status === "failed" && (
          <Card>
            <CardBody className="text-sm text-red-400">Scan failed: {scan.error}</CardBody>
          </Card>
        )}

        {scan && scan.status === "completed" && (
          <div className="space-y-6">
            <Card>
              <CardBody className="flex items-center gap-6">
                <p className={`text-5xl font-bold tabular-nums ${scoreColor(scan.score)}`}>{scan.score}</p>
                <div>
                  <p className="text-sm font-medium text-zinc-300">Security score out of 100</p>
                  <p className="text-sm text-zinc-500">{scan.aiExplanation}</p>
                </div>
              </CardBody>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-400">
                Findings ({scan.findings.length})
              </h2>

              {scan.findings.length === 0 && (
                <Card>
                  <CardBody className="text-sm text-zinc-500">No issues found by this scan.</CardBody>
                </Card>
              )}

              <div className="space-y-3">
                {scan.findings.map((finding, i) => (
                  <Card key={i}>
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-zinc-100">{finding.title}</p>
                        <div className="flex shrink-0 gap-2">
                          <Badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Badge>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-500">{finding.owasp}</p>

                      <p className="text-sm text-zinc-400">{finding.description}</p>

                      {/* impact (AI-generated) and remediation (deterministic,
                          scanner/remediationMap.js) come from two different
                          sources on purpose — see server/src/ai/index.js —
                          so neither one repeats the description above. */}
                      <div className="space-y-2 border-t border-zinc-800 pt-3">
                        <p className="text-sm">
                          <span className="font-medium text-zinc-300">Impact: </span>
                          <span className="text-zinc-400">{finding.impact}</span>
                        </p>
                        <p className="text-sm">
                          <span className="font-medium text-emerald-400">Recommended fix: </span>
                          <span className="text-zinc-400">{finding.remediation}</span>
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Scan;
