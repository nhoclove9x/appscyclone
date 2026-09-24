-- CreateEnum
CREATE TYPE "Exchange" AS ENUM ('Binance', 'Coinbase');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "DatasetSource" AS ENUM ('SAMPLE', 'UPLOAD');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" UUID NOT NULL,
    "as_of" TIMESTAMPTZ(6) NOT NULL,
    "source_filename" TEXT NOT NULL,
    "source_checksum" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "snapshot_id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "price_usd" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("snapshot_id", "symbol"),
    CONSTRAINT "prices_symbol_nonempty_check" CHECK (BTRIM("symbol") <> ''),
    CONSTRAINT "prices_price_usd_positive_check" CHECK ("price_usd" > 0)
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" UUID NOT NULL,
    "source" "DatasetSource" NOT NULL,
    "source_filename" TEXT NOT NULL,
    "source_checksum" CHAR(64) NOT NULL,
    "price_snapshot_id" UUID NOT NULL,
    "imported_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "dataset_id" UUID NOT NULL,
    "trade_id" TEXT NOT NULL,
    "source_row_number" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "exchange" "Exchange" NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "quantity" DECIMAL(38,18) NOT NULL,
    "price_usd" DECIMAL(38,18) NOT NULL,
    "fee_usd" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("dataset_id", "trade_id"),
    CONSTRAINT "trades_trade_id_nonempty_check" CHECK (BTRIM("trade_id") <> ''),
    CONSTRAINT "trades_symbol_nonempty_check" CHECK (BTRIM("symbol") <> ''),
    CONSTRAINT "trades_source_row_number_check" CHECK ("source_row_number" >= 2),
    CONSTRAINT "trades_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "trades_price_usd_positive_check" CHECK ("price_usd" > 0),
    CONSTRAINT "trades_fee_usd_nonnegative_check" CHECK ("fee_usd" >= 0)
);

-- CreateTable
CREATE TABLE "application_state" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "active_dataset_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_state_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "application_state_singleton_check" CHECK ("id" = 1)
);

-- connect-pg-simple 10.0.0 session storage. The package owns this shape;
-- it is intentionally not represented as a Prisma model.
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "trades_dataset_time_idx" ON "trades"("dataset_id", "timestamp", "trade_id");

-- CreateIndex
CREATE INDEX "trades_dataset_symbol_time_idx" ON "trades"("dataset_id", "symbol", "timestamp", "trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "trades_dataset_id_source_row_number_key" ON "trades"("dataset_id", "source_row_number");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "price_snapshots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_price_snapshot_id_fkey" FOREIGN KEY ("price_snapshot_id") REFERENCES "price_snapshots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "application_state" ADD CONSTRAINT "application_state_active_dataset_id_fkey" FOREIGN KEY ("active_dataset_id") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
