import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

import type { Environment } from "../config/environment";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { createOriginValidationMiddleware } from "./origin-validation.middleware";
import { PasswordService } from "./password.service";
import { createSessionMiddleware } from "./session/session.config";
import { UsersService } from "./users.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthGuard, AuthService, PasswordService, UsersService],
  exports: [AuthGuard, PasswordService, UsersService],
})
export class AuthModule implements NestModule, OnModuleDestroy {
  private sessionPool: Pool | undefined;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  configure(consumer: MiddlewareConsumer): void {
    const environment = {
      ALLOWED_ORIGINS: this.config.get("ALLOWED_ORIGINS", { infer: true }),
      DATABASE_URL: this.config.get("DATABASE_URL", { infer: true }),
      NODE_ENV: this.config.get("NODE_ENV", { infer: true }),
      PORT: this.config.get("PORT", { infer: true }),
      SESSION_COOKIE_NAME: this.config.get("SESSION_COOKIE_NAME", {
        infer: true,
      }),
      SESSION_SECRET: this.config.get("SESSION_SECRET", { infer: true }),
      SESSION_TTL_SECONDS: this.config.get("SESSION_TTL_SECONDS", {
        infer: true,
      }),
      TRUST_PROXY_HOPS: this.config.get("TRUST_PROXY_HOPS", { infer: true }),
    };

    this.sessionPool = new Pool({
      connectionString: environment.DATABASE_URL,
    });

    consumer
      .apply(
        createOriginValidationMiddleware(environment),
        createSessionMiddleware({ environment, pool: this.sessionPool }),
      )
      .forRoutes("*");
  }

  async onModuleDestroy(): Promise<void> {
    await this.sessionPool?.end();
  }
}
