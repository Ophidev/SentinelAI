// Small, dependency-free "shadcn-style" button — same visual language
// (subtle borders, restrained color, no bounce/scale animation) without
// pulling in Radix or the shadcn CLI. Every page imports this instead of
// hand-writing className strings, so button styling stays consistent app-wide.
const VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
  ghost: "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900",
  destructive: "bg-red-600/90 text-white hover:bg-red-500",
};

const SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
