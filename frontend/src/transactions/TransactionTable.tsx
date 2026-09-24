import type { Transaction } from "../api/types";
import {
  formatCurrency,
  formatDecimal,
  formatUtcDateTime,
} from "../format/formatters";
import { StatusBadge } from "../components/StatusBadge";

export function TransactionTable({
  transactions,
}: {
  readonly transactions: readonly Transaction[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1080px] divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-4 py-3">Trade ID</th>
            <th className="px-4 py-3">Timestamp</th>
            <th className="px-4 py-3">Exchange</th>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3 text-right">Quantity</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Gross value</th>
            <th className="px-4 py-3 text-right">Fee</th>
            <th className="px-4 py-3 text-right">Source row</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {transactions.map((transaction) => (
            <tr key={transaction.tradeId}>
              <th className="sticky left-0 bg-white px-4 py-3 text-left font-semibold">
                {transaction.tradeId}
              </th>
              <td className="px-4 py-3">
                {formatUtcDateTime(transaction.timestamp)} UTC
              </td>
              <td className="px-4 py-3">{transaction.exchange}</td>
              <td className="px-4 py-3 font-medium">{transaction.symbol}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  tone={transaction.side === "BUY" ? "positive" : "negative"}
                >
                  {transaction.side}
                </StatusBadge>
              </td>
              <td className="px-4 py-3 text-right">
                {formatDecimal(transaction.quantity, 8)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatCurrency(transaction.priceUsd)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatCurrency(transaction.grossValueUsd)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatCurrency(transaction.feeUsd)}
              </td>
              <td className="px-4 py-3 text-right">
                {transaction.sourceRowNumber}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
