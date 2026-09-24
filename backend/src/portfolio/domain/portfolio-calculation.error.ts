export type PortfolioCalculationFailure =
  | {
      readonly code: "INSUFFICIENT_POSITION";
      readonly symbol: string;
      readonly tradeId: string;
      readonly availableQuantity: string;
      readonly requestedQuantity: string;
    }
  | {
      readonly code: "MISSING_PRICE";
      readonly symbol: string;
    };

function failureMessage(failure: PortfolioCalculationFailure): string {
  switch (failure.code) {
    case "INSUFFICIENT_POSITION":
      return `Trade ${failure.tradeId} would create a short position for ${failure.symbol}`;
    case "MISSING_PRICE":
      return `No current price is available for ${failure.symbol}`;
    default: {
      const unsupportedFailure: never = failure;
      throw new Error(
        `Unsupported portfolio failure: ${JSON.stringify(unsupportedFailure)}`,
      );
    }
  }
}

export class PortfolioCalculationError extends Error {
  readonly code: PortfolioCalculationFailure["code"];
  readonly failure: PortfolioCalculationFailure;

  constructor(failure: PortfolioCalculationFailure) {
    super(failureMessage(failure));
    this.name = "PortfolioCalculationError";
    this.code = failure.code;
    this.failure = failure;
  }
}
