import { readFileSync } from "node:fs";
import path from "node:path";

import { financialDecimal } from "../../src/portfolio/domain/decimal";
import type {
  Exchange,
  PortfolioPrice,
  PortfolioTrade,
  TradeSide,
} from "../../src/portfolio/domain/portfolio.types";

const DATA_DIRECTORY = path.resolve(__dirname, "../../../docs");

function linesFrom(filename: string, expectedHeader: string): string[] {
  const content = readFileSync(path.join(DATA_DIRECTORY, filename), "utf8");
  const [header, ...lines] = content.trim().split(/\r?\n/u);

  if (header !== expectedHeader) {
    throw new Error(`Unexpected ${filename} fixture header`);
  }

  return lines;
}

function columnsFrom(line: string, expectedCount: number): string[] {
  const columns = line.split(",");

  if (columns.length !== expectedCount) {
    throw new Error(`Unexpected fixture column count: ${line}`);
  }

  return columns;
}

function column(columns: readonly string[], index: number): string {
  const value = columns[index];

  if (value === undefined) {
    throw new Error(`Missing fixture column ${index}`);
  }

  return value;
}

function exchangeFrom(value: string): Exchange {
  if (value === "Binance" || value === "Coinbase") {
    return value;
  }

  throw new Error(`Unexpected fixture exchange: ${value}`);
}

function sideFrom(value: string): TradeSide {
  if (value === "BUY" || value === "SELL") {
    return value;
  }

  throw new Error(`Unexpected fixture side: ${value}`);
}

export function suppliedTrades(): PortfolioTrade[] {
  return linesFrom(
    "trades.csv",
    "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd",
  ).map((line) => {
    const columns = columnsFrom(line, 8);

    return {
      tradeId: column(columns, 0),
      timestamp: new Date(column(columns, 1)),
      exchange: exchangeFrom(column(columns, 2)),
      symbol: column(columns, 3),
      side: sideFrom(column(columns, 4)),
      quantity: financialDecimal(column(columns, 5)),
      executionPrice: financialDecimal(column(columns, 6)),
      fee: financialDecimal(column(columns, 7)),
    };
  });
}

export function suppliedPrices(): PortfolioPrice[] {
  return linesFrom("prices.csv", "as_of,symbol,price_usd").map((line) => {
    const columns = columnsFrom(line, 3);

    return {
      symbol: column(columns, 1),
      priceUsd: financialDecimal(column(columns, 2)),
    };
  });
}
