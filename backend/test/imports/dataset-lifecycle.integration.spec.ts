import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaService } from "../../src/database/prisma.service";
import { DatasetLifecycleService } from "../../src/imports";
import { SampleDataService } from "../../src/imports/application/sample-data.service";
import { ImportValidationError } from "../../src/imports/domain";

const docsDirectory = path.resolve(__dirname, "../../../docs");
const tradeHeader =
  "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd";
const priceHeader = "as_of,symbol,price_usd";
const replacementCsv = `${tradeHeader}
ALT-001,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,1
ALT-002,2026-01-02T00:00:00Z,Coinbase,BTC,SELL,0.25,120,0.50
`;

function sampleContent() {
  return {
    pricesCsv: readFileSync(path.join(docsDirectory, "prices.csv"), "utf8"),
    tradesCsv: readFileSync(path.join(docsDirectory, "trades.csv"), "utf8"),
    pricesFilename: "prices.csv",
    tradesFilename: "trades.csv",
  };
}

function display(value: {
  toDecimalPlaces(decimalPlaces: number): { toFixed(): string };
}) {
  return value.toDecimalPlaces(2).toFixed();
}

describe("dataset lifecycle integration", () => {
  const prisma = new PrismaService();
  const lifecycle = new DatasetLifecycleService(
    prisma,
    new SampleDataService(),
  );

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "application_state", "trades", "datasets", "prices", "price_snapshots", "users" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function counts() {
    const [datasets, trades, priceSnapshots, prices] = await Promise.all([
      prisma.dataset.count(),
      prisma.trade.count(),
      prisma.priceSnapshot.count(),
      prisma.price.count(),
    ]);

    return { datasets, trades, priceSnapshots, prices };
  }

  async function activeDatasetId(): Promise<string> {
    const state = await prisma.applicationState.findUniqueOrThrow({
      where: { id: 1 },
    });

    return state.activeDatasetId;
  }

  it("initializes canonical sample data only when no active dataset exists", async () => {
    const first = await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const second =
      await lifecycle.initializeSampleDataIfNeeded(sampleContent());

    expect(second.datasetId).toBe(first.datasetId);
    expect(await counts()).toEqual({
      datasets: 1,
      trades: 200,
      priceSnapshots: 1,
      prices: 5,
    });
  });

  it("does not overwrite an imported active dataset during bootstrap", async () => {
    await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const imported = await lifecycle.replaceActiveTradeDataset({
      csvContent: replacementCsv,
      filename: "replacement.csv",
    });

    await lifecycle.initializeSampleDataIfNeeded(sampleContent());

    expect(await activeDatasetId()).toBe(imported.datasetId);
  });

  it("failed validation preserves active data and creates no partial replacement", async () => {
    const sample =
      await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const beforeCounts = await counts();

    await expect(
      lifecycle.replaceActiveTradeDataset({
        csvContent: `${tradeHeader}\nBAD-001,2026-01-01T00:00:00Z,Binance,BTC,SELL,1,100,0\n`,
        filename: "invalid.csv",
      }),
    ).rejects.toBeInstanceOf(ImportValidationError);

    expect(await activeDatasetId()).toBe(sample.datasetId);
    expect(await counts()).toEqual(beforeCounts);
  });

  it("successfully replaces the active trade dataset without deleting history", async () => {
    const sample =
      await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const replacement = await lifecycle.replaceActiveTradeDataset({
      csvContent: replacementCsv,
      filename: "replacement.csv",
    });

    expect(replacement.datasetId).not.toBe(sample.datasetId);
    expect(await activeDatasetId()).toBe(replacement.datasetId);
    expect(await prisma.dataset.count()).toBe(2);
    expect(
      await prisma.trade.count({ where: { datasetId: replacement.datasetId } }),
    ).toBe(2);
    expect(
      await prisma.dataset.findUnique({ where: { id: sample.datasetId } }),
    ).not.toBeNull();
  });

  it("rolls back new rows when the replacement transaction fails", async () => {
    const sample =
      await lifecycle.initializeSampleDataIfNeeded(sampleContent());

    await expect(
      lifecycle.replaceActiveTradeDataset({
        csvContent: replacementCsv,
        filename: "replacement.csv",
        importedById: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toThrow();

    expect(await activeDatasetId()).toBe(sample.datasetId);
    expect(await counts()).toEqual({
      datasets: 1,
      trades: 200,
      priceSnapshots: 1,
      prices: 5,
    });
  });

  it("fails stale trade activation with DATASET_CHANGED and rolls back inserted rows", async () => {
    await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const prepared = await lifecycle.prepareTradeReplacement({
      csvContent: replacementCsv,
      filename: "replacement.csv",
    });
    const reset = await lifecycle.resetSampleData(sampleContent());

    await expect(
      lifecycle.activatePreparedTradeReplacement(prepared),
    ).rejects.toEqual(expect.objectContaining({ code: "DATASET_CHANGED" }));

    expect(await activeDatasetId()).toBe(reset.datasetId);
    expect(await counts()).toEqual({
      datasets: 2,
      trades: 400,
      priceSnapshots: 2,
      prices: 10,
    });
  });

  it("resets to the canonical sample data and reference totals", async () => {
    await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    await lifecycle.replaceActiveTradeDataset({
      csvContent: replacementCsv,
      filename: "replacement.csv",
    });

    const reset = await lifecycle.resetSampleData(sampleContent());
    const activePortfolio = await lifecycle.calculateActivePortfolio();

    expect(reset.tradeCount).toBe(200);
    expect(reset.priceCount).toBe(5);
    expect(display(activePortfolio.totals.currentValue)).toBe("60620.89");
    expect(display(activePortfolio.totals.remainingCostBasis)).toBe("59969.24");
    expect(display(activePortfolio.totals.realizedPL)).toBe("-5052.96");
    expect(display(activePortfolio.totals.unrealizedPL)).toBe("651.65");
    expect(display(activePortfolio.totals.totalPL)).toBe("-4401.31");
    expect(display(activePortfolio.totals.totalFees)).toBe("2708.86");

    const activeDataset = await prisma.dataset.findUniqueOrThrow({
      where: { id: reset.datasetId },
      include: { priceSnapshot: true },
    });
    expect(activeDataset.source).toBe("SAMPLE");
    expect(activeDataset.sourceFilename).toBe("trades.csv");
    expect(activeDataset.priceSnapshot.sourceFilename).toBe("prices.csv");
    expect(activeDataset.priceSnapshot.asOf.toISOString()).toBe(
      "2026-03-31T23:59:59.000Z",
    );
  });

  it("failed reset validation leaves the active state unchanged", async () => {
    const sample =
      await lifecycle.initializeSampleDataIfNeeded(sampleContent());

    await expect(
      lifecycle.resetSampleData({
        ...sampleContent(),
        pricesCsv: `${priceHeader}\n2026-03-31T23:59:59Z,BTC,0\n`,
      }),
    ).rejects.toBeInstanceOf(ImportValidationError);

    expect(await activeDatasetId()).toBe(sample.datasetId);
    expect(await counts()).toEqual({
      datasets: 1,
      trades: 200,
      priceSnapshots: 1,
      prices: 5,
    });
  });

  it("stale reset receives DATASET_CHANGED and keeps the newer active dataset", async () => {
    await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const preparedReset = await lifecycle.prepareSampleReset(sampleContent());
    const replacement = await lifecycle.replaceActiveTradeDataset({
      csvContent: replacementCsv,
      filename: "replacement.csv",
    });

    await expect(
      lifecycle.activatePreparedSampleReset(preparedReset),
    ).rejects.toEqual(expect.objectContaining({ code: "DATASET_CHANGED" }));

    expect(await activeDatasetId()).toBe(replacement.datasetId);
    expect(await counts()).toEqual({
      datasets: 2,
      trades: 202,
      priceSnapshots: 1,
      prices: 5,
    });
  });

  it("repeated valid reset creates new immutable dataset and snapshot records", async () => {
    await lifecycle.initializeSampleDataIfNeeded(sampleContent());
    const firstReset = await lifecycle.resetSampleData(sampleContent());
    const secondReset = await lifecycle.resetSampleData(sampleContent());

    expect(secondReset.datasetId).not.toBe(firstReset.datasetId);
    expect(secondReset.priceSnapshotId).not.toBe(firstReset.priceSnapshotId);
    expect(await counts()).toEqual({
      datasets: 3,
      trades: 600,
      priceSnapshots: 3,
      prices: 15,
    });
  });

  it("handles concurrent first-time initialization by accepting the winner state", async () => {
    const secondPrisma = new PrismaService();
    await secondPrisma.$connect();
    const secondLifecycle = new DatasetLifecycleService(
      secondPrisma,
      new SampleDataService(),
    );

    try {
      const results = await Promise.all([
        lifecycle.initializeSampleDataIfNeeded(sampleContent()),
        secondLifecycle.initializeSampleDataIfNeeded(sampleContent()),
      ]);
      const activeId = await activeDatasetId();

      expect(results.map(({ datasetId }) => datasetId)).toEqual([
        activeId,
        activeId,
      ]);
      expect(await counts()).toEqual({
        datasets: 1,
        trades: 200,
        priceSnapshots: 1,
        prices: 5,
      });
    } finally {
      await secondPrisma.$disconnect();
    }
  });
});
