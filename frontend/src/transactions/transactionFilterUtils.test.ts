import { describe, expect, it } from "vitest";

import {
  apiUtcToInput,
  filtersFromSearchParams,
  searchParamsFromFilters,
  utcInputToApi,
} from "./transactionFilterUtils";

describe("transaction filter URL state", () => {
  it("parses supported transaction filters from search params", () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams(
        "symbol=BTC&exchange=Binance&side=BUY&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&sort=DESC&page=2&pageSize=100",
      ),
    );

    expect(filters).toEqual({
      symbol: "BTC",
      exchange: "Binance",
      side: "BUY",
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-02T00:00:00Z",
      sort: "DESC",
      page: 2,
      pageSize: 100,
    });
  });

  it("serializes filters without undefined values", () => {
    const params = searchParamsFromFilters({
      symbol: "ETH",
      sort: "ASC",
      page: 1,
      pageSize: 50,
    });

    expect(params.toString()).toBe("symbol=ETH&sort=ASC&page=1&pageSize=50");
  });

  it("converts datetime-local values to backend UTC strings", () => {
    expect(utcInputToApi("2026-01-01T00:00")).toBe("2026-01-01T00:00:00Z");
    expect(apiUtcToInput("2026-01-01T00:00:00Z")).toBe("2026-01-01T00:00");
  });
});
