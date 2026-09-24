import { calculatePortfolio } from "../../src/portfolio/domain/calculate-portfolio";
import type { FinancialDecimal } from "../../src/portfolio/domain/decimal";
import { suppliedPrices, suppliedTrades } from "./supplied-data.fixture";

function displayUsd(value: FinancialDecimal): string {
  return value.toDecimalPlaces(2).toFixed(2);
}

describe("supplied portfolio data", () => {
  it("matches the accepted display-rounded portfolio regression values", () => {
    const result = calculatePortfolio(suppliedTrades(), suppliedPrices());

    expect(result.holdings.map(({ symbol }) => symbol)).toEqual([
      "BTC",
      "CKB",
      "DOGE",
      "ETH",
      "SOL",
    ]);
    expect(result.performance).toHaveLength(5);

    expect(displayUsd(result.totals.currentValue)).toBe("60620.89");
    expect(displayUsd(result.totals.remainingCostBasis)).toBe("59969.24");
    expect(displayUsd(result.totals.realizedPL)).toBe("-5052.96");
    expect(displayUsd(result.totals.unrealizedPL)).toBe("651.65");
    expect(displayUsd(result.totals.totalPL)).toBe("-4401.31");
    expect(displayUsd(result.totals.totalFees)).toBe("2708.86");

    expect(result.totals.currentValue.toFixed()).toBe("60620.89161");
    expect(result.totals.totalFees.toFixed()).toBe("2708.86");
    expect(
      result.totals.totalPL.equals(
        result.totals.realizedPL.plus(result.totals.unrealizedPL),
      ),
    ).toBe(true);
  });
});
