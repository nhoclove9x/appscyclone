import { financialDecimal } from "./decimal";
import type { FinancialDecimal } from "./decimal";
import { PortfolioCalculationError } from "./portfolio-calculation.error";
import type {
  PortfolioCalculation,
  PortfolioPrice,
  PortfolioTotals,
  PortfolioTrade,
  SymbolPerformance,
} from "./portfolio.types";

interface PositionState {
  readonly symbol: string;
  readonly quantity: FinancialDecimal;
  readonly averageCost: FinancialDecimal;
  readonly costBasis: FinancialDecimal;
  readonly realizedPL: FinancialDecimal;
  readonly totalFees: FinancialDecimal;
}

const ZERO = financialDecimal("0");

function emptyPosition(symbol: string): PositionState {
  return {
    symbol,
    quantity: ZERO,
    averageCost: ZERO,
    costBasis: ZERO,
    realizedPL: ZERO,
    totalFees: ZERO,
  };
}

function compareTrades(left: PortfolioTrade, right: PortfolioTrade): number {
  const timestampDifference =
    left.timestamp.getTime() - right.timestamp.getTime();

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  if (left.tradeId < right.tradeId) {
    return -1;
  }

  if (left.tradeId > right.tradeId) {
    return 1;
  }

  return 0;
}

function applyBuy(
  position: PositionState,
  trade: PortfolioTrade,
): PositionState {
  const quantity = financialDecimal(trade.quantity);
  const executionPrice = financialDecimal(trade.executionPrice);
  const fee = financialDecimal(trade.fee);
  const newQuantity = position.quantity.plus(quantity);
  const costAdded = quantity.times(executionPrice).plus(fee);
  const newCostBasis = position.costBasis.plus(costAdded);

  return {
    ...position,
    quantity: newQuantity,
    averageCost: newCostBasis.dividedBy(newQuantity),
    costBasis: newCostBasis,
    totalFees: position.totalFees.plus(fee),
  };
}

function applySell(
  position: PositionState,
  trade: PortfolioTrade,
): PositionState {
  const quantity = financialDecimal(trade.quantity);

  if (position.quantity.lessThan(quantity)) {
    throw new PortfolioCalculationError({
      code: "INSUFFICIENT_POSITION",
      symbol: trade.symbol,
      tradeId: trade.tradeId,
      availableQuantity: position.quantity.toFixed(),
      requestedQuantity: quantity.toFixed(),
    });
  }

  const executionPrice = financialDecimal(trade.executionPrice);
  const fee = financialDecimal(trade.fee);
  const netProceeds = quantity.times(executionPrice).minus(fee);
  const newQuantity = position.quantity.minus(quantity);
  const isFullClose = newQuantity.isZero();
  const costRemoved = isFullClose
    ? position.costBasis
    : position.averageCost.times(quantity);
  const saleRealizedPL = netProceeds.minus(costRemoved);
  const newRealizedPL = position.realizedPL.plus(saleRealizedPL);
  const newTotalFees = position.totalFees.plus(fee);

  if (isFullClose) {
    return {
      ...position,
      quantity: ZERO,
      averageCost: ZERO,
      costBasis: ZERO,
      realizedPL: newRealizedPL,
      totalFees: newTotalFees,
    };
  }

  return {
    ...position,
    quantity: newQuantity,
    averageCost: position.averageCost,
    costBasis: position.costBasis.minus(costRemoved),
    realizedPL: newRealizedPL,
    totalFees: newTotalFees,
  };
}

function processTrades(
  trades: readonly PortfolioTrade[],
): ReadonlyMap<string, PositionState> {
  const positions = new Map<string, PositionState>();
  const orderedTrades = [...trades].sort(compareTrades);

  for (const trade of orderedTrades) {
    const position = positions.get(trade.symbol) ?? emptyPosition(trade.symbol);
    let nextPosition: PositionState;

    switch (trade.side) {
      case "BUY":
        nextPosition = applyBuy(position, trade);
        break;
      case "SELL":
        nextPosition = applySell(position, trade);
        break;
      default: {
        const unsupportedSide: never = trade.side;
        throw new Error(`Unsupported trade side: ${String(unsupportedSide)}`);
      }
    }

    positions.set(trade.symbol, nextPosition);
  }

  return positions;
}

function indexPrices(
  prices: readonly PortfolioPrice[],
): ReadonlyMap<string, FinancialDecimal> {
  return new Map(
    prices.map(({ symbol, priceUsd }) => [symbol, financialDecimal(priceUsd)]),
  );
}

function priceFor(
  symbol: string,
  prices: ReadonlyMap<string, FinancialDecimal>,
): FinancialDecimal {
  const price = prices.get(symbol);

  if (price === undefined) {
    throw new PortfolioCalculationError({ code: "MISSING_PRICE", symbol });
  }

  return price;
}

function valuePositions(
  positions: ReadonlyMap<string, PositionState>,
  prices: ReadonlyMap<string, FinancialDecimal>,
): SymbolPerformance[] {
  return [...positions.values()]
    .sort((left, right) =>
      left.symbol < right.symbol ? -1 : left.symbol > right.symbol ? 1 : 0,
    )
    .map((position) => {
      const currentPrice = priceFor(position.symbol, prices);
      const currentValue = position.quantity.times(currentPrice);
      const unrealizedPL = currentValue.minus(position.costBasis);

      return {
        symbol: position.symbol,
        quantity: position.quantity,
        averageCost: position.averageCost,
        remainingCostBasis: position.costBasis,
        currentPrice,
        currentValue,
        realizedPL: position.realizedPL,
        unrealizedPL,
        totalPL: position.realizedPL.plus(unrealizedPL),
        totalFees: position.totalFees,
        allocation: ZERO,
      };
    });
}

function sum(
  performance: readonly SymbolPerformance[],
  select: (value: SymbolPerformance) => FinancialDecimal,
): FinancialDecimal {
  return performance.reduce((total, value) => total.plus(select(value)), ZERO);
}

function calculateTotals(
  performance: readonly SymbolPerformance[],
): PortfolioTotals {
  const realizedPL = sum(performance, ({ realizedPL: value }) => value);
  const unrealizedPL = sum(performance, ({ unrealizedPL: value }) => value);

  return {
    currentValue: sum(performance, ({ currentValue }) => currentValue),
    remainingCostBasis: sum(
      performance,
      ({ remainingCostBasis }) => remainingCostBasis,
    ),
    realizedPL,
    unrealizedPL,
    totalPL: realizedPL.plus(unrealizedPL),
    totalFees: sum(performance, ({ totalFees }) => totalFees),
  };
}

function applyAllocations(
  performance: readonly SymbolPerformance[],
  totalCurrentValue: FinancialDecimal,
): SymbolPerformance[] {
  return performance.map((value) => ({
    ...value,
    allocation: totalCurrentValue.isZero()
      ? ZERO
      : value.currentValue.dividedBy(totalCurrentValue),
  }));
}

/**
 * Calculates a portfolio from already validated domain values. Callers must
 * provide valid timestamps, unique trade IDs, positive quantities/prices,
 * non-negative fees, and unique symbol prices.
 */
export function calculatePortfolio(
  trades: readonly PortfolioTrade[],
  prices: readonly PortfolioPrice[],
): PortfolioCalculation {
  const positions = processTrades(trades);
  const valuedPositions = valuePositions(positions, indexPrices(prices));
  const totals = calculateTotals(valuedPositions);
  const performance = applyAllocations(valuedPositions, totals.currentValue);
  const holdings = performance.filter(({ quantity }) =>
    quantity.greaterThan(0),
  );

  return { holdings, performance, totals };
}
