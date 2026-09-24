import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ImportValidationError,
  parsePriceCsv,
  parseTradeCsv,
  validateTradesAgainstPrices,
} from "../../src/imports/domain";

const docsDirectory = path.resolve(__dirname, "../../../docs");
const tradeHeader =
  "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd";
const priceHeader = "as_of,symbol,price_usd";

function issueCodes(error: unknown): string[] {
  expect(error).toBeInstanceOf(ImportValidationError);
  return (error as ImportValidationError).issues.map(({ code }) => code);
}

function tradeCsv(row: string): string {
  return `${tradeHeader}\n${row}\n`;
}

function priceCsv(row: string): string {
  return `${priceHeader}\n${row}\n`;
}

describe("CSV import parsing and validation", () => {
  it("parses the supplied trade CSV", () => {
    const parsed = parseTradeCsv(
      readFileSync(path.join(docsDirectory, "trades.csv"), "utf8"),
    );

    expect(parsed.trades).toHaveLength(200);
    expect(parsed.trades[0]).toEqual(
      expect.objectContaining({
        tradeId: "TRD-0001",
        sourceRowNumber: 2,
        exchange: "Binance",
        symbol: "BTC",
        side: "BUY",
      }),
    );
  });

  it("parses the supplied price CSV", () => {
    const parsed = parsePriceCsv(
      readFileSync(path.join(docsDirectory, "prices.csv"), "utf8"),
    );

    expect(parsed.prices).toHaveLength(5);
    expect(parsed.asOf.toISOString()).toBe("2026-03-31T23:59:59.000Z");
  });

  it("rejects a missing required trade column", () => {
    expect(() =>
      parseTradeCsv(
        "trade_id,timestamp,exchange,symbol,side,quantity,fee_usd\nT1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,0\n",
      ),
    ).toThrow(ImportValidationError);
  });

  it("rejects malformed CSV quoting", () => {
    expect(() =>
      parseTradeCsv(`${tradeHeader}\n"T1,2026-01-01T00:00:00Z\n`),
    ).toThrow(ImportValidationError);
  });

  it("rejects an empty trade ID", () => {
    expect(() =>
      parseTradeCsv(tradeCsv(",2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0")),
    ).toThrow(ImportValidationError);
  });

  it("rejects duplicate trade IDs inside one imported dataset", () => {
    expect(() =>
      parseTradeCsv(
        `${tradeHeader}\nT1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0\nT1,2026-01-02T00:00:00Z,Coinbase,BTC,BUY,1,100,0\n`,
      ),
    ).toThrow(ImportValidationError);
  });

  it("rejects invalid timestamps", () => {
    expect(() =>
      parseTradeCsv(tradeCsv("T1,2026-01-01 00:00:00,Binance,BTC,BUY,1,100,0")),
    ).toThrow(ImportValidationError);
  });

  it("rejects invalid exchange and side values", () => {
    try {
      parseTradeCsv(
        tradeCsv("T1,2026-01-01T00:00:00Z,Kraken,BTC,HOLD,1,100,0"),
      );
      throw new Error("Expected parseTradeCsv to fail");
    } catch (error: unknown) {
      expect(issueCodes(error)).toEqual(
        expect.arrayContaining(["INVALID_EXCHANGE", "INVALID_SIDE"]),
      );
    }
  });

  it("rejects invalid Decimal syntax without parsing through number", () => {
    expect(() =>
      parseTradeCsv(
        tradeCsv("T1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1e-3,100,0"),
      ),
    ).toThrow(ImportValidationError);
  });

  it("rejects invalid quantity, trade price, and fee bounds", () => {
    try {
      parseTradeCsv(
        `${tradeHeader}\nT1,2026-01-01T00:00:00Z,Binance,BTC,BUY,0,100,0\nT2,2026-01-02T00:00:00Z,Binance,BTC,BUY,1,0,0\nT3,2026-01-03T00:00:00Z,Binance,BTC,BUY,1,100,-0.01\n`,
      );
      throw new Error("Expected parseTradeCsv to fail");
    } catch (error: unknown) {
      expect(issueCodes(error)).toEqual(
        expect.arrayContaining([
          "INVALID_QUANTITY",
          "INVALID_PRICE",
          "INVALID_FEE",
        ]),
      );
    }
  });

  it("rejects duplicate price symbols", () => {
    expect(() =>
      parsePriceCsv(
        `${priceHeader}\n2026-03-31T23:59:59Z,BTC,100\n2026-03-31T23:59:59Z,BTC,101\n`,
      ),
    ).toThrow(ImportValidationError);
  });

  it("rejects zero and negative prices", () => {
    try {
      parsePriceCsv(
        `${priceHeader}\n2026-03-31T23:59:59Z,BTC,0\n2026-03-31T23:59:59Z,ETH,-1\n`,
      );
      throw new Error("Expected parsePriceCsv to fail");
    } catch (error: unknown) {
      expect(issueCodes(error)).toEqual(["INVALID_PRICE", "INVALID_PRICE"]);
    }
  });

  it("rejects a traded symbol absent from the price snapshot", () => {
    const trades = parseTradeCsv(
      tradeCsv("T1,2026-01-01T00:00:00Z,Binance,XRP,BUY,1,100,0"),
    );
    const prices = parsePriceCsv(priceCsv("2026-03-31T23:59:59Z,BTC,100"));

    expect(() =>
      validateTradesAgainstPrices(trades, prices.portfolioPrices),
    ).toThrow(ImportValidationError);
  });

  it("accepts a dynamic non-sample symbol when the price snapshot contains it", () => {
    const trades = parseTradeCsv(
      tradeCsv("T1,2026-01-01T00:00:00Z,Binance,XRP,BUY,2.5,0.50,0.01"),
    );
    const prices = parsePriceCsv(priceCsv("2026-03-31T23:59:59Z,XRP,0.60"));
    const validated = validateTradesAgainstPrices(
      trades,
      prices.portfolioPrices,
    );

    expect(validated.calculation.holdings).toEqual([
      expect.objectContaining({ symbol: "XRP" }),
    ]);
  });

  it("maps short-position calculator failures to import validation issues", () => {
    const trades = parseTradeCsv(
      tradeCsv("T1,2026-01-01T00:00:00Z,Binance,BTC,SELL,1,100,0"),
    );
    const prices = parsePriceCsv(priceCsv("2026-03-31T23:59:59Z,BTC,100"));

    try {
      validateTradesAgainstPrices(trades, prices.portfolioPrices);
      throw new Error("Expected validation to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ImportValidationError);
      expect((error as ImportValidationError).issues).toEqual([
        expect.objectContaining({
          code: "INSUFFICIENT_POSITION",
          rowNumber: 2,
          tradeId: "T1",
          symbol: "BTC",
        }),
      ]);
    }
  });
});
