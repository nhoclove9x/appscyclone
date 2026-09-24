import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import type { Environment } from "./config/environment";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  await app.listen(config.get("PORT", { infer: true }));
}

void bootstrap();
