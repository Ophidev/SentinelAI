// One consistent text-input style across every form (Login, Register,
// Dashboard's "add project" form) — same border/focus-ring treatment as
// Button.jsx so the whole app feels like one system, not several.
export default function Input({ className = "", ...props }) {
  return (
    <input
      className={`h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100
        placeholder:text-zinc-500
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
        ${className}`}
      {...props}
    />
  );
}
