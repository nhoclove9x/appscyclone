import { calculatePortfolio } from "./calculate-portfolio";
import { financialDecimal } from "./decimal";
import type { FinancialDecimal } from "./decimal";
import { PortfolioCalculationError } from "./portfolio-calculation.error";
import type {
  Exchange,
  PortfolioPrice,
  PortfolioTrade,
  SymbolPerformance,
  TradeSide,
} from "./portfolio.types";

interface TradeInput {
  readonly tradeId: string;
  readonly side: TradeSide;
  readonly quantity: string;
  readonly executionPrice: string;
  readonly timestamp?: string;
  readonly exchange?: Exchange;
  readonly symbol?: string;
  readonly fee?: string;
}

function trade(input: TradeInput): PortfolioTrade {
  return {
    tradeId: input.tradeId,
    timestamp: new Date(input.timestamp ?? "2026-01-01T00:00:00Z"),
    exchange: input.exchange ?? "Binance",
    symbol: input.symbol ?? "XRP",
    side: input.side,
    quantity: financialDecimal(input.quantity),
    executionPrice: financialDecimal(input.executionPrice),
    fee: financialDecimal(input.fee ?? "0"),
  };
}

function price(symbol = "XRP", priceUsd = "1"): PortfolioPrice {
  return { symbol, priceUsd: financialDecimal(priceUsd) };
}

function performanceFor(
  values: readonly SymbolPerformance[],
  symbol = "XRP",
): SymbolPerformance {
  const value = values.find((candidate) => candidate.symbol === symbol);

  if (value === undefined) {
    throw new Error(`Expected performance for ${symbol}`);
  }

  return value;
}

function expectDecimal(actual: FinancialDecimal, expected: string): void {
  expect(actual.toFixed()).toBe(expected);
}

function captureCalculationError(
  action: () => void,
): PortfolioCalculationError {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(PortfolioCalculationError);

    if (error instanceof PortfolioCalculationError) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected portfolio calculation to fail");
}

