import { Link } from "react-router-dom";

// Shared top bar for every page after login — same logo/brand mark
// everywhere so navigating between Dashboard/Scan/History feels like one
// app, not four separately-styled pages. `right` is arbitrary content
// (back links, "View History", Logout) so each page controls its own actions
// without this component needing to know about every page's specific needs.
export default function Header({ right }) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <span className="text-lg">🛡️</span>
          SentinelAI
        </Link>
        <div className="flex items-center gap-4">{right}</div>
      </div>
    </header>
  );
}
