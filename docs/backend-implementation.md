Before making any implementation changes, read and follow these repository
documents:

1. `docs/requirements.md`
   - source requirements for the assessment.

2. `PLAN.md`
   - accepted implementation plan after human review.
   - authority for application scope, domain behavior, implementation order,
     frontend/backend boundaries, and acceptance criteria.

3. `docs/architecture-data-model.md`
   - accepted PostgreSQL/Prisma architecture decision after human review.
   - authority for database entities, relationships, constraints, indexes,
     deletion behavior, transaction boundaries, and optimistic dataset
     activation.

4. `AGENTS.md`
   - repository instructions and skill routing.

5. `$backend-typescript-quality`
   - required coding-quality skill for this backend task.

Precedence:

- The assessment requirements and `docs/requirements.md` define what the
  application must do.
- `PLAN.md` defines the accepted implementation plan.
- For database/schema/persistence details,
  `docs/architecture-data-model.md` supersedes any earlier or less-specific
  proposal in `PLAN.md`.
- `AGENTS.md` and `$backend-typescript-quality` govern how the code should be
  implemented, not what the product requirements are.

If you find a contradiction between these documents:

- do not silently choose one;
- identify the conflicting statements;
- follow the precedence above when it resolves the conflict;
- otherwise stop that specific change and report the conflict in the final
  report.

Do not redesign previously accepted architecture unless implementation proves
that a decision is technically invalid.

Use the repository skills applicable to this task.

Explicitly load and apply:

* `$backend-typescript-quality`

Follow `PLAN.md` as the accepted architecture authority.

This is Implementation Milestone 1 only.

Do not implement frontend features yet, so do not load the frontend skill unless
you actually need to modify frontend TypeScript infrastructure.

## Goal

Implement the project foundation and accepted PostgreSQL/Prisma data model with
production-quality NestJS/TypeScript conventions.

The implementation must follow the backend skill's TypeScript, SOLID,
dependency-boundary, error-handling, and testability guidance.

Prefer simple, explicit, maintainable code over abstraction for abstraction's
sake.

## Step 1 — Inspect before modifying

Before editing:

* inspect the repository structure;
* inspect `AGENTS.md`;
* load `$backend-typescript-quality`;
* inspect `PLAN.md`;
* inspect package/workspace configuration;
* inspect existing NestJS files;
* inspect existing Prisma schema and migrations;
* inspect Docker/database setup if present;
* inspect existing tests and lint/typecheck scripts.

If an existing decision conflicts with the accepted plan, report it instead of
silently replacing it.

Determine whether any existing migration has already been applied.

Do not rewrite applied migration history.

## Scope

Implement only:

1. workspace/backend foundation required for later features;
2. PostgreSQL/Prisma schema;
3. initial database migration;
4. required database constraints;
5. PostgreSQL session-table migration;
6. database configuration;
7. environment validation;
8. Prisma/database infrastructure;
9. minimal bootstrap infrastructure needed for later sample-data initialization;
10. tests that directly verify this milestone where practical.

Do NOT implement yet:

* portfolio calculator;
* trade CSV import feature;
* dataset replacement service;
* authentication endpoints;
* portfolio endpoint;
* transaction endpoint;
* React screens;
* charts.

## Accepted data model

Implement:

* User
* PriceSnapshot
* Price
* Dataset
* Trade
* ApplicationState

and only the accepted enums required by the domain.

### User

Support provisioned authenticated users.

Dataset provenance must use a nullable importing-user relationship for automated
seed data.

For user-linked datasets:

* ON DELETE RESTRICT;
* ON UPDATE RESTRICT.

Do not introduce cascade deletion of financial history.

### PriceSnapshot

Represents one immutable price snapshot.

Store:

* UUID identity;
* snapshot/as-of UTC timestamp;
* source filename;
* source checksum;
* created timestamp.

### Price

Identity:

* `(snapshot_id, symbol)`

Rules:

* symbol is dynamic text;
* do not create a five-symbol enum;
* price uses `NUMERIC(38,18)`;
* price must be > 0.

### Dataset

Represents one successfully validated trade dataset.

Store:

* UUID;
* source;
* filename;
* checksum;
* referenced price snapshot;
* optional importing user;
* created timestamp.

Do not add:

* active boolean;
* persisted portfolio result;
* persisted holdings;
* cost basis;
* P&L projections.

### Trade

