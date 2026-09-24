export function LoadingSkeleton({
  label = "Loading",
}: {
  readonly label?: string;
}) {
  return (
    <div
      aria-label={label}
      className="grid gap-4"
      role="status"
    >
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}
