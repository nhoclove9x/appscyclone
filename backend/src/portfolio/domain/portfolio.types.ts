import type { FinancialDecimal } from "./decimal";

export type Exchange = "Binance" | "Coinbase";
export type TradeSide = "BUY" | "SELL";

export interface PortfolioTrade {
  readonly tradeId: string;
  readonly timestamp: Date;
  readonly exchange: Exchange;
  readonly symbol: string;
  readonly side: TradeSide;
  readonly quantity: FinancialDecimal;
  readonly executionPrice: FinancialDecimal;
  readonly fee: FinancialDecimal;
}

export interface PortfolioPrice {
  readonly symbol: string;
  readonly priceUsd: FinancialDecimal;
}

export interface SymbolPerformance {
  readonly symbol: string;
  readonly quantity: FinancialDecimal;
  readonly averageCost: FinancialDecimal;
  readonly remainingCostBasis: FinancialDecimal;
  readonly currentPrice: FinancialDecimal;
  readonly currentValue: FinancialDecimal;
  readonly realizedPL: FinancialDecimal;
  readonly unrealizedPL: FinancialDecimal;
  readonly totalPL: FinancialDecimal;
  readonly totalFees: FinancialDecimal;
  readonly allocation: FinancialDecimal;
}

export interface PortfolioTotals {
  readonly currentValue: FinancialDecimal;
  readonly remainingCostBasis: FinancialDecimal;
  readonly realizedPL: FinancialDecimal;
  readonly unrealizedPL: FinancialDecimal;
  readonly totalPL: FinancialDecimal;
  readonly totalFees: FinancialDecimal;
}

export interface PortfolioCalculation {
  /** Open positions only. */
  readonly holdings: readonly SymbolPerformance[];
  /** Every traded symbol, including fully closed positions. */
  readonly performance: readonly SymbolPerformance[];
  readonly totals: PortfolioTotals;
}
