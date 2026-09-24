export type DatasetSource = "SAMPLE" | "UPLOAD";
export type Exchange = "Binance" | "Coinbase";
export type TradeSide = "BUY" | "SELL";
export type TransactionSort = "ASC" | "DESC";

export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
}

export interface AuthResponse {
  readonly user: AuthUser;
}

export interface DatasetMetadata {
  readonly id: string;
  readonly source: DatasetSource;
  readonly sourceFilename: string;
  readonly sourceChecksum: string;
  readonly priceSnapshotId: string;
  readonly createdAt: string;
}

export interface DatasetMutationMetadata extends DatasetMetadata {
  readonly importedById: string | null;
}

export interface PriceSnapshotMetadata {
  readonly id: string;
  readonly asOf: string;
  readonly sourceFilename: string;
  readonly sourceChecksum: string;
  readonly createdAt: string;
}

export interface PortfolioTotals {
  readonly currentValue: string;
  readonly remainingCostBasis: string;
  readonly realizedPL: string;
  readonly unrealizedPL: string;
  readonly totalPL: string;
  readonly fees: string;
}

export interface SymbolPerformance {
  readonly symbol: string;
  readonly quantity: string;
  readonly averageCost: string;
  readonly remainingCostBasis: string;
  readonly currentPrice: string;
  readonly currentValue: string;
  readonly realizedPL: string;
  readonly unrealizedPL: string;
  readonly totalPL: string;
  readonly fees: string;
  readonly allocation: string;
}

export interface PortfolioResponse {
  readonly dataset: DatasetMetadata;
  readonly priceSnapshot: PriceSnapshotMetadata;
  readonly totals: PortfolioTotals;
  readonly holdings: readonly SymbolPerformance[];
  readonly performance: readonly SymbolPerformance[];
}

export interface Transaction {
  readonly tradeId: string;
  readonly sourceRowNumber: number;
  readonly timestamp: string;
  readonly exchange: Exchange;
  readonly symbol: string;
  readonly side: TradeSide;
  readonly quantity: string;
  readonly priceUsd: string;
  readonly feeUsd: string;
  readonly grossValueUsd: string;
}

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface TransactionsResponse {
  readonly dataset: DatasetMetadata;
  readonly transactions: readonly Transaction[];
  readonly pagination: Pagination;
}

export interface TransactionFilters {
  readonly symbol?: string;
  readonly exchange?: Exchange;
  readonly side?: TradeSide;
  readonly from?: string;
  readonly to?: string;
  readonly sort: TransactionSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface DatasetMutationResponse {
  readonly dataset: DatasetMutationMetadata;
  readonly tradeCount: number;
  readonly priceCount: number;
  readonly unchanged?: boolean;
}

export interface ImportValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly rowNumber?: number;
  readonly field?: string;
  readonly tradeId?: string;
  readonly symbol?: string;
}

export interface ImportValidationErrorBody extends ApiErrorBody {
  readonly code: "IMPORT_VALIDATION_FAILED";
  readonly issues: readonly ImportValidationIssue[];
}
