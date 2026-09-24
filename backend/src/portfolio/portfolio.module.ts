import { Module } from "@nestjs/common";

import { AuthModule } from "../auth";
import { DatabaseModule } from "../database/database.module";
import { PortfolioReadService } from "./application/portfolio-read.service";
import { PortfolioController } from "./api/portfolio.controller";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [PortfolioController],
  providers: [PortfolioReadService],
})
export class PortfolioModule {}
