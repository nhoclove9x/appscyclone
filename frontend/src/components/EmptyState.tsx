import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}
