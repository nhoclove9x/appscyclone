import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { DatasetLifecycleService } from "../application/dataset-lifecycle.service";
import type { DatasetLifecycleResult } from "../application/dataset-lifecycle.service";
import type {
  DatasetMetadataDto,
  DatasetMutationResponseDto,
} from "./import-api.types";

function toDatasetMetadataDto(dataset: {
  readonly id: string;
  readonly source: DatasetMetadataDto["source"];
  readonly sourceFilename: string;
  readonly sourceChecksum: string;
  readonly priceSnapshotId: string;
  readonly importedById: string | null;
  readonly createdAt: Date;
}): DatasetMetadataDto {
  return {
    id: dataset.id,
    source: dataset.source,
    sourceFilename: dataset.sourceFilename,
    sourceChecksum: dataset.sourceChecksum,
    priceSnapshotId: dataset.priceSnapshotId,
    importedById: dataset.importedById,
    createdAt: dataset.createdAt.toISOString(),
  };
}

@Injectable()
export class ImportsApiService {
  constructor(
    private readonly lifecycle: DatasetLifecycleService,
    private readonly prisma: PrismaService,
  ) {}

  async importTrades(input: {
    readonly csvContent: string;
    readonly filename: string;
    readonly importedById: string;
  }): Promise<DatasetMutationResponseDto> {
    const result = await this.lifecycle.replaceActiveTradeDataset(input);

    return this.resultToResponse(result);
  }

  async resetSampleData(): Promise<DatasetMutationResponseDto> {
    const result = await this.lifecycle.resetSampleData();

    return this.resultToResponse(result);
  }

  private async resultToResponse(
    result: DatasetLifecycleResult,
  ): Promise<DatasetMutationResponseDto> {
    const dataset = await this.prisma.dataset.findUniqueOrThrow({
      where: { id: result.datasetId },
    });

    return {
      dataset: toDatasetMetadataDto(dataset),
      tradeCount: result.tradeCount,
      priceCount: result.priceCount,
    };
  }
}
