import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  isApiError,
  usePortfolioQuery,
  useTransactionsQuery,
} from "../api/queries";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionTable } from "./TransactionTable";
import {
  filtersFromSearchParams,
  searchParamsFromFilters,
} from "./transactionFilterUtils";

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const portfolio = usePortfolioQuery();
  const transactions = useTransactionsQuery(filters);
  const symbols =
    portfolio.data?.performance.map((item) => item.symbol).sort() ?? [];

  return (
    <>
      <PageHeader
        actions={
          <button
            className="focus-ring rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm md:hidden"
            onClick={() => setFiltersOpen(true)}
            type="button"
          >
            Filters
          </button>
        }
        description="Explore immutable trade history. Filters do not recalculate portfolio totals."
        title="Transactions"
      />
      <div className="hidden md:block">
        <TransactionFilters
          filters={filters}
          onChange={setSearchParams}
          symbols={symbols}
        />
      </div>
      {filtersOpen ? (
        <div
          aria-labelledby="transaction-filters-title"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/40 p-4 md:hidden"
          role="dialog"
        >
          <div className="ml-auto grid max-h-full w-full max-w-md gap-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2
                className="text-base font-semibold text-slate-950"
                id="transaction-filters-title"
              >
                Transaction filters
              </h2>
              <button
                className="focus-ring rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
                onClick={() => setFiltersOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <TransactionFilters
              filters={filters}
              onChange={(params) => {
                setSearchParams(params);
                setFiltersOpen(false);
              }}
              symbols={symbols}
            />
          </div>
        </div>
      ) : null}
      {transactions.isLoading ? (
        <LoadingSkeleton label="Loading transactions" />
      ) : transactions.isError ? (
        <ErrorState title="Unable to load transactions">
          {isApiError(transactions.error)
            ? transactions.error.message
            : "The transactions API could not be reached."}
        </ErrorState>
      ) : transactions.data === undefined ? (
        <ErrorState title="Transactions unavailable">
          The transactions response was empty.
        </ErrorState>
      ) : transactions.data.transactions.length === 0 ? (
        <EmptyState title="No transactions found">
          Adjust filters or clear them to browse the active dataset.
        </EmptyState>
      ) : (
        <section className="card overflow-hidden">
          <TransactionTable transactions={transactions.data.transactions} />
          <Pagination
            onPageChange={(page) => {
              setSearchParams(searchParamsFromFilters({ ...filters, page }));
            }}
            onPageSizeChange={(pageSize) => {
              setSearchParams(
                searchParamsFromFilters({ ...filters, page: 1, pageSize }),
              );
            }}
            pagination={transactions.data.pagination}
          />
        </section>
      )}
    </>
  );
}
