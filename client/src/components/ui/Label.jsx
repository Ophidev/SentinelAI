// Small, quiet field label — used above an Input instead of relying on
// placeholder text alone, so forms remain readable once a field is filled in.
export default function Label({ className = "", ...props }) {
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-zinc-300 ${className}`}
      {...props}
    />
  );
}
