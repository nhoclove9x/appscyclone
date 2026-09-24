import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../../auth";
import { PortfolioReadService } from "../application/portfolio-read.service";
import type {
  PortfolioResponseDto,
  TransactionsResponseDto,
} from "./portfolio-api.types";
import { parseTransactionQuery } from "./query-parser";

@Controller()
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioReadService) {}

  @Get("portfolio")
  getPortfolio(): Promise<PortfolioResponseDto> {
    return this.portfolio.getPortfolio();
  }

  @Get("transactions")
  getTransactions(
    @Query() query: Record<string, unknown>,
  ): Promise<TransactionsResponseDto> {
    return this.portfolio.getTransactions(parseTransactionQuery(query));
  }
}
