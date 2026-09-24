import { BadRequestException } from "@nestjs/common";
import { Exchange, TradeSide } from "@prisma/client";

import type {
  TransactionQueryOptions,
  TransactionSort,
} from "./portfolio-api.types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

function badRequest(message: string): BadRequestException {
  return new BadRequestException({
    code: "INVALID_REQUEST",
    message,
  });
}

function optionalSingle(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw badRequest(`${key} must be a single string value`);
  }

  return value.trim();
}

function parsePositiveInteger(
  value: string | undefined,
  key: string,
  defaultValue: number,
): number {
  if (value === undefined || value.length === 0) {
    return defaultValue;
  }

  if (!/^\d+$/u.test(value)) {
    throw badRequest(`${key} must be a positive integer`);
  }

  const parsed = Number.parseInt(value, 10);

  if (parsed < 1) {
    throw badRequest(`${key} must be greater than zero`);
  }

  return parsed;
}

function parsePageSize(value: string | undefined): number {
  const pageSize = parsePositiveInteger(
    value,
    "pageSize",
    DEFAULT_PAGE_SIZE,
  );

  if (pageSize > MAX_PAGE_SIZE) {
    throw badRequest(`pageSize must be less than or equal to ${MAX_PAGE_SIZE}`);
  }

  return pageSize;
}

function parseExchange(value: string | undefined): Exchange | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  if (value === Exchange.Binance || value === Exchange.Coinbase) {
    return value;
  }

  throw badRequest("exchange must be Binance or Coinbase");
}

function parseSide(value: string | undefined): TradeSide | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  if (value === TradeSide.BUY || value === TradeSide.SELL) {
    return value;
  }

  throw badRequest("side must be BUY or SELL");
}

function parseSort(value: string | undefined): TransactionSort {
  if (value === undefined || value.length === 0) {
    return "ASC";
  }

  const upper = value.toUpperCase();

  if (upper === "ASC" || upper === "DESC") {
    return upper;
  }

  throw badRequest("sort must be ASC or DESC");
}

function parseUtcTimestamp(
  value: string | undefined,
  key: string,
): Date | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    throw badRequest(`${key} must be a UTC ISO-8601 timestamp`);
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    throw badRequest(`${key} must be a valid UTC ISO-8601 timestamp`);
  }

  return timestamp;
}

export function parseTransactionQuery(
  query: Record<string, unknown>,
): TransactionQueryOptions {
  const symbol = optionalSingle(query, "symbol");
  const exchange = parseExchange(optionalSingle(query, "exchange"));
  const side = parseSide(optionalSingle(query, "side"));
  const from = parseUtcTimestamp(optionalSingle(query, "from"), "from");
  const to = parseUtcTimestamp(optionalSingle(query, "to"), "to");

  return {
    ...(symbol === undefined || symbol.length === 0 ? {} : { symbol }),
    ...(exchange === undefined ? {} : { exchange }),
    ...(side === undefined ? {} : { side }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    sort: parseSort(optionalSingle(query, "sort")),
    page: parsePositiveInteger(
      optionalSingle(query, "page"),
      "page",
      DEFAULT_PAGE,
    ),
    pageSize: parsePageSize(optionalSingle(query, "pageSize")),
  };
}
