import type { FinancialDecimal } from "../../portfolio/domain";
import type {
  Exchange,
  PortfolioCalculation,
  PortfolioPrice,
  PortfolioTrade,
  TradeSide,
} from "../../portfolio/domain";

export interface ParsedTrade {
  readonly tradeId: string;
  readonly sourceRowNumber: number;
  readonly timestamp: Date;
  readonly exchange: Exchange;
  readonly symbol: string;
  readonly side: TradeSide;
  readonly quantity: FinancialDecimal;
  readonly priceUsd: FinancialDecimal;
  readonly feeUsd: FinancialDecimal;
}

export interface ParsedPrice {
  readonly sourceRowNumber: number;
  readonly asOf: Date;
  readonly symbol: string;
  readonly priceUsd: FinancialDecimal;
}

export interface ParsedTradeDataset {
  readonly trades: readonly ParsedTrade[];
  readonly portfolioTrades: readonly PortfolioTrade[];
}

export interface ParsedPriceSnapshot {
  readonly asOf: Date;
  readonly prices: readonly ParsedPrice[];
  readonly portfolioPrices: readonly PortfolioPrice[];
}

export interface ValidatedImportPayload {
  readonly trades: readonly ParsedTrade[];
  readonly prices: readonly PortfolioPrice[];
  readonly calculation: PortfolioCalculation;
}
