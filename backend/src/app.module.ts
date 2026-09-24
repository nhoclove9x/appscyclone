import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnvironment } from "./config/environment";
import { AuthModule } from "./auth";
import { DatabaseModule } from "./database/database.module";
import { ImportsModule } from "./imports";
import { PortfolioModule } from "./portfolio";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AuthModule,
    DatabaseModule,
    ImportsModule,
    PortfolioModule,
  ],
})
export class AppModule {}
