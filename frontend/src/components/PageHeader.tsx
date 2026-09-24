import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            {description}
          </p>
        )}
      </div>
      {actions === undefined ? null : <div>{actions}</div>}
    </div>
  );
}
