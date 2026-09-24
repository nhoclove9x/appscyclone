import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import { Server } from "node:http";
import path from "node:path";
import request from "supertest";
import type { Agent } from "supertest";

import { PrismaService } from "../../src/database/prisma.service";
import { DatasetLifecycleService } from "../../src/imports";
import { UsersService } from "../../src/auth";
import type { AppConfigurationTarget } from "../../src/main";

const docsDirectory = path.resolve(__dirname, "../../../docs");
const allowedOrigin = "http://localhost:3000";
const tradeHeader =
  "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd";

interface SampleContent {
  readonly pricesCsv: string;
  readonly tradesCsv: string;
  readonly pricesFilename: string;
  readonly tradesFilename: string;
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required for API integration tests");
  }

  return databaseUrl;
}

function sampleContent(): SampleContent {
  return {
    pricesCsv: readFileSync(path.join(docsDirectory, "prices.csv"), "utf8"),
    tradesCsv: readFileSync(path.join(docsDirectory, "trades.csv"), "utf8"),
    pricesFilename: "prices.csv",
    tradesFilename: "trades.csv",
  };
}

async function createTestingApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = requireDatabaseUrl();
  process.env.NODE_ENV = "test";
  process.env.ALLOWED_ORIGINS = allowedOrigin;
  process.env.SESSION_COOKIE_NAME = "AppsCyclone.sid";
  process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
  process.env.SESSION_TTL_SECONDS = "3600";
  process.env.TRUST_PROXY_HOPS = "0";

  const [{ AppModule }, { configureApp }] = await Promise.all([
    import("../../src/app.module"),
    import("../../src/main"),
  ]);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  configureApp(app as unknown as AppConfigurationTarget);
  await app.init();

  return app;
}

function httpServerFrom(app: INestApplication): Server {
  const server: unknown = app.getHttpServer();

  if (server instanceof Server) {
    return server as Server;
  }

  throw new Error("Nest test app did not expose an HTTP server");
}

async function clearTables(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "session", "application_state", "trades", "datasets", "prices", "price_snapshots", "users" RESTART IDENTITY CASCADE',
  );
}

async function login(
  server: Server,
  users: UsersService,
): Promise<Agent> {
  await users.provisionUser({
    email: "evaluator@example.com",
    password: "correct-password",
  });

  const agent = request.agent(server);
  const response = await agent
    .post("/api/v1/auth/login")
    .set("Origin", allowedOrigin)
    .send({
      email: "evaluator@example.com",
      password: "correct-password",
    });

  expect(response.status).toBe(200);
  return agent;
}

function rounded(value: string): string {
  return new Decimal(value).toDecimalPlaces(2).toFixed(2);
}

function expectStringFinancial(value: unknown): void {
  expect(typeof value).toBe("string");
  expect(() => new Decimal(value as string)).not.toThrow();
}

function transactionsFrom(body: unknown): unknown[] {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();

  const transactions = (body as { readonly transactions?: unknown }).transactions;

  expect(Array.isArray(transactions)).toBe(true);
  return transactions as unknown[];
}

function transactionField(
  transaction: unknown,
  field: string,
): unknown {
  expect(typeof transaction).toBe("object");
  expect(transaction).not.toBeNull();

  return (transaction as Record<string, unknown>)[field];
}

function recordFrom(value: unknown): Record<string, unknown> {
  expect(typeof value).toBe("object");
  expect(value).not.toBeNull();

  return value as Record<string, unknown>;
}

function nestedRecord(value: unknown, field: string): Record<string, unknown> {
  return recordFrom(recordFrom(value)[field]);
}

function stringField(value: unknown, field: string): string {
  const fieldValue = recordFrom(value)[field];

  if (typeof fieldValue !== "string") {
    throw new Error(`${field} must be a string`);
  }

  return fieldValue;
}

function arrayField(value: unknown, field: string): unknown[] {
  const fieldValue = recordFrom(value)[field];

  expect(Array.isArray(fieldValue)).toBe(true);
  return fieldValue as unknown[];
}

