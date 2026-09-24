import Decimal from "decimal.js";

/**
 * Domain-scoped Decimal constructor. The high precision protects intermediate
 * weighted-average divisions while avoiding mutation of decimal.js global
 * configuration shared by other modules.
 */
const PortfolioDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -1_000,
  toExpPos: 1_000,
});

export type FinancialDecimal = Decimal;
export type FinancialDecimalInput = string | FinancialDecimal;

export function financialDecimal(
  value: FinancialDecimalInput,
): FinancialDecimal {
  return new PortfolioDecimal(value);
}
