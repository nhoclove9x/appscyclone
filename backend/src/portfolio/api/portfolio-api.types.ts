import type { DatasetSource, Exchange, TradeSide } from "@prisma/client";

export interface DatasetMetadataDto {
  readonly id: string;
  readonly source: DatasetSource;
  readonly sourceFilename: string;
  readonly sourceChecksum: string;
  readonly priceSnapshotId: string;
  readonly createdAt: string;
}

export interface PriceSnapshotMetadataDto {
  readonly id: string;
  readonly asOf: string;
  readonly sourceFilename: string;
  readonly sourceChecksum: string;
  readonly createdAt: string;
}

export interface PortfolioTotalsDto {
  readonly currentValue: string;
  readonly remainingCostBasis: string;
  readonly realizedPL: string;
  readonly unrealizedPL: string;
  readonly totalPL: string;
  readonly fees: string;
}

export interface SymbolPerformanceDto {
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

export interface PortfolioResponseDto {
  readonly dataset: DatasetMetadataDto;
  readonly priceSnapshot: PriceSnapshotMetadataDto;
  readonly totals: PortfolioTotalsDto;
  readonly holdings: readonly SymbolPerformanceDto[];
  readonly performance: readonly SymbolPerformanceDto[];
}

export type TransactionSort = "ASC" | "DESC";

export interface TransactionQueryOptions {
  readonly symbol?: string;
  readonly exchange?: Exchange;
  readonly side?: TradeSide;
  readonly from?: Date;
  readonly to?: Date;
  readonly sort: TransactionSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface TransactionDto {
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

export interface PaginationDto {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface TransactionsResponseDto {
  readonly dataset: DatasetMetadataDto;
  readonly transactions: readonly TransactionDto[];
  readonly pagination: PaginationDto;
}
