import clsx from "clsx";

import { formatCurrency, signedTone } from "../format/formatters";

export function KpiCard({
  label,
  value,
  signed = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly signed?: boolean;
}) {
  const tone = signed ? signedTone(value) : "neutral";

  return (
    <article className="card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={clsx(
          "mt-3 text-2xl font-semibold tracking-tight",
          tone === "positive" && "text-emerald-700",
          tone === "negative" && "text-rose-700",
          tone === "neutral" && "text-slate-950",
        )}
      >
        {formatCurrency(value, {
          signDisplay: signed ? "always" : "auto",
        })}
      </p>
    </article>
  );
}
