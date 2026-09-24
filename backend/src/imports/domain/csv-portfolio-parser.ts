import { financialDecimal } from "../../portfolio/domain";
import { calculatePortfolio } from "../../portfolio/domain";
import { PortfolioCalculationError } from "../../portfolio/domain";
import type {
  Exchange,
  PortfolioPrice,
  TradeSide,
} from "../../portfolio/domain";
import { parseCsvDocument, requiredColumnIndexes } from "./csv-parser";
import type { CsvRow } from "./csv-parser";
import type { ImportValidationIssue } from "./import-error";
import { ImportValidationError, throwIfIssues } from "./import-error";
import type {
  ParsedPrice,
  ParsedPriceSnapshot,
  ParsedTrade,
  ParsedTradeDataset,
  ValidatedImportPayload,
} from "./import-types";

const TRADE_COLUMNS = [
  "trade_id",
  "timestamp",
  "exchange",
  "symbol",
  "side",
  "quantity",
  "price_usd",
  "fee_usd",
] as const;

const PRICE_COLUMNS = ["as_of", "symbol", "price_usd"] as const;
const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;
const DECIMAL_PATTERN = /^[+-]?(?:\d+|\d+\.\d+|\.\d+)$/u;

function valueAt(
  row: CsvRow,
  indexes: ReadonlyMap<string, number>,
  field: string,
): string {
  const index = indexes.get(field);

  if (index === undefined) {
    throw new Error(`Column ${field} was not indexed`);
  }

  const value = row.values[index];

  if (value === undefined) {
    throw new Error(`Row ${row.rowNumber} is missing indexed column ${field}`);
  }

  return value.trim();
}

function parseUtcTimestamp(
  value: string,
  rowNumber: number,
  field: string,
  issues: ImportValidationIssue[],
): Date | undefined {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    issues.push({
      code: "INVALID_TIMESTAMP",
      rowNumber,
      field,
      message: `${field} must be a valid UTC ISO-8601 timestamp`,
    });
    return undefined;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    issues.push({
      code: "INVALID_TIMESTAMP",
      rowNumber,
      field,
      message: `${field} must be a valid UTC ISO-8601 timestamp`,
    });
    return undefined;
  }

  return timestamp;
}

function parseDecimalField(
  value: string,
  rowNumber: number,
  field: string,
  issues: ImportValidationIssue[],
) {
  if (!DECIMAL_PATTERN.test(value)) {
    issues.push({
      code: "INVALID_DECIMAL",
      rowNumber,
      field,
      message: `${field} must be a decimal string`,
    });
    return undefined;
  }

  return financialDecimal(value);
}

function parseExchange(
  value: string,
  rowNumber: number,
  issues: ImportValidationIssue[],
): Exchange | undefined {
  if (value === "Binance" || value === "Coinbase") {
    return value;
  }

  issues.push({
    code: "INVALID_EXCHANGE",
    rowNumber,
    field: "exchange",
    message: "exchange must be Binance or Coinbase",
  });
  return undefined;
}

