export type ImportErrorCode =
  | "MISSING_REQUIRED_COLUMN"
  | "MALFORMED_CSV"
  | "EMPTY_TRADE_ID"
  | "DUPLICATE_TRADE_ID"
  | "INVALID_TIMESTAMP"
  | "INVALID_EXCHANGE"
  | "INVALID_SIDE"
  | "INVALID_DECIMAL"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "INVALID_FEE"
  | "DUPLICATE_PRICE_SYMBOL"
  | "MISSING_SYMBOL_PRICE"
  | "INSUFFICIENT_POSITION"
  | "DATASET_CHANGED"
  | "ACTIVE_DATASET_NOT_FOUND";

export interface ImportValidationIssue {
  readonly code: ImportErrorCode;
  readonly message: string;
  readonly rowNumber?: number;
  readonly field?: string;
  readonly tradeId?: string;
  readonly symbol?: string;
}

export class ImportValidationError extends Error {
  readonly code = "IMPORT_VALIDATION_FAILED";
  readonly issues: readonly ImportValidationIssue[];

  constructor(issues: readonly ImportValidationIssue[]) {
    super("CSV import validation failed");
    this.name = "ImportValidationError";
    this.issues = issues;
  }
}

export class DatasetLifecycleError extends Error {
  readonly code: "DATASET_CHANGED" | "ACTIVE_DATASET_NOT_FOUND";

  constructor(code: "DATASET_CHANGED" | "ACTIVE_DATASET_NOT_FOUND") {
    super(
      code === "DATASET_CHANGED"
        ? "The active dataset changed before activation"
        : "No active dataset is available",
    );
    this.name = "DatasetLifecycleError";
    this.code = code;
  }
}

export function throwIfIssues(issues: readonly ImportValidationIssue[]): void {
  if (issues.length > 0) {
    throw new ImportValidationError(issues);
  }
}
