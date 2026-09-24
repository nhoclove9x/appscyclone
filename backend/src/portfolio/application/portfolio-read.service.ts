import { Injectable, NotFoundException } from "@nestjs/common";
import { Exchange, Prisma, TradeSide } from "@prisma/client";
import type { Dataset, PriceSnapshot, Trade } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import {
  calculatePortfolio,
  financialDecimal,
  type FinancialDecimal,
  type PortfolioCalculation,
  type PortfolioPrice,
  type PortfolioTrade,
  type SymbolPerformance,
} from "../domain";
import type {
  DatasetMetadataDto,
  PortfolioResponseDto,
  PortfolioTotalsDto,
  PriceSnapshotMetadataDto,
  SymbolPerformanceDto,
  TransactionDto,
  TransactionQueryOptions,
  TransactionSort,
  TransactionsResponseDto,
} from "../api/portfolio-api.types";

interface ActiveDatasetRecord {
  readonly dataset: Dataset;
  readonly priceSnapshot: PriceSnapshot;
}

interface ActiveDatasetWithRows extends ActiveDatasetRecord {
  readonly trades: readonly Trade[];
  readonly prices: readonly {
    readonly symbol: string;
    readonly priceUsd: Prisma.Decimal;
  }[];
}

function decimalString(value: FinancialDecimal): string {
  return value.toFixed();
}

function toDatasetDto(dataset: Dataset): DatasetMetadataDto {
  return {
    id: dataset.id,
    source: dataset.source,
    sourceFilename: dataset.sourceFilename,
    sourceChecksum: dataset.sourceChecksum,
    priceSnapshotId: dataset.priceSnapshotId,
    createdAt: dataset.createdAt.toISOString(),
  };
}

function toPriceSnapshotDto(
  priceSnapshot: PriceSnapshot,
): PriceSnapshotMetadataDto {
  return {
    id: priceSnapshot.id,
    asOf: priceSnapshot.asOf.toISOString(),
    sourceFilename: priceSnapshot.sourceFilename,
    sourceChecksum: priceSnapshot.sourceChecksum,
    createdAt: priceSnapshot.createdAt.toISOString(),
  };
}

function toPortfolioTrade(trade: Trade): PortfolioTrade {
  return {
    tradeId: trade.tradeId,
    timestamp: trade.timestamp,
    exchange: trade.exchange,
    symbol: trade.symbol,
    side: trade.side,
    quantity: financialDecimal(trade.quantity.toString()),
    executionPrice: financialDecimal(trade.priceUsd.toString()),
    fee: financialDecimal(trade.feeUsd.toString()),
  };
}

function toPortfolioPrice(price: {
  readonly symbol: string;
  readonly priceUsd: Prisma.Decimal;
}): PortfolioPrice {
  return {
    symbol: price.symbol,
    priceUsd: financialDecimal(price.priceUsd.toString()),
  };
}

function toTotalsDto(calculation: PortfolioCalculation): PortfolioTotalsDto {
  return {
    currentValue: decimalString(calculation.totals.currentValue),
    remainingCostBasis: decimalString(calculation.totals.remainingCostBasis),
    realizedPL: decimalString(calculation.totals.realizedPL),
    unrealizedPL: decimalString(calculation.totals.unrealizedPL),
    totalPL: decimalString(calculation.totals.totalPL),
    fees: decimalString(calculation.totals.totalFees),
  };
}

function toSymbolPerformanceDto(
  performance: SymbolPerformance,
): SymbolPerformanceDto {
  return {
    symbol: performance.symbol,
    quantity: decimalString(performance.quantity),
    averageCost: decimalString(performance.averageCost),
    remainingCostBasis: decimalString(performance.remainingCostBasis),
    currentPrice: decimalString(performance.currentPrice),
    currentValue: decimalString(performance.currentValue),
    realizedPL: decimalString(performance.realizedPL),
    unrealizedPL: decimalString(performance.unrealizedPL),
    totalPL: decimalString(performance.totalPL),
    fees: decimalString(performance.totalFees),
    allocation: decimalString(performance.allocation),
  };
}