function paginationFrom(value: unknown): Record<string, unknown> {
  return nestedRecord(value, "pagination");
}

describe("protected portfolio and transaction read APIs", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let users: UsersService;
  let lifecycle: DatasetLifecycleService;
  let agent: Agent;

  beforeAll(async () => {
    app = await createTestingApp();
    server = httpServerFrom(app);
    prisma = app.get(PrismaService);
    users = app.get(UsersService);
    lifecycle = app.get(DatasetLifecycleService);
  });

  beforeEach(async () => {
    await clearTables(prisma);
    await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    agent = await login(server, users);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated portfolio and transaction requests", async () => {
    const unauthenticatedPortfolio = await request(server).get(
      "/api/v1/portfolio",
    );
    const unauthenticatedTransactions = await request(server).get(
      "/api/v1/transactions",
    );

    expect(unauthenticatedPortfolio.status).toBe(401);
    expect(unauthenticatedTransactions.status).toBe(401);
  });

  it("returns supplied sample portfolio totals as decimal strings", async () => {
    const response = await agent.get("/api/v1/portfolio");
    const body = response.body as unknown;
    const dataset = nestedRecord(body, "dataset");
    const priceSnapshot = nestedRecord(body, "priceSnapshot");
    const totals = nestedRecord(body, "totals");

    expect(response.status).toBe(200);
    expect(typeof dataset.id).toBe("string");
    expect(priceSnapshot.asOf).toBe("2026-03-31T23:59:59.000Z");
    expect(rounded(stringField(totals, "currentValue"))).toBe("60620.89");
    expect(rounded(stringField(totals, "remainingCostBasis"))).toBe("59969.24");
    expect(rounded(stringField(totals, "realizedPL"))).toBe("-5052.96");
    expect(rounded(stringField(totals, "unrealizedPL"))).toBe("651.65");
    expect(rounded(stringField(totals, "totalPL"))).toBe("-4401.31");
    expect(rounded(stringField(totals, "fees"))).toBe("2708.86");

    for (const value of Object.values(totals)) {
      expectStringFinancial(value);
    }
  });

  it("aggregates cross-exchange trades into one holding per symbol", async () => {
    const response = await agent.get("/api/v1/portfolio");
    const body = response.body as unknown;
    const holdingSymbols = arrayField(body, "holdings").map((holding) =>
      stringField(holding, "symbol"),
    );
    const performanceSymbols = arrayField(body, "performance").map(
      (performance) => stringField(performance, "symbol"),
    );

    expect(response.status).toBe(200);
    expect(holdingSymbols.sort()).toEqual(["BTC", "CKB", "DOGE", "ETH", "SOL"]);
    expect(performanceSymbols.filter((symbol) => symbol === "BTC")).toHaveLength(
      1,
    );
  });

  it("paginates transactions and makes all 200 sample trades browseable", async () => {
    const seenTradeIds = new Set<string>();

    for (const page of [1, 2, 3, 4]) {
      const response = await agent.get(
        `/api/v1/transactions?page=${page}&pageSize=50`,
      );
      const transactions = transactionsFrom(response.body);

      expect(response.status).toBe(200);
      expect(paginationFrom(response.body as unknown)).toEqual({
        page,
        pageSize: 50,
        totalItems: 200,
        totalPages: 4,
      });

      for (const transaction of transactions) {
        seenTradeIds.add(String(transactionField(transaction, "tradeId")));
      }
    }

    expect(seenTradeIds.size).toBe(200);
  });

  it("filters transactions by symbol, exchange, side, date range, and combined filters", async () => {
    const symbol = await agent.get("/api/v1/transactions?symbol=BTC&pageSize=100");
    const exchange = await agent.get(
      "/api/v1/transactions?exchange=Binance&pageSize=100",
    );
    const side = await agent.get("/api/v1/transactions?side=BUY&pageSize=100");
    const dateRange = await agent.get(
      "/api/v1/transactions?from=2025-10-01T09:00:00Z&to=2025-10-04T05:00:00Z&pageSize=100",
    );
    const combined = await agent.get(
      "/api/v1/transactions?symbol=BTC&exchange=Coinbase&side=SELL&pageSize=100",
    );

    expect(paginationFrom(symbol.body as unknown).totalItems).toBe(40);
    expect(paginationFrom(exchange.body as unknown).totalItems).toBe(100);
    expect(paginationFrom(side.body as unknown).totalItems).toBe(128);
    expect(paginationFrom(dateRange.body as unknown).totalItems).toBe(5);
    expect(
      paginationFrom(combined.body as unknown).totalItems as number,
    ).toBeGreaterThan(0);

    for (const transaction of transactionsFrom(combined.body)) {
      expect(transactionField(transaction, "symbol")).toBe("BTC");
      expect(transactionField(transaction, "exchange")).toBe("Coinbase");
      expect(transactionField(transaction, "side")).toBe("SELL");
    }
  });

  it("returns financial transaction fields and gross value as strings", async () => {
    const response = await agent.get("/api/v1/transactions?pageSize=1");
    const [transaction] = transactionsFrom(response.body);

    expect(response.status).toBe(200);
    expectStringFinancial(transactionField(transaction, "quantity"));
    expectStringFinancial(transactionField(transaction, "priceUsd"));
    expectStringFinancial(transactionField(transaction, "feeUsd"));
    expectStringFinancial(transactionField(transaction, "grossValueUsd"));
  });

  it("sorts transactions deterministically by timestamp and trade ID", async () => {
    await lifecycle.replaceActiveTradeDataset({
      csvContent: `${tradeHeader}
TIE-B,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0
TIE-A,2026-01-01T00:00:00Z,Coinbase,BTC,BUY,1,100,0
TIE-C,2026-01-02T00:00:00Z,Binance,BTC,BUY,1,100,0
`,
      filename: "same-timestamp.csv",
    });

    const asc = await agent.get("/api/v1/transactions?sort=ASC&pageSize=10");
    const desc = await agent.get("/api/v1/transactions?sort=DESC&pageSize=10");

    expect(transactionsFrom(asc.body).map((transaction) =>
      transactionField(transaction, "tradeId"),
    )).toEqual(["TIE-A", "TIE-B", "TIE-C"]);
    expect(transactionsFrom(desc.body).map((transaction) =>
      transactionField(transaction, "tradeId"),
    )).toEqual(["TIE-C", "TIE-B", "TIE-A"]);
  });

  it("transaction filters do not change portfolio totals", async () => {
    const before = await agent.get("/api/v1/portfolio");
    const filteredTransactions = await agent.get(
      "/api/v1/transactions?symbol=BTC&exchange=Binance&side=BUY&pageSize=5",
    );
    const after = await agent.get("/api/v1/portfolio");

    expect(filteredTransactions.status).toBe(200);
    expect(nestedRecord(after.body as unknown, "totals")).toEqual(
      nestedRecord(before.body as unknown, "totals"),
    );
  });

  it("transaction responses use only the dataset captured at request start", async () => {
    const before = await agent.get("/api/v1/transactions?pageSize=1");
    const originalDatasetId = stringField(
      nestedRecord(before.body as unknown, "dataset"),
      "id",
    );

    await lifecycle.replaceActiveTradeDataset({
      csvContent: `${tradeHeader}
NEW-001,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0
`,
      filename: "replacement.csv",
    });

    const after = await agent.get("/api/v1/transactions?pageSize=10");

    expect(stringField(nestedRecord(after.body as unknown, "dataset"), "id")).not.toBe(
      originalDatasetId,
    );
    expect(transactionsFrom(after.body).map((transaction) =>
      transactionField(transaction, "tradeId"),
    )).toEqual(["NEW-001"]);
  });
});
