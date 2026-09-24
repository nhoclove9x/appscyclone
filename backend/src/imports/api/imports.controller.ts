import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { AuthGuard } from "../../auth";
import type { AuthenticatedRequest } from "../../auth";
import {
  invalidRequest,
  mapDatasetMutationError,
} from "./import-api.errors";
import type { DatasetMutationResponseDto } from "./import-api.types";
import { ImportsApiService } from "./imports-api.service";

const MAX_TRADE_CSV_BYTES = 1024 * 1024;

interface UploadedCsvFile {
  readonly originalname: string;
  readonly buffer: Buffer;
  readonly size: number;
}

function parseCsvUpload(file: UploadedCsvFile | undefined): {
  readonly csvContent: string;
  readonly filename: string;
} {
  if (file === undefined) {
    throw invalidRequest("CSV file is required");
  }

  if (file.size === 0) {
    throw invalidRequest("CSV file must not be empty");
  }

  return {
    csvContent: file.buffer.toString("utf8"),
    filename: file.originalname,
  };
}

function parseResetConfirmation(body: unknown): void {
  if (
    typeof body !== "object" ||
    body === null ||
    !("confirm" in body) ||
    body.confirm !== true
  ) {
    throw invalidRequest("Reset requires confirm: true");
  }
}

@Controller()
@UseGuards(AuthGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsApiService) {}

  @Post("imports/trades")
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: MAX_TRADE_CSV_BYTES,
        files: 1,
      },
    }),
  )
  async importTrades(
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<DatasetMutationResponseDto> {
    const parsedFile = parseCsvUpload(file);

    try {
      return await this.imports.importTrades({
        ...parsedFile,
        importedById: request.user.id,
      });
    } catch (error: unknown) {
      mapDatasetMutationError(error);
    }
  }

  @Post("datasets/reset-sample")
  @HttpCode(200)
  async resetSampleData(
    @Body() body: unknown,
  ): Promise<DatasetMutationResponseDto> {
    parseResetConfirmation(body);

    try {
      return await this.imports.resetSampleData();
    } catch (error: unknown) {
      mapDatasetMutationError(error);
    }
  }

  @Post("datasets/clear-transactions")
  @HttpCode(200)
  async clearTransactions(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<DatasetMutationResponseDto> {
    parseResetConfirmation(body);

    try {
      return await this.imports.clearTransactions({
        importedById: request.user.id,
      });
    } catch (error: unknown) {
      mapDatasetMutationError(error);
    }
  }
}
