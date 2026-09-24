import type { ReactNode } from "react";

export function ErrorState({
  title = "Something went wrong",
  children,
}: {
  readonly title?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="card border-rose-200 bg-rose-50 p-6 text-rose-900">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}
