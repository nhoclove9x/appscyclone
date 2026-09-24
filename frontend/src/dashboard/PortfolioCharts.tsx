import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SymbolPerformance } from "../api/types";
import {
  chartNumber,
  formatCurrency,
  formatPercent,
} from "../format/formatters";

const chartColors = ["#4f46e5", "#0f766e", "#2563eb", "#7c3aed", "#ea580c"];

interface AllocationDatum extends Record<string, string | number> {
  readonly symbol: string;
  readonly value: number;
  readonly allocation: string;
}

interface PnlDatum extends Record<string, string | number> {
  readonly symbol: string;
  readonly realized: number;
  readonly unrealized: number;
}

function allocationData(
  holdings: readonly SymbolPerformance[],
): AllocationDatum[] {
  return holdings.map((holding) => ({
    symbol: holding.symbol,
    value: chartNumber(holding.currentValue),
    allocation: holding.allocation,
  }));
}

function pnlData(performance: readonly SymbolPerformance[]): PnlDatum[] {
  return performance.map((item) => ({
    symbol: item.symbol,
    realized: chartNumber(item.realizedPL),
    unrealized: chartNumber(item.unrealizedPL),
  }));
}

export function AllocationChart({
  holdings,
}: {
  readonly holdings: readonly SymbolPerformance[];
}) {
  const data = allocationData(holdings);

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold text-slate-950">
        Current-value allocation
      </h2>
      {data.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">
          No open holdings to chart.
        </p>
      ) : (
        <div className="mt-4 h-72" aria-hidden="true">
          <ResponsiveContainer height="100%" width="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={62}
                nameKey="symbol"
                outerRadius={96}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell
                    fill={chartColors[index % chartColors.length]}
                    key={entry.symbol}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  formatCurrency(String(value), { signDisplay: "auto" })
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Allocation chart source data</caption>
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2">Symbol</th>
            <th className="py-2 text-right">Value</th>
            <th className="py-2 text-right">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr className="border-t border-slate-100" key={holding.symbol}>
              <td className="py-2 font-medium">{holding.symbol}</td>
              <td className="py-2 text-right">
                {formatCurrency(holding.currentValue)}
              </td>
              <td className="py-2 text-right">
                {formatPercent(holding.allocation)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PnlChart({
  performance,
}: {
  readonly performance: readonly SymbolPerformance[];
}) {
  const data = pnlData(performance);

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold text-slate-950">
        Realized vs unrealized P&L
      </h2>
      <div className="mt-4 h-72" aria-hidden="true">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="symbol" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(String(value))} />
            <Legend />
            <Bar dataKey="realized" fill="#4f46e5" name="Realized P&L" />
            <Bar dataKey="unrealized" fill="#0f766e" name="Unrealized P&L" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">P&L chart source data</caption>
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2">Symbol</th>
            <th className="py-2 text-right">Realized</th>
            <th className="py-2 text-right">Unrealized</th>
          </tr>
        </thead>
        <tbody>
          {performance.map((item) => (
            <tr className="border-t border-slate-100" key={item.symbol}>
              <td className="py-2 font-medium">{item.symbol}</td>
              <td className="py-2 text-right">
                {formatCurrency(item.realizedPL, { signDisplay: "always" })}
              </td>
              <td className="py-2 text-right">
                {formatCurrency(item.unrealizedPL, {
                  signDisplay: "always",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
