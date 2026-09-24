import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { readFileSync } from "node:fs";
import { Server } from "node:http";
import path from "node:path";
import request from "supertest";
import type { Agent } from "supertest";

import { UsersService } from "../../src/auth";
import { PrismaService } from "../../src/database/prisma.service";
import { DatasetLifecycleService } from "../../src/imports";
import { DatasetLifecycleError } from "../../src/imports/domain";
import type { AppConfigurationTarget } from "../../src/main";

const docsDirectory = path.resolve(__dirname, "../../../docs");
const allowedOrigin = "http://localhost:3000";
const tradeHeader =
  "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd";
const replacementCsv = `${tradeHeader}
ALT-001,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,1
ALT-002,2026-01-02T00:00:00Z,Coinbase,BTC,SELL,0.25,120,0.50
`;
const invalidQuantityCsv = `${tradeHeader}
BAD-001,2026-01-01T00:00:00Z,Binance,BTC,BUY,0,100,0
`;

interface SampleContent {
  readonly pricesCsv: string;
  readonly tradesCsv: string;
  readonly pricesFilename: string;
  readonly tradesFilename: string;
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required for import API integration tests");
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
  process.env.SESSION_COOKIE_NAME = "appcyclone.sid";
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
): Promise<{ readonly agent: Agent; readonly userId: string }> {
  const provisioned = await users.provisionUser({
    email: "evaluator@example.com",
    password: "correct-password",
  });

  if (provisioned.status !== "created") {
    throw new Error("Expected test user to be created");
  }

  const agent = request.agent(server);
  const response = await agent
    .post("/api/v1/auth/login")
    .set("Origin", allowedOrigin)
    .send({
      email: "evaluator@example.com",
      password: "correct-password",
    });

  expect(response.status).toBe(200);
  return { agent, userId: provisioned.user.id };
}

function recordFrom(value: unknown): Record<string, unknown> {
  expect(typeof value).toBe("object");
  expect(value).not.toBeNull();

  return value as Record<string, unknown>;
}

function arrayField(value: unknown, field: string): unknown[] {
  const fieldValue = recordFrom(value)[field];

  expect(Array.isArray(fieldValue)).toBe(true);
  return fieldValue as unknown[];
}

function firstRecord(values: readonly unknown[]): Record<string, unknown> {
  const [first] = values;

  if (first === undefined) {
    throw new Error("Expected at least one item");
  }

  return recordFrom(first);
}

async function activeDatasetId(prisma: PrismaService): Promise<string> {
  const state = await prisma.applicationState.findUniqueOrThrow({
    where: { id: 1 },
  });

  return state.activeDatasetId;
}