describe("calculatePortfolio", () => {
  describe("BUY behavior", () => {
    it("calculates one BUY for a dynamic symbol", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-1",
            side: "BUY",
            quantity: "2",
            executionPrice: "10",
            fee: "1",
          }),
        ],
        [price("XRP", "12")],
      );
      const holding = performanceFor(result.holdings);

      expectDecimal(holding.quantity, "2");
      expectDecimal(holding.remainingCostBasis, "21");
      expectDecimal(holding.averageCost, "10.5");
      expectDecimal(holding.currentValue, "24");
      expectDecimal(holding.unrealizedPL, "3");
      expectDecimal(holding.totalFees, "1");
      expectDecimal(holding.allocation, "1");
    });

    it("uses a weighted average across multiple BUY prices", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-1",
            side: "BUY",
            quantity: "2",
            executionPrice: "10",
          }),
          trade({
            tradeId: "buy-2",
            side: "BUY",
            quantity: "1",
            executionPrice: "16",
            fee: "1",
          }),
        ],
        [price()],
      );
      const holding = performanceFor(result.holdings);

      expectDecimal(holding.quantity, "3");
      expectDecimal(holding.remainingCostBasis, "37");
      expect(
        holding.averageCost.equals(financialDecimal("37").dividedBy("3")),
      ).toBe(true);
    });

    it("capitalizes BUY fees into cost basis", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-1",
            side: "BUY",
            quantity: "0.5",
            executionPrice: "20",
            fee: "0.25",
          }),
        ],
        [price()],
      );
      const holding = performanceFor(result.holdings);

      expectDecimal(holding.remainingCostBasis, "10.25");
      expectDecimal(holding.averageCost, "20.5");
    });
  });

  describe("SELL behavior", () => {
    it("preserves average cost after a partial sale and deducts the SELL fee once", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-1",
            side: "BUY",
            quantity: "2",
            executionPrice: "10",
          }),
          trade({
            tradeId: "sell-1",
            side: "SELL",
            quantity: "0.5",
            executionPrice: "15",
            fee: "1",
            timestamp: "2026-01-02T00:00:00Z",
          }),
        ],
        [price()],
      );
      const holding = performanceFor(result.holdings);

      expectDecimal(holding.quantity, "1.5");
      expectDecimal(holding.averageCost, "10");
      expectDecimal(holding.remainingCostBasis, "15");
      expectDecimal(holding.realizedPL, "1.5");
      expectDecimal(holding.totalFees, "1");
    });

    it("normalizes quantity, basis, and average cost after an exact full close", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-1",
            side: "BUY",
            quantity: "0.3",
            executionPrice: "0.1",
            fee: "0.01",
          }),
          trade({
            tradeId: "sell-1",
            side: "SELL",
            quantity: "0.3",
            executionPrice: "0.2",
            timestamp: "2026-01-02T00:00:00Z",
          }),
        ],
        [price()],
      );
      const closed = performanceFor(result.performance);

      expect(result.holdings).toHaveLength(0);
      expect(closed.quantity.isZero()).toBe(true);
      expect(closed.remainingCostBasis.isZero()).toBe(true);
      expect(closed.averageCost.isZero()).toBe(true);
      expectDecimal(closed.realizedPL, "0.02");
    });

    it("rejects a sale that would create a short position", () => {
      const error = captureCalculationError(() =>
        calculatePortfolio(
          [
            trade({
              tradeId: "buy-1",
              side: "BUY",
              quantity: "1",
              executionPrice: "10",
            }),
            trade({
              tradeId: "sell-1",
              side: "SELL",
              quantity: "1.00000001",
              executionPrice: "12",
              timestamp: "2026-01-02T00:00:00Z",
            }),
          ],
          [price()],
        ),
      );

      expect(error.failure).toEqual({
        code: "INSUFFICIENT_POSITION",
        symbol: "XRP",
        tradeId: "sell-1",
        availableQuantity: "1",
        requestedQuantity: "1.00000001",
      });
    });

    it("rejects a sale from a zero position", () => {
      const error = captureCalculationError(() =>
        calculatePortfolio(
          [
            trade({
              tradeId: "sell-1",
              side: "SELL",
              quantity: "1",
              executionPrice: "12",
            }),
          ],
          [price()],
        ),
      );

      expect(error.code).toBe("INSUFFICIENT_POSITION");
      expect(error.failure).toEqual(
        expect.objectContaining({ availableQuantity: "0" }),
      );
    });
  });

  describe("position lifecycle", () => {
    it("retains realized P&L when a fully closed position is reopened", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-1",
            side: "BUY",
            quantity: "2",
            executionPrice: "10",
            fee: "2",
          }),
          trade({
            tradeId: "sell-1",
            side: "SELL",
            quantity: "2",
            executionPrice: "15",
            fee: "1",
            timestamp: "2026-01-02T00:00:00Z",
          }),
          trade({
            tradeId: "buy-2",
            side: "BUY",
            quantity: "1",
            executionPrice: "4",
            fee: "0.5",
            timestamp: "2026-01-03T00:00:00Z",
          }),
        ],
        [price()],
      );
      const reopened = performanceFor(result.holdings);

      expectDecimal(reopened.quantity, "1");
      expectDecimal(reopened.remainingCostBasis, "4.5");
      expectDecimal(reopened.averageCost, "4.5");
      expectDecimal(reopened.realizedPL, "7");
      expectDecimal(reopened.totalFees, "3.5");
    });
  });

  describe("aggregation and ordering", () => {
    it("aggregates trades for one symbol across exchanges", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-binance",
            side: "BUY",
            quantity: "1",
            executionPrice: "10",
            exchange: "Binance",
          }),
          trade({
            tradeId: "buy-coinbase",
            side: "BUY",
            quantity: "1",
            executionPrice: "20",
            exchange: "Coinbase",
            timestamp: "2026-01-02T00:00:00Z",
          }),
          trade({
            tradeId: "sell-binance",
            side: "SELL",
            quantity: "1",
            executionPrice: "30",
            exchange: "Binance",
            timestamp: "2026-01-03T00:00:00Z",
          }),
        ],
        [price()],
      );
      const holding = performanceFor(result.holdings);

      expect(result.performance).toHaveLength(1);
      expectDecimal(holding.quantity, "1");
      expectDecimal(holding.averageCost, "15");
      expectDecimal(holding.remainingCostBasis, "15");
      expectDecimal(holding.realizedPL, "15");
    });

    it("orders trades by timestamp instead of input-array order", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "sell-later",
            side: "SELL",
            quantity: "1",
            executionPrice: "12",
            timestamp: "2026-01-02T00:00:00Z",
          }),
          trade({
            tradeId: "buy-earlier",
            side: "BUY",
            quantity: "1",
            executionPrice: "10",
            timestamp: "2026-01-01T00:00:00Z",
          }),
        ],
        [price()],
      );

      expectDecimal(performanceFor(result.performance).realizedPL, "2");
    });

    it("orders equal-timestamp trades by trade ID", () => {
      const timestamp = "2026-01-01T00:00:00Z";
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "B-sell",
            side: "SELL",
            quantity: "1",
            executionPrice: "15",
            timestamp,
          }),
          trade({
            tradeId: "A-buy",
            side: "BUY",
            quantity: "1",
            executionPrice: "10",
            timestamp,
          }),
        ],
        [price()],
      );
      const closed = performanceFor(result.performance);

      expect(result.holdings).toHaveLength(0);
      expectDecimal(closed.realizedPL, "5");
    });
  });

  describe("valuation and totals", () => {
    it("fails deterministically when a traded symbol has no price", () => {
      const error = captureCalculationError(() =>
        calculatePortfolio(
          [
            trade({
              tradeId: "buy-1",
              side: "BUY",
              quantity: "1",
              executionPrice: "10",
            }),
          ],
          [],
        ),
      );

      expect(error.failure).toEqual({ code: "MISSING_PRICE", symbol: "XRP" });
    });

    it("keeps a closed symbol in performance but not current holdings", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "buy-1",
            side: "BUY",
            quantity: "1",
            executionPrice: "10",
            fee: "0.1",
          }),
          trade({
            tradeId: "sell-1",
            side: "SELL",
            quantity: "1",
            executionPrice: "12",
            fee: "0.2",
            timestamp: "2026-01-02T00:00:00Z",
          }),
        ],
        [price()],
      );
      const closed = performanceFor(result.performance);

      expect(result.holdings).toEqual([]);
      expectDecimal(closed.totalFees, "0.3");
      expectDecimal(closed.realizedPL, "1.7");
      expectDecimal(closed.allocation, "0");
      expectDecimal(result.totals.currentValue, "0");
      expectDecimal(result.totals.remainingCostBasis, "0");
      expectDecimal(result.totals.unrealizedPL, "0");
      expectDecimal(result.totals.realizedPL, "1.7");
      expectDecimal(result.totals.totalPL, "1.7");
      expectDecimal(result.totals.totalFees, "0.3");
    });

    it("returns safe zero totals and allocations for an empty portfolio", () => {
      const result = calculatePortfolio([], []);

      expect(result.holdings).toEqual([]);
      expect(result.performance).toEqual([]);
      expectDecimal(result.totals.currentValue, "0");
      expectDecimal(result.totals.totalPL, "0");
      expectDecimal(result.totals.totalFees, "0");
    });

    it("calculates allocation from unrounded current values", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "xrp-buy",
            side: "BUY",
            symbol: "XRP",
            quantity: "2",
            executionPrice: "1",
          }),
          trade({
            tradeId: "ada-buy",
            side: "BUY",
            symbol: "ADA",
            quantity: "1",
            executionPrice: "1",
          }),
        ],
        [price("XRP", "3"), price("ADA", "4")],
      );

      expectDecimal(result.totals.currentValue, "10");
      expectDecimal(performanceFor(result.holdings, "XRP").allocation, "0.6");
      expectDecimal(performanceFor(result.holdings, "ADA").allocation, "0.4");
    });

    it("keeps decimal arithmetic exact without JavaScript floating point", () => {
      const result = calculatePortfolio(
        [
          trade({
            tradeId: "precision-buy",
            side: "BUY",
            quantity: "0.1",
            executionPrice: "0.2",
            fee: "0.03",
          }),
        ],
        [price("XRP", "0.3")],
      );
      const holding = performanceFor(result.holdings);

      expectDecimal(holding.remainingCostBasis, "0.05");
      expectDecimal(holding.currentValue, "0.03");
      expectDecimal(holding.unrealizedPL, "-0.02");
      expectDecimal(result.totals.totalPL, "-0.02");
    });
  });
});
