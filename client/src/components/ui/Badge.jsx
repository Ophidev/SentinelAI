// Small pill label — used for severity ("HIGH", "CRITICAL") and for the
// OWASP category tag. Kept as solid-but-muted background + matching text
// color (not just colored text) so severity is scannable at a glance
// without relying on color alone for meaning (the text itself still says
// "HIGH"/"LOW" etc, which also keeps this accessible for colorblind users).
const TONES = {
  critical: "bg-red-500/15 text-red-400 border border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  info: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
  neutral: "bg-zinc-800 text-zinc-400 border border-zinc-700",
};

export default function Badge({ tone = "neutral", className = "", ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TONES[tone]} ${className}`}
      {...props}
    />
  );
}
