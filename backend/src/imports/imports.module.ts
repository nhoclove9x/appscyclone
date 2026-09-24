import { Module } from "@nestjs/common";

import { AuthModule } from "../auth";
import { DatabaseModule } from "../database/database.module";
import { DatasetLifecycleService } from "./application/dataset-lifecycle.service";
import { SampleDataService } from "./application/sample-data.service";
import { ImportsController } from "./api/imports.controller";
import { ImportsApiService } from "./api/imports-api.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ImportsController],
  providers: [DatasetLifecycleService, SampleDataService, ImportsApiService],
  exports: [DatasetLifecycleService],
})
export class ImportsModule {}
