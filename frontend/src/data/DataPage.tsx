import { useState } from "react";

import {
  isApiError,
  useClearTransactionsMutation,
  useImportTradesMutation,
  usePortfolioQuery,
  useResetSampleMutation,
} from "../api/queries";
import type { ImportValidationErrorBody } from "../api/types";
import { ErrorState } from "../components/ErrorState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { PageHeader } from "../components/PageHeader";
import { CsvUpload } from "./CsvUpload";
import { ConfirmResetDialog } from "./ConfirmResetDialog";
import { DatasetSummary } from "./DatasetSummary";
import { ValidationErrorTable } from "./ValidationErrorTable";

function validationIssues(error: unknown) {
  if (!isApiError(error) || error.code !== "IMPORT_VALIDATION_FAILED") {
    return undefined;
  }

  const details = error.details as Partial<ImportValidationErrorBody>;

  return Array.isArray(details.issues) ? details.issues : undefined;
}

function mutationMessage(error: unknown): string | undefined {
  if (error === null || error === undefined) {
    return undefined;
  }

  if (isApiError(error)) {
    if (error.code === "DATASET_CHANGED") {
      return "The active dataset changed while this operation was running. Refresh the latest data and retry if needed.";
    }

    return error.message;
  }

  return "The operation failed.";
}

function isDatasetChanged(error: unknown): boolean {
  return isApiError(error) && error.code === "DATASET_CHANGED";
}

export function DataPage() {
  const portfolio = usePortfolioQuery();
  const importTrades = useImportTradesMutation();
  const resetSample = useResetSampleMutation();
  const clearTransactions = useClearTransactionsMutation();
  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clientUploadError, setClientUploadError] = useState<string | null>(
    null,
  );
  const importIssues = validationIssues(importTrades.error);
  const errorMessage =
    clientUploadError ??
    mutationMessage(importTrades.error) ??
    mutationMessage(resetSample.error) ??
    mutationMessage(clearTransactions.error);

  return (
    <>
      <PageHeader
        description="Replace the shared trade history or restore the canonical sample dataset."
        title="Data management"
      />

      {portfolio.isLoading ? (
        <LoadingSkeleton label="Loading active dataset" />
      ) : portfolio.isError ? (
        <ErrorState title="Unable to load active dataset">
          {isApiError(portfolio.error)
            ? portfolio.error.message
            : "The portfolio API could not be reached."}
        </ErrorState>
      ) : portfolio.data === undefined ? (
        <ErrorState title="Active dataset unavailable">
          The portfolio response was empty.
        </ErrorState>
      ) : (
        <DatasetSummary portfolio={portfolio.data} />
      )}

      {errorMessage === undefined ? null : (
        <ErrorState
          title={
            isDatasetChanged(importTrades.error) ||
            isDatasetChanged(resetSample.error) ||
            isDatasetChanged(clearTransactions.error)
              ? "Dataset changed"
              : "Operation failed"
          }
        >
          {errorMessage}
        </ErrorState>
      )}

      {importTrades.isSuccess ? (
        <div
          className={
            importTrades.data.unchanged === true
              ? "card border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
              : "card border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
          }
          role="status"
        >
          {importTrades.data.unchanged === true ? (
            <>
              No changes detected. The selected CSV matches the active dataset:{" "}
              <span className="font-semibold">
                {importTrades.data.dataset.sourceFilename}
              </span>{" "}
              ({importTrades.data.tradeCount} trades).
            </>
          ) : (
            <>
              Import succeeded. Active dataset:{" "}
              <span className="font-semibold">
                {importTrades.data.dataset.sourceFilename}
              </span>{" "}
              ({importTrades.data.tradeCount} trades).
            </>
          )}
        </div>
      ) : null}

      {resetSample.isSuccess ? (
        <div
          className="card border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
          role="status"
        >
          Sample data reset succeeded. Active dataset contains{" "}
          {resetSample.data.tradeCount} trades and {resetSample.data.priceCount}{" "}
          prices.
        </div>
      ) : null}

      {clearTransactions.isSuccess ? (
        <div
          className="card border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
          role="status"
        >
          Transactions cleared. The active dataset now contains 0 trades.
        </div>
      ) : null}

      {importIssues === undefined ? null : (
        <ValidationErrorTable issues={importIssues} />
      )}

      <CsvUpload
        disabled={importTrades.isPending}
        onValidationError={(message) => {
          setClientUploadError(message);
        }}
        onUpload={(file) => {
          setClientUploadError(null);
          importTrades.mutate(file);
        }}
      />

      <section className="card p-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Destructive actions
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Shared dataset controls
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            These actions change the globally active dataset for every
            authenticated user. Historical immutable records remain in the
            database.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-950">Reset sample data</h3>
            <p className="mt-1 text-sm text-slate-600">
              Restore the supplied sample trades and fixed price snapshot.
            </p>
            <button
              className="focus-ring mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              onClick={() => setResetOpen(true)}
              type="button"
            >
              Reset sample data
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-950">
              Clear transactions
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Activate an empty trade dataset while preserving the current
              price snapshot.
            </p>
            <button
              className="focus-ring mt-4 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              onClick={() => setClearOpen(true)}
              type="button"
            >
              Clear transactions
            </button>
          </div>
        </div>
      </section>

      <ConfirmResetDialog
        confirmLabel="Reset sample data"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetSample.mutate(undefined, {
            onSuccess: () => setResetOpen(false),
          });
        }}
        open={resetOpen}
        pending={resetSample.isPending}
        title="Reset sample data?"
      />
      <ConfirmResetDialog
        confirmLabel="Clear transactions"
        description="This activates a new empty trade dataset with the current price snapshot. The existing transaction history remains stored as an inactive immutable dataset."
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          clearTransactions.mutate(undefined, {
            onSuccess: () => setClearOpen(false),
          });
        }}
        open={clearOpen}
        pending={clearTransactions.isPending}
        title="Clear all active transactions?"
      />
    </>
  );
}