describe("protected import and sample reset APIs", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let users: UsersService;
  let lifecycle: DatasetLifecycleService;
  let agent: Agent;
  let userId: string;

  beforeAll(async () => {
    app = await createTestingApp();
    server = httpServerFrom(app);
    prisma = app.get(PrismaService);
    users = app.get(UsersService);
    lifecycle = app.get(DatasetLifecycleService);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await clearTables(prisma);
    await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const loginResult = await login(server, users);
    agent = loginResult.agent;
    userId = loginResult.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated import and reset requests", async () => {
    const importResponse = await request(server)
      .post("/api/v1/imports/trades")
      .set("Origin", allowedOrigin)
      .attach("file", Buffer.from(replacementCsv), "replacement.csv");
    const resetResponse = await request(server)
      .post("/api/v1/datasets/reset-sample")
      .set("Origin", allowedOrigin)
      .send({ confirm: true });

    expect(importResponse.status).toBe(401);
    expect(resetResponse.status).toBe(401);
  });

  it("rejects modifying requests from a mismatched origin", async () => {
    const importResponse = await agent
      .post("/api/v1/imports/trades")
      .set("Origin", "http://localhost.evil.example")
      .attach("file", Buffer.from(replacementCsv), "replacement.csv");
    const resetResponse = await agent
      .post("/api/v1/datasets/reset-sample")
      .set("Origin", "http://localhost.evil.example")
      .send({ confirm: true });

    expect(importResponse.status).toBe(403);
    expect(recordFrom(importResponse.body).code).toBe("INVALID_ORIGIN");
    expect(resetResponse.status).toBe(403);
    expect(recordFrom(resetResponse.body).code).toBe("INVALID_ORIGIN");
  });

  it("successfully imports a valid trade CSV and records the authenticated importer", async () => {
    const response = await agent
      .post("/api/v1/imports/trades")
      .set("Origin", allowedOrigin)
      .attach("file", Buffer.from(replacementCsv), "replacement.csv");
    const dataset = recordFrom(recordFrom(response.body).dataset);

    expect(response.status).toBe(200);
    expect(recordFrom(response.body).tradeCount).toBe(2);
    expect(recordFrom(response.body).priceCount).toBe(5);
    expect(dataset.source).toBe("UPLOAD");
    expect(dataset.sourceFilename).toBe("replacement.csv");
    expect(dataset.importedById).toBe(userId);
    expect(await activeDatasetId(prisma)).toBe(dataset.id);

    const storedDataset = await prisma.dataset.findUniqueOrThrow({
      where: { id: String(dataset.id) },
    });
    expect(storedDataset.importedById).toBe(userId);
  });

  it("returns useful validation errors and preserves the active dataset for invalid CSV", async () => {
    const originalDatasetId = await activeDatasetId(prisma);
    const originalCounts = {
      datasets: await prisma.dataset.count(),
      trades: await prisma.trade.count(),
    };

    const response = await agent
      .post("/api/v1/imports/trades")
      .set("Origin", allowedOrigin)
      .attach("file", Buffer.from(invalidQuantityCsv), "invalid.csv");
    const issue = firstRecord(arrayField(response.body, "issues"));

    expect(response.status).toBe(400);
    expect(recordFrom(response.body).code).toBe("IMPORT_VALIDATION_FAILED");
    expect(issue.code).toBe("INVALID_QUANTITY");
    expect(issue.rowNumber).toBe(2);
    expect(issue.field).toBe("quantity");
    expect(issue.tradeId).toBe("BAD-001");
    expect(await activeDatasetId(prisma)).toBe(originalDatasetId);
    expect(await prisma.dataset.count()).toBe(originalCounts.datasets);
    expect(await prisma.trade.count()).toBe(originalCounts.trades);
  });

  it("maps stale trade activation to HTTP 409 DATASET_CHANGED", async () => {
    const originalDatasetId = await activeDatasetId(prisma);
    jest
      .spyOn(lifecycle, "replaceActiveTradeDataset")
      .mockRejectedValueOnce(new DatasetLifecycleError("DATASET_CHANGED"));

    const response = await agent
      .post("/api/v1/imports/trades")
      .set("Origin", allowedOrigin)
      .attach("file", Buffer.from(replacementCsv), "replacement.csv");

    expect(response.status).toBe(409);
    expect(recordFrom(response.body).code).toBe("DATASET_CHANGED");
    expect(await activeDatasetId(prisma)).toBe(originalDatasetId);
  });

  it("successfully resets to the canonical sample dataset", async () => {
    await agent
      .post("/api/v1/imports/trades")
      .set("Origin", allowedOrigin)
      .attach("file", Buffer.from(replacementCsv), "replacement.csv");

    const response = await agent
      .post("/api/v1/datasets/reset-sample")
      .set("Origin", allowedOrigin)
      .send({ confirm: true });
    const dataset = recordFrom(recordFrom(response.body).dataset);

    expect(response.status).toBe(200);
    expect(recordFrom(response.body).tradeCount).toBe(200);
    expect(recordFrom(response.body).priceCount).toBe(5);
    expect(dataset.source).toBe("SAMPLE");
    expect(dataset.sourceFilename).toBe("trades.csv");
    expect(await activeDatasetId(prisma)).toBe(dataset.id);
  });

  it("rejects reset without explicit confirmation", async () => {
    const originalDatasetId = await activeDatasetId(prisma);
    const response = await agent
      .post("/api/v1/datasets/reset-sample")
      .set("Origin", allowedOrigin)
      .send({ confirm: false });

    expect(response.status).toBe(400);
    expect(recordFrom(response.body).code).toBe("INVALID_REQUEST");
    expect(await activeDatasetId(prisma)).toBe(originalDatasetId);
  });

  it("maps stale reset to HTTP 409 and preserves the active dataset", async () => {
    const originalDatasetId = await activeDatasetId(prisma);
    jest
      .spyOn(lifecycle, "resetSampleData")
      .mockRejectedValueOnce(new DatasetLifecycleError("DATASET_CHANGED"));

    const response = await agent
      .post("/api/v1/datasets/reset-sample")
      .set("Origin", allowedOrigin)
      .send({ confirm: true });

    expect(response.status).toBe(409);
    expect(recordFrom(response.body).code).toBe("DATASET_CHANGED");
    expect(await activeDatasetId(prisma)).toBe(originalDatasetId);
  });
});
