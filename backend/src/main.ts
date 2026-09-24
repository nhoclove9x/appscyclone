import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import type { Environment } from "./config/environment";

export interface AppConfigurationTarget {
  getHttpAdapter(): { getInstance(): unknown };
  setGlobalPrefix(prefix: string): void;
}

function hasExpressSet(value: unknown): value is {
  set(setting: string, value: unknown): unknown;
} {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "set" in value &&
    typeof value.set === "function"
  );
}

export function configureApp(
  app: AppConfigurationTarget,
  options: { readonly trustProxyHops?: number } = {},
): void {
  app.setGlobalPrefix("api/v1");
  const expressInstance = app.getHttpAdapter().getInstance();

  if (!hasExpressSet(expressInstance)) {
    throw new Error("Expected an Express HTTP adapter");
  }

  expressInstance.set("trust proxy", options.trustProxyHops ?? 0);
}

async function bootstrap(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  configureApp(app, {
    trustProxyHops: config.get("TRUST_PROXY_HOPS", { infer: true }),
  });
  app.enableShutdownHooks();
  await app.listen(config.get("PORT", { infer: true }));
}

if (require.main === module) {
  void bootstrap();
}
