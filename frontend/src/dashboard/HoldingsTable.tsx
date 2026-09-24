import clsx from "clsx";

import type { SymbolPerformance } from "../api/types";
import {
  formatCurrency,
  formatDecimal,
  formatPercent,
  signedTone,
} from "../format/formatters";

function SignedCurrency({ value }: { readonly value: string }) {
  const tone = signedTone(value);

  return (
    <span
      className={clsx(
        tone === "positive" && "text-emerald-700",
        tone === "negative" && "text-rose-700",
        tone === "neutral" && "text-slate-700",
      )}
    >
      {formatCurrency(value, { signDisplay: "always" })}
    </span>
  );
}

export function HoldingsTable({
  holdings,
}: {
  readonly holdings: readonly SymbolPerformance[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Holdings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Current open positions only. Closed symbols remain in performance
          charts when they have historical P&L.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-3">Symbol</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Avg cost</th>
              <th className="px-4 py-3 text-right">Current price</th>
              <th className="px-4 py-3 text-right">Cost basis</th>
              <th className="px-4 py-3 text-right">Current value</th>
              <th className="px-4 py-3 text-right">Realized P&L</th>
              <th className="px-4 py-3 text-right">Unrealized P&L</th>
              <th className="px-4 py-3 text-right">Total P&L</th>
              <th className="px-4 py-3 text-right">Allocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {holdings.map((holding) => (
              <tr key={holding.symbol}>
                <th className="sticky left-0 bg-white px-4 py-3 text-left font-semibold text-slate-950">
                  {holding.symbol}
                </th>
                <td className="px-4 py-3 text-right">
                  {formatDecimal(holding.quantity, 8)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(holding.averageCost)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(holding.currentPrice)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(holding.remainingCostBasis)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(holding.currentValue)}
                </td>
                <td className="px-4 py-3 text-right">
                  <SignedCurrency value={holding.realizedPL} />
                </td>
                <td className="px-4 py-3 text-right">
                  <SignedCurrency value={holding.unrealizedPL} />
                </td>
                <td className="px-4 py-3 text-right">
                  <SignedCurrency value={holding.totalPL} />
                </td>
                <td className="px-4 py-3 text-right">
                  {formatPercent(holding.allocation)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
