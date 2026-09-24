import type { Pagination as PaginationData } from "../api/types";

export function Pagination({
  pagination,
  onPageChange,
}: {
  readonly pagination: PaginationData;
  readonly onPageChange: (page: number) => void;
}) {
  const previousDisabled = pagination.page <= 1;
  const nextDisabled =
    pagination.totalPages === 0 || pagination.page >= pagination.totalPages;

  return (
    <nav
      aria-label="Transaction pages"
      className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-slate-600">
        Page {pagination.totalPages === 0 ? 0 : pagination.page} of{" "}
        {pagination.totalPages} · {pagination.totalItems} trades
      </p>
      <div className="flex gap-2">
        <button
          className="focus-ring rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={previousDisabled}
          onClick={() => onPageChange(pagination.page - 1)}
          type="button"
        >
          Previous
        </button>
        <button
          className="focus-ring rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={nextDisabled}
          onClick={() => onPageChange(pagination.page + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