Identity:

* `(dataset_id, trade_id)`

Preserve:

* trade ID;
* source CSV row number;
* timestamp;
* exchange;
* symbol;
* side;
* quantity;
* execution price;
* fee.

Financial fields use:

`NUMERIC(38,18)` / Prisma Decimal.

Exchange is transaction metadata.

It must not create an exchange-based holding or cost-basis relationship.

### ApplicationState

Use a singleton active-dataset pointer.

Store only state that actually belongs there.

Enforce:

`id = 1`

Do not duplicate dataset metadata or financial results in this table.

## Required constraints

Implement the accepted stable database constraints:

* application_state.id = 1;
* trimmed/nonempty trade_id;
* trimmed/nonempty trade symbol;
* trimmed/nonempty price symbol;
* source_row_number >= 2;
* quantity > 0;
* trade price_usd > 0;
* fee_usd >= 0;
* snapshot price_usd > 0.

Do NOT add database constraints for:

* email syntax;
* email normalization;
* checksum format;
* trade-symbol/price coverage;
* SELL inventory validity;
* transaction ordering.

Those belong to application/domain validation.

## Indexes

Implement:

* `(dataset_id, timestamp, trade_id)`
* `(dataset_id, symbol, timestamp, trade_id)`

Do not add speculative indexes for:

* exchange;
* side;

unless existing repository/query-plan evidence proves they are needed.

## Session storage

Use the exact session-table schema required by the installed
`connect-pg-simple` version.

Do not rely on memory or on PLAN.md for the exact SQL.

Inspect the installed package's supplied schema/migration source.

Requirements:

* migrations own session-table creation;
* `createTableIfMissing = false`;
* do not add custom user FK, UUID, timestamps, or application-specific columns
  to the session table unless the package requires them.

## Architecture / code-quality requirements

Apply `$backend-typescript-quality`.

In particular:

* strict TypeScript;
* no `any` unless a real external boundary requires immediate narrowing;
* do not leak Prisma types throughout domain/application layers unnecessarily;
* keep infrastructure concerns isolated;
* do not create interfaces merely because a class exists;
* do not create speculative repository abstractions;
* use dependency injection appropriately;
* keep modules focused;
* avoid hidden side effects;
* avoid static/global mutable state;
* make initialization behavior testable;
* financial values must never pass through JavaScript floating-point arithmetic.

This milestone is infrastructure-focused, so do not create empty architecture
layers solely to satisfy SOLID terminology.

## Migration requirements

If the repository's previous migration is only an uncommitted/unapplied draft,
replace it with the accepted initial design if appropriate.

If it has been applied anywhere, preserve migration history and create a forward
migration.

Migration SQL must be reviewed after generation.

Verify explicitly:

* composite primary keys;
* foreign-key actions;
* CHECK constraints;
* NUMERIC precision;
* indexes;
* session table;
* application_state singleton constraint.

Do not assume Prisma generated the intended SQL.

## Verification

Actually run the applicable commands.

At minimum:

* dependency install if dependencies changed;
* Prisma format;
* Prisma validate;
* database migration against the local development PostgreSQL instance;
* TypeScript typecheck;
* lint;
* affected automated tests;
* production/backend build if already supported by the project.

Inspect the resulting migration SQL and/or PostgreSQL schema.

Do not report a test or command as passing unless you ran it successfully.

If something fails:

1. identify the root cause;
2. fix it if it belongs to this milestone;
3. rerun the relevant verification;
4. report both the failure and correction.

## Self-review before completion

Use `$backend-typescript-quality` again as a review checklist.

Review the diff specifically for:

* unnecessary abstraction;
* SOLID violations;
* oversized responsibilities;
* unsafe typing;
* Prisma leakage;
* incorrect Decimal handling;
* accidental cascade actions;
* missing database constraints;
* redundant indexes;
* duplicated configuration;
* hidden initialization side effects;
* untested infrastructure behavior.

Fix issues you find before producing the report.

## Final report

Return:

1. Skills used.
2. Files created/modified.
3. Architecture implemented.
4. Important code-quality decisions.
5. Migration/schema verification.
6. Commands actually executed with pass/fail results.
7. Problems encountered and how they were corrected.
8. Any deliberate deviations from PLAN.md and why.
9. Remaining risks/TODOs.
10. Git diff summary.
11. Suggested commit message.

Do not begin the next milestone.
