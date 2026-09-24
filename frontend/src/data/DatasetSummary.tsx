import type { PortfolioResponse } from "../api/types";
import { formatUtcDateTime } from "../format/formatters";
import { StatusBadge } from "../components/StatusBadge";

export function DatasetSummary({
  portfolio,
}: {
  readonly portfolio: PortfolioResponse;
}) {
  const rows = [
    ["Dataset ID", portfolio.dataset.id],
    ["Source", portfolio.dataset.source],
    ["Trade filename", portfolio.dataset.sourceFilename],
    ["Trade checksum", portfolio.dataset.sourceChecksum],
    ["Dataset created", `${formatUtcDateTime(portfolio.dataset.createdAt)} UTC`],
    ["Price snapshot ID", portfolio.priceSnapshot.id],
    [
      "Price snapshot time",
      `${formatUtcDateTime(portfolio.priceSnapshot.asOf)} UTC`,
    ],
    ["Price filename", portfolio.priceSnapshot.sourceFilename],
  ] as const;

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Active dataset
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            All authenticated users share this active immutable dataset.
          </p>
        </div>
        <StatusBadge tone="info">{portfolio.dataset.source}</StatusBadge>
      </div>
      <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div className="rounded-xl bg-slate-50 p-3" key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="mt-1 break-all font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
