import type {
  Exchange,
  TradeSide,
  TransactionFilters,
  TransactionSort,
} from "../api/types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

function optional(value: string | null): string | undefined {
  return value === null || value.trim().length === 0 ? undefined : value.trim();
}

function parseExchange(value: string | null): Exchange | undefined {
  return value === "Binance" || value === "Coinbase" ? value : undefined;
}

function parseSide(value: string | null): TradeSide | undefined {
  return value === "BUY" || value === "SELL" ? value : undefined;
}

function parseSort(value: string | null): TransactionSort {
  return value === "DESC" ? "DESC" : "ASC";
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  max?: number,
): number {
  if (value === null || !/^\d+$/u.test(value)) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  const limited = max === undefined ? parsed : Math.min(parsed, max);

  return Math.max(1, limited);
}

export function filtersFromSearchParams(
  params: URLSearchParams,
): TransactionFilters {
  const symbol = optional(params.get("symbol"));
  const exchange = parseExchange(params.get("exchange"));
  const side = parseSide(params.get("side"));
  const from = optional(params.get("from"));
  const to = optional(params.get("to"));

  return {
    ...(symbol === undefined ? {} : { symbol }),
    ...(exchange === undefined ? {} : { exchange }),
    ...(side === undefined ? {} : { side }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    sort: parseSort(params.get("sort")),
    page: parsePositiveInteger(params.get("page"), DEFAULT_PAGE),
    pageSize: parsePositiveInteger(params.get("pageSize"), DEFAULT_PAGE_SIZE, 100),
  };
}

export function searchParamsFromFilters(
  filters: TransactionFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.symbol !== undefined && filters.symbol.length > 0) {
    params.set("symbol", filters.symbol);
  }

  if (filters.exchange !== undefined) {
    params.set("exchange", filters.exchange);
  }

  if (filters.side !== undefined) {
    params.set("side", filters.side);
  }

  if (filters.from !== undefined && filters.from.length > 0) {
    params.set("from", filters.from);
  }

  if (filters.to !== undefined && filters.to.length > 0) {
    params.set("to", filters.to);
  }

  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  return params;
}

export function utcInputToApi(value: string): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  return `${value}:00Z`;
}

export function apiUtcToInput(value: string | undefined): string {
  if (value === undefined) {
    return "";
  }

  return value.replace(/:00Z$/u, "");
}
