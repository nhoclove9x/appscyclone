import { Injectable } from "@nestjs/common";
import { DatasetSource, Prisma } from "@prisma/client";
import type { Price } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type {
  PortfolioCalculation,
  PortfolioPrice,
} from "../../portfolio/domain";
import { financialDecimal, calculatePortfolio } from "../../portfolio/domain";
import {
  DatasetLifecycleError,
  parsePriceCsv,
  parseTradeCsv,
  sha256Hex,
  validateTradesAgainstPrices,
} from "../domain";
import type { ParsedPriceSnapshot, ParsedTrade } from "../domain";
import { SampleDataService } from "./sample-data.service";
import type { SampleCsvContent } from "./sample-data.service";

export interface ActiveDatasetCapture {
  readonly expectedDatasetId: string;
  readonly activeDatasetChecksum: string;
  readonly priceSnapshotId: string;
  readonly prices: readonly PortfolioPrice[];
}

export interface PreparedTradeReplacement {
  readonly source: "UPLOAD";
  readonly sourceFilename: string;
  readonly sourceChecksum: string;
  readonly importedById?: string;
  readonly expectedDatasetId: string;
  readonly priceSnapshotId: string;
  readonly priceCount: number;
  readonly trades: readonly ParsedTrade[];
  readonly calculation: PortfolioCalculation;
}

export interface PreparedSampleDataset {
  readonly source: "SAMPLE";
  readonly pricesFilename: string;
  readonly pricesChecksum: string;
  readonly tradesFilename: string;
  readonly tradesChecksum: string;
  readonly priceSnapshot: ParsedPriceSnapshot;
  readonly trades: readonly ParsedTrade[];
  readonly calculation: PortfolioCalculation;
}

export interface PreparedSampleReset extends PreparedSampleDataset {
  readonly expectedDatasetId: string;
}

export interface DatasetLifecycleResult {
  readonly datasetId: string;
  readonly priceSnapshotId: string;
  readonly tradeCount: number;
  readonly priceCount: number;
  readonly calculation: PortfolioCalculation;
  readonly unchanged?: boolean;
}

export interface ReplaceTradeDatasetInput {
  readonly csvContent: string;
  readonly filename: string;
  readonly importedById?: string;
}

export interface ClearTradeDatasetInput {
  readonly importedById?: string;
}

function prismaDecimal(value: { toFixed(): string }): string {
  return value.toFixed();
}

function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function portfolioPricesFromDatabasePrices(
  prices: readonly Price[],
): PortfolioPrice[] {
  return prices.map((price) => ({
    symbol: price.symbol,
    priceUsd: financialDecimal(price.priceUsd.toString()),
  }));
}

