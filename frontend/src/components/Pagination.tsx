import type { Pagination as PaginationData } from "../api/types";

const PAGE_SIZES = [25, 50, 100] as const;

export function Pagination({
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  readonly pagination: PaginationData;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) {
  const previousDisabled = pagination.page <= 1;
  const nextDisabled =
    pagination.totalPages === 0 || pagination.page >= pagination.totalPages;

  return (
    <nav
      aria-label="Transaction pages"
      className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <p className="text-slate-600">
          Page {pagination.totalPages === 0 ? 0 : pagination.page} of{" "}
          {pagination.totalPages} · {pagination.totalItems} trades
        </p>
        <label className="flex items-center gap-2 font-medium text-slate-700">
          Rows per page
          <select
            aria-label="Rows per page"
            className="focus-ring rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-700"
            onChange={(event) => {
              const pageSize = PAGE_SIZES.find(
                (size) => String(size) === event.currentTarget.value,
              );

              if (pageSize !== undefined) {
                onPageSizeChange(pageSize);
              }
            }}
            value={String(pagination.pageSize)}
          >
            {PAGE_SIZES.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
      </div>
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