function parseSide(
  value: string,
  rowNumber: number,
  issues: ImportValidationIssue[],
): TradeSide | undefined {
  if (value === "BUY" || value === "SELL") {
    return value;
  }

  issues.push({
    code: "INVALID_SIDE",
    rowNumber,
    field: "side",
    message: "side must be BUY or SELL",
  });
  return undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function parseTradeCsv(content: string): ParsedTradeDataset {
  const document = parseCsvDocument(content);
  const indexes = requiredColumnIndexes(document.headers, TRADE_COLUMNS);
  const issues: ImportValidationIssue[] = [];
  const seenTradeIds = new Map<string, number>();
  const trades: ParsedTrade[] = [];

  for (const row of document.rows) {
    const tradeId = valueAt(row, indexes, "trade_id");
    const symbol = valueAt(row, indexes, "symbol");
    const timestamp = parseUtcTimestamp(
      valueAt(row, indexes, "timestamp"),
      row.rowNumber,
      "timestamp",
      issues,
    );
    const exchange = parseExchange(
      valueAt(row, indexes, "exchange"),
      row.rowNumber,
      issues,
    );
    const side = parseSide(
      valueAt(row, indexes, "side"),
      row.rowNumber,
      issues,
    );
    const quantity = parseDecimalField(
      valueAt(row, indexes, "quantity"),
      row.rowNumber,
      "quantity",
      issues,
    );
    const priceUsd = parseDecimalField(
      valueAt(row, indexes, "price_usd"),
      row.rowNumber,
      "price_usd",
      issues,
    );
    const feeUsd = parseDecimalField(
      valueAt(row, indexes, "fee_usd"),
      row.rowNumber,
      "fee_usd",
      issues,
    );

    if (tradeId.length === 0) {
      issues.push({
        code: "EMPTY_TRADE_ID",
        rowNumber: row.rowNumber,
        field: "trade_id",
        message: "trade_id must not be empty",
      });
    } else {
      const firstRow = seenTradeIds.get(tradeId);

      if (firstRow === undefined) {
        seenTradeIds.set(tradeId, row.rowNumber);
      } else {
        issues.push({
          code: "DUPLICATE_TRADE_ID",
          rowNumber: row.rowNumber,
          field: "trade_id",
          tradeId,
          message: `trade_id duplicates row ${firstRow}`,
        });
      }
    }

    if (symbol.length === 0) {
      issues.push({
        code: "MISSING_SYMBOL_PRICE",
        rowNumber: row.rowNumber,
        field: "symbol",
        message: "symbol must not be empty",
      });
    }

    if (quantity?.lessThanOrEqualTo(0) === true) {
      issues.push({
        code: "INVALID_QUANTITY",
        rowNumber: row.rowNumber,
        field: "quantity",
        tradeId,
        message: "quantity must be greater than zero",
      });
    }

    if (priceUsd?.lessThanOrEqualTo(0) === true) {
      issues.push({
        code: "INVALID_PRICE",
        rowNumber: row.rowNumber,
        field: "price_usd",
        tradeId,
        message: "price_usd must be greater than zero",
      });
    }

    if (feeUsd?.lessThan(0) === true) {
      issues.push({
        code: "INVALID_FEE",
        rowNumber: row.rowNumber,
        field: "fee_usd",
        tradeId,
        message: "fee_usd must be greater than or equal to zero",
      });
    }

    if (
      tradeId.length > 0 &&
      symbol.length > 0 &&
      isDefined(timestamp) &&
      isDefined(exchange) &&
      isDefined(side) &&
      isDefined(quantity) &&
      isDefined(priceUsd) &&
      isDefined(feeUsd) &&
      quantity.greaterThan(0) &&
      priceUsd.greaterThan(0) &&
      feeUsd.greaterThanOrEqualTo(0)
    ) {
      trades.push({
        tradeId,
        sourceRowNumber: row.rowNumber,
        timestamp,
        exchange,
        symbol,
        side,
        quantity,
        priceUsd,
        feeUsd,
      });
    }
  }

  throwIfIssues(issues);

  return {
    trades,
    portfolioTrades: trades.map((trade) => ({
      tradeId: trade.tradeId,
      timestamp: trade.timestamp,
      exchange: trade.exchange,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      executionPrice: trade.priceUsd,
      fee: trade.feeUsd,
    })),
  };
}

export function parsePriceCsv(content: string): ParsedPriceSnapshot {
  const document = parseCsvDocument(content);
  const indexes = requiredColumnIndexes(document.headers, PRICE_COLUMNS);
  const issues: ImportValidationIssue[] = [];
  const seenSymbols = new Map<string, number>();
  const prices: ParsedPrice[] = [];
  let snapshotAsOf: Date | undefined;

  for (const row of document.rows) {
    const symbol = valueAt(row, indexes, "symbol");
    const asOf = parseUtcTimestamp(
      valueAt(row, indexes, "as_of"),
      row.rowNumber,
      "as_of",
      issues,
    );
    const priceUsd = parseDecimalField(
      valueAt(row, indexes, "price_usd"),
      row.rowNumber,
      "price_usd",
      issues,
    );

    if (symbol.length === 0) {
      issues.push({
        code: "MISSING_SYMBOL_PRICE",
        rowNumber: row.rowNumber,
        field: "symbol",
        message: "symbol must not be empty",
      });
    } else {
      const firstRow = seenSymbols.get(symbol);

      if (firstRow === undefined) {
        seenSymbols.set(symbol, row.rowNumber);
      } else {
        issues.push({
          code: "DUPLICATE_PRICE_SYMBOL",
          rowNumber: row.rowNumber,
          field: "symbol",
          symbol,
          message: `symbol duplicates row ${firstRow}`,
        });
      }
    }

    if (asOf !== undefined) {
      if (snapshotAsOf === undefined) {
        snapshotAsOf = asOf;
      } else if (snapshotAsOf.getTime() !== asOf.getTime()) {
        issues.push({
          code: "INVALID_TIMESTAMP",
          rowNumber: row.rowNumber,
          field: "as_of",
          message: "all price rows must use the same as_of timestamp",
        });
      }
    }

    if (priceUsd?.lessThanOrEqualTo(0) === true) {
      issues.push({
        code: "INVALID_PRICE",
        rowNumber: row.rowNumber,
        field: "price_usd",
        symbol,
        message: "price_usd must be greater than zero",
      });
    }

    if (
      symbol.length > 0 &&
      isDefined(asOf) &&
      isDefined(priceUsd) &&
      priceUsd.greaterThan(0)
    ) {
      prices.push({
        sourceRowNumber: row.rowNumber,
        asOf,
        symbol,
        priceUsd,
      });
    }
  }

  throwIfIssues(issues);

  if (snapshotAsOf === undefined) {
    throw new ImportValidationError([
      {
        code: "MALFORMED_CSV",
        rowNumber: 1,
        message: "price CSV must contain at least one data row",
      },
    ]);
  }

  return {
    asOf: snapshotAsOf,
    prices,
    portfolioPrices: prices.map((price) => ({
      symbol: price.symbol,
      priceUsd: price.priceUsd,
    })),
  };
}

export function validateTradesAgainstPrices(
  tradeDataset: ParsedTradeDataset,
  prices: readonly PortfolioPrice[],
): ValidatedImportPayload {
  const issues: ImportValidationIssue[] = [];
  const priceSymbols = new Set(prices.map(({ symbol }) => symbol));
  const rowByTradeId = new Map(
    tradeDataset.trades.map((trade) => [trade.tradeId, trade.sourceRowNumber]),
  );

  for (const trade of tradeDataset.trades) {
    if (!priceSymbols.has(trade.symbol)) {
      issues.push({
        code: "MISSING_SYMBOL_PRICE",
        rowNumber: trade.sourceRowNumber,
        field: "symbol",
        tradeId: trade.tradeId,
        symbol: trade.symbol,
        message: `No price is available for ${trade.symbol}`,
      });
    }
  }

  throwIfIssues(issues);

  try {
    const calculation = calculatePortfolio(
      tradeDataset.portfolioTrades,
      prices,
    );

    return {
      trades: tradeDataset.trades,
      prices,
      calculation,
    };
  } catch (error: unknown) {
    if (error instanceof PortfolioCalculationError) {
      const rowNumber =
        error.failure.code === "INSUFFICIENT_POSITION"
          ? rowByTradeId.get(error.failure.tradeId)
          : undefined;

      throw new ImportValidationError([
        error.failure.code === "INSUFFICIENT_POSITION"
          ? {
              code: "INSUFFICIENT_POSITION",
              ...(rowNumber === undefined ? {} : { rowNumber }),
              tradeId: error.failure.tradeId,
              symbol: error.failure.symbol,
              message: error.message,
            }
          : {
              code: "MISSING_SYMBOL_PRICE",
              symbol: error.failure.symbol,
              message: error.message,
            },
      ]);
    }

    throw error;
  }
}