@Injectable()
export class DatasetLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sampleData: SampleDataService,
  ) {}

  async captureActiveDataset(): Promise<ActiveDatasetCapture> {
    const state = await this.prisma.applicationState.findUnique({
      where: { id: 1 },
      include: {
        activeDataset: {
          include: {
            priceSnapshot: {
              include: { prices: true },
            },
          },
        },
      },
    });

    if (state === null) {
      throw new DatasetLifecycleError("ACTIVE_DATASET_NOT_FOUND");
    }

    return {
      expectedDatasetId: state.activeDatasetId,
      activeDatasetChecksum: state.activeDataset.sourceChecksum,
      priceSnapshotId: state.activeDataset.priceSnapshotId,
      prices: portfolioPricesFromDatabasePrices(
        state.activeDataset.priceSnapshot.prices,
      ),
    };
  }

  async prepareTradeReplacement(
    input: ReplaceTradeDatasetInput,
  ): Promise<PreparedTradeReplacement> {
    const activeDataset = await this.captureActiveDataset();
    const sourceChecksum = sha256Hex(input.csvContent);
    const tradeDataset = parseTradeCsv(input.csvContent);
    const validated = validateTradesAgainstPrices(
      tradeDataset,
      activeDataset.prices,
    );

    return {
      source: "UPLOAD",
      sourceFilename: input.filename,
      sourceChecksum,
      ...(input.importedById === undefined
        ? {}
        : { importedById: input.importedById }),
      expectedDatasetId: activeDataset.expectedDatasetId,
      priceSnapshotId: activeDataset.priceSnapshotId,
      priceCount: activeDataset.prices.length,
      trades: validated.trades,
      calculation: validated.calculation,
    };
  }

  async activatePreparedTradeReplacement(
    prepared: PreparedTradeReplacement,
  ): Promise<DatasetLifecycleResult> {
    return this.prisma.$transaction(async (transaction) => {
      const dataset = await transaction.dataset.create({
        data: {
          source: DatasetSource.UPLOAD,
          sourceFilename: prepared.sourceFilename,
          sourceChecksum: prepared.sourceChecksum,
          priceSnapshotId: prepared.priceSnapshotId,
          ...(prepared.importedById === undefined
            ? {}
            : { importedById: prepared.importedById }),
        },
      });

      await transaction.trade.createMany({
        data: prepared.trades.map((trade) => ({
          datasetId: dataset.id,
          tradeId: trade.tradeId,
          sourceRowNumber: trade.sourceRowNumber,
          timestamp: trade.timestamp,
          exchange: trade.exchange,
          symbol: trade.symbol,
          side: trade.side,
          quantity: prismaDecimal(trade.quantity),
          priceUsd: prismaDecimal(trade.priceUsd),
          feeUsd: prismaDecimal(trade.feeUsd),
        })),
      });

      const updatedRows = await transaction.$executeRaw`
        UPDATE "application_state"
        SET "active_dataset_id" = CAST(${dataset.id} AS uuid),
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = 1
          AND "active_dataset_id" = CAST(${prepared.expectedDatasetId} AS uuid)
      `;

      if (updatedRows !== 1) {
        throw new DatasetLifecycleError("DATASET_CHANGED");
      }

      return {
        datasetId: dataset.id,
        priceSnapshotId: prepared.priceSnapshotId,
        tradeCount: prepared.trades.length,
        priceCount: prepared.priceCount,
        calculation: prepared.calculation,
      };
    });
  }

  async replaceActiveTradeDataset(
    input: ReplaceTradeDatasetInput,
  ): Promise<DatasetLifecycleResult> {
    const activeDataset = await this.captureActiveDataset();

    if (sha256Hex(input.csvContent) === activeDataset.activeDatasetChecksum) {
      return {
        ...(await this.resultFromActiveDataset(activeDataset.expectedDatasetId)),
        unchanged: true,
      };
    }

    return this.activatePreparedTradeReplacement(
      await this.prepareTradeReplacement(input),
    );
  }

  async clearActiveTradeDataset(
    input: ClearTradeDatasetInput = {},
  ): Promise<DatasetLifecycleResult> {
    const activeDataset = await this.captureActiveDataset();
    const calculation = calculatePortfolio([], activeDataset.prices);

    return this.prisma.$transaction(async (transaction) => {
      const dataset = await transaction.dataset.create({
        data: {
          source: DatasetSource.UPLOAD,
          sourceFilename: "empty-transactions.csv",
          sourceChecksum: sha256Hex(""),
          priceSnapshotId: activeDataset.priceSnapshotId,
          ...(input.importedById === undefined
            ? {}
            : { importedById: input.importedById }),
        },
      });

      const updatedRows = await transaction.$executeRaw`
        UPDATE "application_state"
        SET "active_dataset_id" = CAST(${dataset.id} AS uuid),
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = 1
          AND "active_dataset_id" = CAST(${activeDataset.expectedDatasetId} AS uuid)
      `;

      if (updatedRows !== 1) {
        throw new DatasetLifecycleError("DATASET_CHANGED");
      }

      return {
        datasetId: dataset.id,
        priceSnapshotId: activeDataset.priceSnapshotId,
        tradeCount: 0,
        priceCount: activeDataset.prices.length,
        calculation,
      };
    });
  }

  prepareSampleDataset(sample: SampleCsvContent): PreparedSampleDataset {
    const priceSnapshot = parsePriceCsv(sample.pricesCsv);
    const tradeDataset = parseTradeCsv(sample.tradesCsv);
    const validated = validateTradesAgainstPrices(
      tradeDataset,
      priceSnapshot.portfolioPrices,
    );

    return {
      source: "SAMPLE",
      pricesFilename: sample.pricesFilename,
      pricesChecksum: sha256Hex(sample.pricesCsv),
      tradesFilename: sample.tradesFilename,
      tradesChecksum: sha256Hex(sample.tradesCsv),
      priceSnapshot,
      trades: validated.trades,
      calculation: validated.calculation,
    };
  }

  async initializeSampleDataIfNeeded(
    sampleOverride?: SampleCsvContent,
  ): Promise<DatasetLifecycleResult> {
    const sample =
      sampleOverride ?? (await this.sampleData.readCanonicalSampleData());
    const prepared = this.prepareSampleDataset(sample);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existingState = await transaction.applicationState.findUnique({
          where: { id: 1 },
        });

        if (existingState !== null) {
          return this.resultFromActiveDataset(existingState.activeDatasetId);
        }

        return this.createAndActivateInitialSample(transaction, prepared);
      });
    } catch (error: unknown) {
      if (isPrismaKnownError(error) && error.code === "P2002") {
        const state = await this.prisma.applicationState.findUnique({
          where: { id: 1 },
        });

        if (state !== null) {
          return this.resultFromActiveDataset(state.activeDatasetId);
        }
      }

      throw error;
    }
  }

  async prepareSampleReset(
    sampleOverride?: SampleCsvContent,
  ): Promise<PreparedSampleReset> {
    const activeDataset = await this.captureActiveDataset();
    const sample =
      sampleOverride ?? (await this.sampleData.readCanonicalSampleData());

    return {
      ...this.prepareSampleDataset(sample),
      expectedDatasetId: activeDataset.expectedDatasetId,
    };
  }

  async activatePreparedSampleReset(
    prepared: PreparedSampleReset,
  ): Promise<DatasetLifecycleResult> {
    return this.prisma.$transaction(async (transaction) => {
      const priceSnapshot = await this.createPriceSnapshot(
        transaction,
        prepared,
      );
      const dataset = await this.createDatasetWithTrades(
        transaction,
        {
          source: DatasetSource.SAMPLE,
          sourceFilename: prepared.tradesFilename,
          sourceChecksum: prepared.tradesChecksum,
          priceSnapshotId: priceSnapshot.id,
        },
        prepared.trades,
      );

      const updatedRows = await transaction.$executeRaw`
        UPDATE "application_state"
        SET "active_dataset_id" = CAST(${dataset.id} AS uuid),
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = 1
          AND "active_dataset_id" = CAST(${prepared.expectedDatasetId} AS uuid)
      `;

      if (updatedRows !== 1) {
        throw new DatasetLifecycleError("DATASET_CHANGED");
      }

      return {
        datasetId: dataset.id,
        priceSnapshotId: priceSnapshot.id,
        tradeCount: prepared.trades.length,
        priceCount: prepared.priceSnapshot.prices.length,
        calculation: prepared.calculation,
      };
    });
  }

  async resetSampleData(
    sampleOverride?: SampleCsvContent,
  ): Promise<DatasetLifecycleResult> {
    return this.activatePreparedSampleReset(
      await this.prepareSampleReset(sampleOverride),
    );
  }

  async calculateActivePortfolio(): Promise<PortfolioCalculation> {
    const state = await this.prisma.applicationState.findUnique({
      where: { id: 1 },
      include: {
        activeDataset: {
          include: {
            trades: true,
            priceSnapshot: {
              include: { prices: true },
            },
          },
        },
      },
    });

    if (state === null) {
      throw new DatasetLifecycleError("ACTIVE_DATASET_NOT_FOUND");
    }

    const trades = state.activeDataset.trades.map((trade) => ({
      tradeId: trade.tradeId,
      timestamp: trade.timestamp,
      exchange: trade.exchange,
      symbol: trade.symbol,
      side: trade.side,
      quantity: financialDecimal(trade.quantity.toString()),
      executionPrice: financialDecimal(trade.priceUsd.toString()),
      fee: financialDecimal(trade.feeUsd.toString()),
    }));

    return calculatePortfolio(
      trades,
      portfolioPricesFromDatabasePrices(
        state.activeDataset.priceSnapshot.prices,
      ),
    );
  }

  private async resultFromActiveDataset(
    datasetId: string,
  ): Promise<DatasetLifecycleResult> {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: datasetId },
      include: {
        trades: true,
        priceSnapshot: {
          include: { prices: true },
        },
      },
    });

    if (dataset === null) {
      throw new DatasetLifecycleError("ACTIVE_DATASET_NOT_FOUND");
    }

    const calculation = await this.calculateActivePortfolio();

    return {
      datasetId: dataset.id,
      priceSnapshotId: dataset.priceSnapshotId,
      tradeCount: dataset.trades.length,
      priceCount: dataset.priceSnapshot.prices.length,
      calculation,
    };
  }

  private async createAndActivateInitialSample(
    transaction: Prisma.TransactionClient,
    prepared: PreparedSampleDataset,
  ): Promise<DatasetLifecycleResult> {
    const priceSnapshot = await this.createPriceSnapshot(transaction, prepared);
    const dataset = await this.createDatasetWithTrades(
      transaction,
      {
        source: DatasetSource.SAMPLE,
        sourceFilename: prepared.tradesFilename,
        sourceChecksum: prepared.tradesChecksum,
        priceSnapshotId: priceSnapshot.id,
      },
      prepared.trades,
    );

    await transaction.applicationState.create({
      data: {
        id: 1,
        activeDatasetId: dataset.id,
      },
    });

    return {
      datasetId: dataset.id,
      priceSnapshotId: priceSnapshot.id,
      tradeCount: prepared.trades.length,
      priceCount: prepared.priceSnapshot.prices.length,
      calculation: prepared.calculation,
    };
  }

  private async createPriceSnapshot(
    transaction: Prisma.TransactionClient,
    prepared: PreparedSampleDataset,
  ) {
    const priceSnapshot = await transaction.priceSnapshot.create({
      data: {
        asOf: prepared.priceSnapshot.asOf,
        sourceFilename: prepared.pricesFilename,
        sourceChecksum: prepared.pricesChecksum,
      },
    });

    await transaction.price.createMany({
      data: prepared.priceSnapshot.prices.map((price) => ({
        snapshotId: priceSnapshot.id,
        symbol: price.symbol,
        priceUsd: prismaDecimal(price.priceUsd),
      })),
    });

    return priceSnapshot;
  }

  private async createDatasetWithTrades(
    transaction: Prisma.TransactionClient,
    data: {
      readonly source: DatasetSource;
      readonly sourceFilename: string;
      readonly sourceChecksum: string;
      readonly priceSnapshotId: string;
      readonly importedById?: string;
    },
    trades: readonly ParsedTrade[],
  ) {
    const dataset = await transaction.dataset.create({
      data,
    });

    await transaction.trade.createMany({
      data: trades.map((trade) => ({
        datasetId: dataset.id,
        tradeId: trade.tradeId,
        sourceRowNumber: trade.sourceRowNumber,
        timestamp: trade.timestamp,
        exchange: trade.exchange,
        symbol: trade.symbol,
        side: trade.side,
        quantity: prismaDecimal(trade.quantity),
        priceUsd: prismaDecimal(trade.priceUsd),
        feeUsd: prismaDecimal(trade.feeUsd),
      })),
    });

    return dataset;
  }
}
