import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { DatasetLifecycleService } from "./application/dataset-lifecycle.service";
import { SampleDataService } from "./application/sample-data.service";

@Module({
  imports: [DatabaseModule],
  providers: [DatasetLifecycleService, SampleDataService],
  exports: [DatasetLifecycleService],
})
export class ImportsModule {}