function toTransactionDto(trade: Trade): TransactionDto {
  const quantity = financialDecimal(trade.quantity.toString());
  const priceUsd = financialDecimal(trade.priceUsd.toString());

  return {
    tradeId: trade.tradeId,
    sourceRowNumber: trade.sourceRowNumber,
    timestamp: trade.timestamp.toISOString(),
    exchange: trade.exchange,
    symbol: trade.symbol,
    side: trade.side,
    quantity: trade.quantity.toString(),
    priceUsd: trade.priceUsd.toString(),
    feeUsd: trade.feeUsd.toString(),
    grossValueUsd: decimalString(quantity.times(priceUsd)),
  };
}

function totalPages(totalItems: number, pageSize: number): number {
  if (totalItems === 0) {
    return 0;
  }

  return Math.ceil(totalItems / pageSize);
}

@Injectable()
export class PortfolioReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(): Promise<PortfolioResponseDto> {
    const activeDataset = await this.activeDatasetWithRows();
    const calculation = calculatePortfolio(
      activeDataset.trades.map(toPortfolioTrade),
      activeDataset.prices.map(toPortfolioPrice),
    );

    return {
      dataset: toDatasetDto(activeDataset.dataset),
      priceSnapshot: toPriceSnapshotDto(activeDataset.priceSnapshot),
      totals: toTotalsDto(calculation),
      holdings: calculation.holdings.map(toSymbolPerformanceDto),
      performance: calculation.performance.map(toSymbolPerformanceDto),
    };
  }

  async getTransactions(
    options: TransactionQueryOptions,
  ): Promise<TransactionsResponseDto> {
    const activeDataset = await this.activeDatasetMetadata();
    const where = this.transactionWhere(activeDataset.dataset.id, options);
    const order = this.transactionOrder(options.sort);
    const skip = (options.page - 1) * options.pageSize;
    const [totalItems, trades] = await Promise.all([
      this.prisma.trade.count({ where }),
      this.prisma.trade.findMany({
        where,
        orderBy: order,
        skip,
        take: options.pageSize,
      }),
    ]);

    return {
      dataset: toDatasetDto(activeDataset.dataset),
      transactions: trades.map(toTransactionDto),
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        totalItems,
        totalPages: totalPages(totalItems, options.pageSize),
      },
    };
  }

  private async activeDatasetMetadata(): Promise<ActiveDatasetRecord> {
    const state = await this.prisma.applicationState.findUnique({
      where: { id: 1 },
      include: {
        activeDataset: {
          include: {
            priceSnapshot: true,
          },
        },
      },
    });

    if (state === null) {
      throw new NotFoundException({
        code: "ACTIVE_DATASET_NOT_FOUND",
        message: "No active dataset is available",
      });
    }

    return {
      dataset: state.activeDataset,
      priceSnapshot: state.activeDataset.priceSnapshot,
    };
  }

  private async activeDatasetWithRows(): Promise<ActiveDatasetWithRows> {
    const state = await this.prisma.applicationState.findUnique({
      where: { id: 1 },
      include: {
        activeDataset: {
          include: {
            trades: true,
            priceSnapshot: {
              include: {
                prices: true,
              },
            },
          },
        },
      },
    });

    if (state === null) {
      throw new NotFoundException({
        code: "ACTIVE_DATASET_NOT_FOUND",
        message: "No active dataset is available",
      });
    }

    return {
      dataset: state.activeDataset,
      priceSnapshot: state.activeDataset.priceSnapshot,
      trades: state.activeDataset.trades,
      prices: state.activeDataset.priceSnapshot.prices,
    };
  }

  private transactionWhere(
    datasetId: string,
    options: TransactionQueryOptions,
  ): Prisma.TradeWhereInput {
    return {
      datasetId,
      ...(options.symbol === undefined ? {} : { symbol: options.symbol }),
      ...(options.exchange === undefined
        ? {}
        : { exchange: options.exchange }),
      ...(options.side === undefined ? {} : { side: options.side }),
      ...(options.from === undefined && options.to === undefined
        ? {}
        : {
            timestamp: {
              ...(options.from === undefined ? {} : { gte: options.from }),
              ...(options.to === undefined ? {} : { lte: options.to }),
            },
          }),
    };
  }

  private transactionOrder(
    sort: TransactionSort,
  ): Prisma.TradeOrderByWithRelationInput[] {
    const direction = sort === "ASC" ? "asc" : "desc";

    return [{ timestamp: direction }, { tradeId: direction }];
  }
}

export { Exchange, TradeSide };
