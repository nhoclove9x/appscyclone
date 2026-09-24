import type { DatasetSource } from "@prisma/client";

import type { ImportValidationIssue } from "../domain";

export interface DatasetMetadataDto {
  readonly id: string;
  readonly source: DatasetSource;
  readonly sourceFilename: string;
  readonly sourceChecksum: string;
  readonly priceSnapshotId: string;
  readonly importedById: string | null;
  readonly createdAt: string;
}

export interface DatasetMutationResponseDto {
  readonly dataset: DatasetMetadataDto;
  readonly tradeCount: number;
  readonly priceCount: number;
  readonly unchanged?: boolean;
}

export interface ImportValidationErrorDto {
  readonly code: "IMPORT_VALIDATION_FAILED";
  readonly message: string;
  readonly issues: readonly ImportValidationIssue[];
}

export interface DatasetChangedErrorDto {
  readonly code: "DATASET_CHANGED";
  readonly message: string;
}

export interface InvalidRequestErrorDto {
  readonly code: "INVALID_REQUEST";
  readonly message: string;
}
