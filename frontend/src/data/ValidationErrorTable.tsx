import type { ImportValidationIssue } from "../api/types";

export function ValidationErrorTable({
  issues,
}: {
  readonly issues: readonly ImportValidationIssue[];
}) {
  return (
    <div className="card overflow-hidden border-rose-200">
      <div className="border-b border-rose-200 bg-rose-50 px-5 py-4">
        <h2 className="text-base font-semibold text-rose-950">
          Import validation errors
        </h2>
        <p className="mt-1 text-sm text-rose-800">
          Fix every row-level issue and upload the CSV again. The active dataset
          was not changed.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] divide-y divide-rose-100 text-sm">
          <thead className="bg-rose-50 text-left text-xs font-semibold uppercase tracking-wide text-rose-700">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Row</th>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Trade ID</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-100 bg-white">
            {issues.map((issue, index) => (
              <tr key={`${issue.code}-${String(issue.rowNumber ?? index)}`}>
                <td className="px-4 py-3 font-medium">{issue.code}</td>
                <td className="px-4 py-3">{issue.rowNumber ?? "—"}</td>
                <td className="px-4 py-3">{issue.field ?? "—"}</td>
                <td className="px-4 py-3">{issue.tradeId ?? "—"}</td>
                <td className="px-4 py-3">{issue.symbol ?? "—"}</td>
                <td className="px-4 py-3">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
