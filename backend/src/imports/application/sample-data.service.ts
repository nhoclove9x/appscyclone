import { readFile } from "node:fs/promises";
import path from "node:path";

import { Injectable } from "@nestjs/common";

export interface SampleCsvContent {
  readonly pricesCsv: string;
  readonly tradesCsv: string;
  readonly pricesFilename: string;
  readonly tradesFilename: string;
}

function repositoryRoot(): string {
  return path.basename(process.cwd()) === "backend"
    ? path.resolve(process.cwd(), "..")
    : process.cwd();
}

@Injectable()
export class SampleDataService {
  async readCanonicalSampleData(): Promise<SampleCsvContent> {
    const docsDirectory = path.join(repositoryRoot(), "docs");
    const pricesFilename = "prices.csv";
    const tradesFilename = "trades.csv";
    const [pricesCsv, tradesCsv] = await Promise.all([
      readFile(path.join(docsDirectory, pricesFilename), "utf8"),
      readFile(path.join(docsDirectory, tradesFilename), "utf8"),
    ]);

    return {
      pricesCsv,
      tradesCsv,
      pricesFilename,
      tradesFilename,
    };
  }
}
