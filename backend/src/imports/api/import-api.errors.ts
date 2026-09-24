import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import {
  DatasetLifecycleError,
  ImportValidationError,
} from "../domain";

export function invalidRequest(message: string): BadRequestException {
  return new BadRequestException({
    code: "INVALID_REQUEST",
    message,
  });
}

export function mapDatasetMutationError(error: unknown): never {
  if (error instanceof ImportValidationError) {
    throw new BadRequestException({
      code: error.code,
      message: error.message,
      issues: error.issues,
    });
  }

  if (error instanceof DatasetLifecycleError) {
    if (error.code === "DATASET_CHANGED") {
      throw new ConflictException({
        code: error.code,
        message: error.message,
      });
    }

    throw new NotFoundException({
      code: error.code,
      message: error.message,
    });
  }

  throw error;
}
