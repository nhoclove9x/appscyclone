## 1. Findings

  - The proposed dataset immutability trigger conflicts with ON DELETE SET
    NULL: deleting an importing user would issue an UPDATE against datasets,
    which a blanket update-rejection trigger would block.

  - Raw SQL immutability triggers do not provide enough assessment-level
    benefit to justify their migration and testing complexity. Dataset
    immutability can be safely enforced through restricted write paths,
    transactions, restrictive foreign keys, and tests.

  - Last-writer-wins is atomic but permits a validated import to activate
    against stale application state. This is explainable by commit order but
    surprising when reset/import operations overlap.

  - Optimistic activation adds only one conditional update and produces
    clearer behavior: a stale operation fails rather than silently superseding
    a newer dataset.

  - The original SQL checks were over-specified. Email normalization and
    checksum formatting belong in application validation. Financial value,
    identity, source-row, and singleton checks provide concrete database-level
    protection and should remain.

  - The official connect-pg-simple table has exactly sid varchar, sess json,
    and expire timestamp(6), with a primary key on sid and an index on expire.
    It has no user foreign key. This should be copied from the library schema
    rather than replaced with a custom session design. Official connect-pg-
    simple table

  ## 2. Revised decisions

  ### Dataset immutability

  - Remove all raw SQL immutability triggers.
  - Do not expose dataset, trade, price, or price-snapshot update/delete APIs.
  - Encapsulate creation and activation in one dataset repository/service.
  - Do not expose general-purpose update, updateMany, delete, or deleteMany
    methods for immutable financial entities.

  - Use restrictive foreign keys between financial-history entities.
  - Test that import/reset only insert new immutable records and update
    application_state.

  - Treat direct privileged database modification as an operational concern
    outside normal application behavior.

  ### User deletion behavior

  Change Dataset.importedBy to ON DELETE RESTRICT.

  - Users with import history cannot be hard-deleted.
  - Accounts are disabled instead.
  - Initial seed datasets still allow imported_by_id = NULL.
  - This preserves provenance and avoids foreign-key actions mutating
    datasets.

  - User ID updates are also restricted.

  ### Import/reset concurrency

  Adopt optimistic activation.

  Every import/reset captures the expected active dataset ID before expensive
  validation. Activation uses:

  UPDATE application_state
  SET active_dataset_id = :new_dataset_id,
      updated_at = now()
  WHERE id = 1
    AND active_dataset_id = :expected_dataset_id;

  - Exactly one affected row means activation succeeded.
  - Zero affected rows means another import/reset committed first.
  - Throw DATASET_CHANGED, roll back the new dataset and trades, and return
    HTTP 409.

  - The user may retry against the new active dataset and price snapshot.
  - This prevents Import A, validated against S1, from silently superseding a
    reset that activated S2 while Import A was running.

  No advisory lock or repeatable-read transaction is required.

  ### SQL checks retained

  Retain only stable checks that materially protect source or financial
  integrity:

  - application_state.id = 1
  - Nonempty trimmed trade_id
  - Nonempty trimmed trade/price symbol
  - source_row_number >= 2
  - Trade quantity > 0
  - Trade price_usd > 0
  - Trade fee_usd >= 0
  - Snapshot price_usd > 0

  ### SQL checks removed

  Do not add database checks for:

  - Lowercase email
  - Email syntax
  - SHA-256 hexadecimal format
  - Source filename format
  - Timestamp ordering
  - SELL inventory availability
  - Trade-symbol price coverage

  These belong to application validation and automated tests. PostgreSQL
  types, foreign keys, and enums already protect the remaining structural
  cases.

  ### Delete/update actions

   Relationship                   Delete      Update      Reason
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━  ━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━
   Dataset → importing user       RESTRICT    RESTRICT    Preserve
                                                          provenance; disable
                                                          users instead
  ─────────────────────────────  ──────────  ──────────  ─────────────────────
   Dataset → price snapshot       RESTRICT    RESTRICT    Preserve
                                                          reproducible
                                                          valuation
  ─────────────────────────────  ──────────  ──────────  ─────────────────────
   Trade → dataset                RESTRICT    RESTRICT    Prevent accidental
                                                          history deletion
  ─────────────────────────────  ──────────  ──────────  ─────────────────────
   Price → snapshot               RESTRICT    RESTRICT    Prevent partial
                                                          snapshot deletion
  ─────────────────────────────  ──────────  ──────────  ─────────────────────
   Application state → dataset    RESTRICT    RESTRICT    Active history
                                                          cannot be deleted
  ─────────────────────────────  ──────────  ──────────  ─────────────────────
   Session → user                 No FK       —           Session library
                                                          stores user ID in
                                                          JSON

  No cascade action is used for financial history.

  ### Session storage

  Use the standard table required by connect-pg-simple:

  CREATE TABLE "session" (
    "sid" varchar NOT NULL,
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
  );

  CREATE INDEX "IDX_session_expire" ON "session" ("expire");

  - Disable createTableIfMissing; migrations own table creation.
  - The session table is infrastructure owned by connect-pg-simple.
  - No custom user ID, timestamps, UUID, or foreign-key columns are added.
  - Session deletion and expiry cleanup are independent of financial history.

  ## 3. Updated Prisma schema sections

  ### User and dataset relation

  model User {
    id               String    @id @default(uuid()) @db.Uuid
    email            String    @unique @db.VarChar(254)
    passwordHash     String    @map("password_hash")
    disabled         Boolean   @default(false)
    createdAt        DateTime  @default(now()) @map("created_at")
    @db.Timestamptz(6)
    updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
    importedDatasets Dataset[]

    @@map("users")
  }

  model Dataset {
    id              String             @id @default(uuid()) @db.Uuid
    source          DatasetSource
    sourceFilename  String             @map("source_filename")
    sourceChecksum  String             @map("source_checksum") @db.Char(64)
    priceSnapshotId String             @map("price_snapshot_id") @db.Uuid
    importedById    String?            @map("imported_by_id") @db.Uuid
    createdAt       DateTime           @default(now()) @map("created_at")
    @db.Timestamptz(6)

    priceSnapshot   PriceSnapshot      @relation(
      fields: [priceSnapshotId],
      references: [id],
      onDelete: Restrict,
      onUpdate: Restrict
    )
    importedBy      User?              @relation(
      fields: [importedById],
      references: [id],
      onDelete: Restrict,
      onUpdate: Restrict
    )
    trades          Trade[]
    activeStates    ApplicationState[]

    @@map("datasets")
  }

  ### Financial-history relations

  model Price {
    snapshotId String        @map("snapshot_id") @db.Uuid
    symbol     String
    priceUsd   Decimal       @map("price_usd") @db.Decimal(38, 18)

    snapshot   PriceSnapshot @relation(
      fields: [snapshotId],
      references: [id],
      onDelete: Restrict,
      onUpdate: Restrict
    )

    @@id([snapshotId, symbol])
    @@map("prices")
  }

  model Trade {
    datasetId       String    @map("dataset_id") @db.Uuid
    tradeId         String    @map("trade_id")
    sourceRowNumber Int       @map("source_row_number")
    timestamp       DateTime  @db.Timestamptz(6)
    exchange        Exchange
    symbol          String
    side            TradeSide
    quantity        Decimal   @db.Decimal(38, 18)
    priceUsd        Decimal   @map("price_usd") @db.Decimal(38, 18)
    feeUsd          Decimal   @map("fee_usd") @db.Decimal(38, 18)

    dataset         Dataset   @relation(
      fields: [datasetId],
      references: [id],
      onDelete: Restrict,
      onUpdate: Restrict
    )

    @@id([datasetId, tradeId])
    @@unique([datasetId, sourceRowNumber])
    @@index([datasetId, timestamp, tradeId], map: "trades_dataset_time_idx")
    @@index(
      [datasetId, symbol, timestamp, tradeId],
      map: "trades_dataset_symbol_time_idx"
    )
    @@map("trades")
  }

  model ApplicationState {
    id              Int      @id @default(1) @db.SmallInt
    activeDatasetId String   @map("active_dataset_id") @db.Uuid
    updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

    activeDataset   Dataset  @relation(
      fields: [activeDatasetId],
      references: [id],
      onDelete: Restrict,
      onUpdate: Restrict
    )

    @@map("application_state")
  }

  ### Session model decision

  Do not introduce a custom Prisma-managed session model with invented columns
  or relations.

  The migration should create the official connect-pg-simple table verbatim.
  Application code accesses it only through the session-store library.

  ## 4. Updated transaction boundaries

  ### Initial seed

  Outside the transaction:

  1. Parse and validate prices and trades.
  2. Verify symbol coverage and ordered SELL validity.
  3. Calculate the reference portfolio.

  Inside one transaction:

  1. Check whether application_state exists.
  2. If it exists, exit without writing.
  3. Insert the price snapshot and prices.
  4. Insert the dataset and trades.
  5. Insert singleton application_state.
  6. Commit.

  If another initializer wins the singleton insert race, roll back the losing
  transaction and reread the existing state.

  ### Successful trade import

  Before validation:

  1. Read the current active dataset ID as expectedDatasetId.
  2. Read that dataset’s immutable price snapshot.

  Outside the transaction:

  1. Parse and validate the complete trade file against the captured snapshot.
  2. Run the complete portfolio calculation.

  Inside one transaction:

  1. Insert the new dataset referencing the captured snapshot.
  2. Insert all trades.
  3. Conditionally update application_state where its active ID still equals
     expectedDatasetId.

  4. If the affected-row count is zero, throw DATASET_CHANGED; the transaction
     rolls back.

  5. Otherwise commit.

  ### Failed import

  - Parse/domain validation failure: perform no writes.
  - Database insert failure: roll back.
  - Optimistic activation failure: roll back inserted dataset/trades and
    return 409 DATASET_CHANGED.

  - The previously active dataset remains unchanged in every failure case.

  ### Reset

  Before validation:

  1. Capture the current active dataset ID as expectedDatasetId.

  Outside the transaction:

  1. Parse and validate canonical prices and trades.
  2. Calculate the reference portfolio.

  Inside one transaction:

  1. Insert the new sample price snapshot and prices.
  2. Insert the new sample dataset and trades.
  3. Conditionally update the active pointer using expectedDatasetId.
  4. Roll back and return DATASET_CHANGED if another activation committed
     first.

  5. Otherwise commit.

  A retry starts from the newly active state.

  ## 5. Changes made after human review

  - Removed blanket immutability triggers.
  - Changed Dataset.importedBy from ON DELETE SET NULL to ON DELETE RESTRICT.
  - Defined user disabling as the normal lifecycle; imported users cannot be
    hard-deleted.

  - Replaced last-writer-wins with optimistic activation.
  - Added rollback and 409 DATASET_CHANGED behavior for stale import/reset
    operations.

  - Retained only financial, identity, source-row, and singleton SQL checks.
  - Removed database checks for email normalization and checksum formatting.
  - Confirmed that all financial-history foreign keys use restrictive actions.
  - Replaced the proposed custom session representation with the official
    three-column connect-pg-simple table.

  ## 6. Final recommendation: ACCEPT