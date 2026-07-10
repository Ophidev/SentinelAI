// A plain panel: subtle border + slightly-lighter-than-background fill,
// no drop shadow drama, no hover lift — this is a dashboard for engineers,
// not a marketing page, so the card itself should stay quiet.
export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900/60 ${className}`}
      {...props}
    />
  );
}

// Consistent internal padding, kept as its own component so every card
// doesn't repeat the same "p-4" (or whatever we tune it to) by hand.
export function CardBody({ className = "", ...props }) {
  return <div className={`p-4 ${className}`} {...props} />;
}
