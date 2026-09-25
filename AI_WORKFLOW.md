# AI Coding-Agent Workflow

## Tools and models used

- OpenAI Codex in the repository coding environment — primary planning, coding, review, and debugging agent. The workflow notes identify Codex as the tool; the exact model identifier was not separately recorded in every note, so I am not inventing one here.
- ChatGPT — supplemental requirement review, architecture discussion, and review support.

AI agents were used heavily throughout the project. I reviewed the generated work, corrected or rejected outputs where needed, and verified accepted changes with code review, tests, API checks, database checks, and manual UI testing. I own the submitted code and can explain or modify it during review.

---

## Requirement analysis and implementation planning

### Goal and context

Before implementation, I used Codex to turn the assessment specification, `requirements.md`, `trades.csv`, and `prices.csv` into a concrete plan. The goal was to identify the domain rules, application boundaries, implementation order, edge cases, and acceptance criteria before writing code.

The most important domain rule was that portfolio positions and weighted-average cost basis must be aggregated by asset symbol across exchanges. Exchange is retained only as transaction metadata for filtering and traceability.

### Prompt

I asked Codex to review the supplied requirements and data before making implementation changes and produce:

- functional requirements;
- domain and calculation rules;
- proposed database entities;
- backend modules and API endpoints;
- frontend screens;
- authentication flow;
- CSV import strategy;
- edge cases;
- testing strategy;
- implementation order;
- measurable acceptance criteria.

I explicitly instructed Codex not to implement code yet and to label assumptions instead of silently inventing behavior.

After reviewing the first plan, I sent a follow-up prompt requiring revisions:

- do not hard-code BTC, ETH, SOL, CKB, and DOGE as the only supported symbols;
- distinguish current holdings from historical per-symbol performance;
- distinguish verified assessment requirements from architectural choices and assumptions;
- reconsider unnecessary authentication and concurrency complexity;
- review repeatable-read transactions, PostgreSQL advisory locks, mandatory dataset IDs on transaction requests, and custom CSRF-token persistence;
- preserve Decimal/NUMERIC arithmetic, atomic dataset replacement, and symbol-level aggregation across exchanges.

### Agent response

Codex produced an implementation plan covering the domain model, PostgreSQL persistence, REST APIs, authentication, CSV validation, frontend behavior, testing, deployment, and acceptance criteria.

The initial plan correctly identified weighted-average cost accounting, BUY and SELL fee treatment, deterministic ordering, full-close/reopen behavior, and aggregation by symbol rather than exchange.

However, the initial plan also introduced assumptions and mechanisms that were not assessment requirements, including a fixed five-symbol allowlist and extra concurrency/authentication complexity.

After my review, Codex revised the plan to:

- store symbols dynamically as text and validate them against the active price snapshot;
- treat only symbols with positive remaining quantity as current holdings while retaining realized P&L and fees from closed assets;
- simplify authentication to PostgreSQL-backed sessions, secure cookies, SameSite protection, and origin validation;
- remove repeatable-read transactions for normal reads;
- remove PostgreSQL advisory locks;
- remove mandatory client-provided `datasetId` from transaction requests;
- separate verified requirements, derived domain rules, architectural decisions, and assumptions.

### My review

I checked the plan against the assessment and the supplied CSV data. I specifically reviewed:

- whether exchange had incorrectly become part of the position key;
- whether financial calculations could introduce JavaScript floating-point errors;
- whether invalid imports could modify the active dataset;
- whether assumptions were presented as requirements;
- whether closed positions were being confused with current holdings;
- whether authentication and consistency designs were unnecessarily complex.

I rejected the fixed symbol allowlist because the five symbols were properties of the supplied dataset, not a domain restriction.

I also asked Codex to remove mechanisms that added complexity without materially improving the required behavior.

### Outcome

I accepted the revised `PLAN.md` as the implementation baseline. I did not accept the first AI-generated plan unchanged.

Important human-directed corrections:

- replaced fixed sample-symbol assumptions with price-snapshot-driven symbol validation;
- separated current holdings from historical realized performance;
- removed unnecessary database isolation and locking mechanisms;
- removed unnecessary API coupling through mandatory dataset IDs;
- simplified authentication and CSRF design;
- required clear separation of assessment requirements, implementation choices, and assumptions.

Relevant files:

- `PLAN.md`
- `docs/assessment.pdf`
- `docs/trades.csv`
- `docs/prices.csv`

Relevant commit: `a46e15404c4cb29a29d5d739288b272ec669e8ca`

Codex produced most of the planning draft. I reviewed and corrected the plan before accepting it.

---

## PostgreSQL / Prisma architecture and data-model decision

### Goal and context

After accepting the high-level plan, I used Codex to design the PostgreSQL and Prisma data model before implementing application features.

The goals were to preserve immutable trade datasets, support one globally active dataset, make calculations reproducible by associating each dataset with its exact price snapshot, avoid persisting derived holdings or P&L, preserve exact financial precision, support atomic dataset replacement, and keep exchange as transaction metadata rather than part of the cost-basis model.

The proposed entities were users, sessions, price snapshots, prices, datasets, trades, and application state.

### Prompt

I asked Codex to design the PostgreSQL/Prisma schema without implementing application services or frontend code.

The prompt required documentation of columns and PostgreSQL types, primary and foreign keys, unique constraints, indexes, nullability, delete/update behavior, Prisma models, transaction boundaries, database invariants, alternatives, and risks.

Important constraints included immutable datasets, atomic failed-import behavior, dynamic symbols, `NUMERIC`/Decimal financial fields, no persisted portfolio projections, and no exchange-partitioned portfolio positions.

### Agent response

Codex proposed the core persistence model:

- `(snapshot_id, symbol)` identity for prices;
- `(dataset_id, trade_id)` identity for trades;
- datasets referencing the exact price snapshot used for valuation;
- singleton `application_state` containing the globally active dataset ID;
- PostgreSQL `NUMERIC(38,18)` mapped to Decimal-compatible Prisma fields;
- indexes for transaction browsing and symbol filtering.

The initial architecture response also proposed raw SQL triggers rejecting updates to immutable financial tables, `ON DELETE SET NULL` for the dataset importing user, and last-writer-wins activation for concurrent imports/resets.

### My review

I found two important issues.

First, a blanket dataset UPDATE trigger conflicted with `ON DELETE SET NULL`. Deleting an importing user would require PostgreSQL to update `datasets.imported_by_id` to NULL, but the trigger would reject that update.

Second, last-writer-wins import/reset activation allowed a long-running import to capture old state, let another reset commit, and then activate stale work later because it committed last.

I asked Codex to compare last-writer-wins with optimistic activation and to simplify the design unless triggers or advisory locks provided a concrete requirement-level benefit.

I also asked it to verify the session table against the actual installed `connect-pg-simple` package rather than inventing a custom session schema.

### Outcome

I accepted the revised architecture after Codex made these changes:

- removed raw SQL immutability triggers;
- changed user-linked dataset provenance to restrictive foreign keys;
- used account disabling rather than deletion for users tied to financial history;
- replaced last-writer-wins activation with optimistic concurrency;
- captured expected active dataset before validation;
- conditionally updated `application_state` only if the expected dataset was still active;
- returned `409 DATASET_CHANGED` and rolled back when another import/reset committed first;
- reduced database CHECK constraints to stable structural/financial invariants;
- kept email normalization, checksum format, symbol-price coverage, and SELL inventory validity in application/domain validation;
- used the standard `connect-pg-simple` session table.

Relevant files:

- `docs/architecture-data-model.md`
- `backend/prisma/schema.prisma`

Relevant commit: `8b69ebaca543e6c6928644810318e1e12425ca1a`

Codex produced the architecture proposal. I rejected conflicting immutability-trigger and concurrency behavior, then accepted the revised design.

---

## Backend and database foundation implementation

### Goal and context

After planning and data-model review, I used Codex to implement the first backend foundation milestone. The scope was limited to the NestJS/TypeScript backend foundation and reviewed PostgreSQL/Prisma schema.

The milestone explicitly excluded authentication endpoints, portfolio calculations, CSV import, portfolio APIs, transaction APIs, and frontend code.

### Prompt

I instructed Codex to read and follow `docs/requirements.md`, `PLAN.md`, `docs/architecture-data-model.md`, `AGENTS.md`, and `$backend-typescript-quality`.

The prompt required strict TypeScript, PostgreSQL `NUMERIC(38,18)` financial columns, dynamic symbols, composite identities for prices/trades, restrictive foreign keys, singleton `application_state`, no persisted derived holdings/P&L, no exchange-based portfolio relationships, accepted CHECK constraints only, accepted indexes only, and the exact session-table structure required by `connect-pg-simple`.

I also required migration SQL review and verification commands before reporting success.

### Agent response

Codex created the backend/database foundation, including workspace files, backend package/config files, Prisma schema and initial migration, NestJS app module, main bootstrap, environment validation, database module, Prisma service, environment tests, and schema integration tests.

The implemented models were `User`, `PriceSnapshot`, `Price`, `Dataset`, `Trade`, and `ApplicationState`.

The implementation preserved dynamic symbol strings, `(snapshot_id, symbol)` price identity, `(dataset_id, trade_id)` trade identity, `NUMERIC(38,18)` financial columns, restrictive financial-history foreign keys, singleton active dataset state, no persisted portfolio projections, no exchange-based cost-basis modeling, and the session table shape required by `connect-pg-simple@10.0.0`.

### My review

I checked that Codex had not expanded the scope into auth endpoints, portfolio logic, import behavior, APIs, or frontend work.

I reviewed the schema properties: composite primary keys, foreign-key delete/update actions, numeric precision, singleton `application_state`, database CHECK constraints, session table structure, absence of persisted derived portfolio state, and absence of exchange-based position modeling.

I also reviewed the reported verification rather than accepting the implementation blindly.

During review I corrected one explanation: Codex stated that PostgreSQL 17 no longer supports the old `WITH (OIDS=FALSE)` clause from session-store SQL. I accepted omitting the obsolete clause but did not accept that explanation as written; the omission is better described as cleanup/modern compatibility while preserving required session columns and indexes.

### Outcome

I accepted the backend/database foundation after reviewing scope, schema behavior, and verification.

Problems encountered and corrected during the milestone included dependency installation requiring network/sandbox approval, Prisma generation cache-permission issues, local PostgreSQL port `5432` being occupied so the project used `5433`, an initial PostgreSQL catalog verification query mishandling `name[]` output and unrelated `information_schema` domain checks, and Jest initially mixing unit and integration suites before configs were separated.

Reported verification included:

```bash
pnpm install --frozen-lockfile
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:format
pnpm --filter backend prisma:validate
pnpm --filter backend prisma:migrate:deploy
pnpm --filter backend typecheck
pnpm --filter backend lint
pnpm --filter backend test
pnpm --filter backend test:integration
pnpm --filter backend build
```

Relevant files:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/202609240001_initial_schema/migration.sql`
- `backend/src/config/environment.ts`
- `backend/src/database/database.module.ts`
- `backend/src/database/prisma.service.ts`
- `backend/test/schema.integration.spec.ts`

Relevant commit: `96d364bd9b16921dae44093e13d3b5345131aeeb`

Codex produced most of the initial backend/database foundation. I reviewed the architecture conformance, schema behavior, verification results, and corrected an inaccurate compatibility explanation.

---

## Pure portfolio calculator and financial regression tests

### Goal and context

After establishing the backend/database foundation, I used Codex to implement the core financial domain component independently from HTTP, persistence, CSV parsing, authentication, and frontend code.

The goal was a deterministic weighted-average-cost calculator that could be tested before application layers depended on it.

Important requirements included one cost-basis pool per symbol across exchanges, Decimal-based financial arithmetic, deterministic ordering by timestamp and trade ID, correct BUY and SELL fee treatment, partial-sale average-cost preservation, exact full-close behavior, close/reopen lifecycle handling, short-position rejection, current valuation and unrealized P&L, totals from unrounded values, dynamic symbols, and full regression against the supplied data.

### Prompt

I instructed Codex to use `$backend-typescript-quality` and implement only a pure portfolio domain calculator and tests.

The prompt prohibited dependencies on Prisma, PostgreSQL, NestJS controllers/providers, HTTP DTOs, production CSV parsing, authentication, and frontend code.

I required explicit tests for multiple BUYs, BUY fees, partial SELLs, SELL fees, full close, reopen, cross-exchange aggregation, timestamp and trade-ID ordering, dynamic non-sample symbols, insufficient quantity, missing prices, zero-value portfolios, Decimal precision, and the supplied-data regression.

The reference totals were provided as test expectations only, with instructions not to hard-code them into production logic or round intermediate values to make tests pass.

### Agent response

Codex created a framework-independent portfolio domain module containing typed trade and price inputs, portfolio output types, Decimal utilities, explicit portfolio calculation errors, and the main calculation function.

It selected `decimal.js@10.6.0` rather than coupling the domain to `Prisma.Decimal`.

The calculator keys positions only by symbol, treats exchange as metadata, sorts trades by timestamp and trade ID, capitalizes BUY fees into cost basis, subtracts SELL fees from proceeds, preserves remaining average cost after partial sale, tracks realized P&L across close/reopen cycles, excludes closed positions from current holdings while retaining historical performance, values open positions from the supplied price map, returns Decimal values, and calculates totals from unrounded domain results.

Codex added focused calculator and supplied-data regression tests.

### My review

I checked exchange was not used as a position key, JavaScript `number` was not used for financial arithmetic, Prisma/NestJS dependencies had not leaked into the calculator, BUY and SELL fee treatment, partial-sale basis behavior, full close and reopen behavior, deterministic ordering, missing-price behavior, dynamic symbol support, and sample totals.

The supplied-data regression matched:

- Current value: `$60,620.89`
- Remaining cost basis: `$59,969.24`
- Realized P&L: `-$5,052.96`
- Unrealized P&L: `$651.65`
- Total P&L: `-$4,401.31`
- Fees: `$2,708.86`

During testing, Codex found a real numerical bug in the initial full-close implementation. It initially calculated `costRemoved = averageCost × fullRemainingQuantity`. When average cost came from a repeating Decimal division, multiplying the high-precision quotient back by the full quantity left a tiny residue.

I reviewed and accepted the correction: when a SELL exactly closes the remaining quantity, remove the entire remaining cost basis. This guarantees quantity, cost basis, and average cost become exact Decimal zero without currency-scale rounding.

I also rejected a documentation inconsistency in the Codex report claiming the accepted `PLAN.md` still contained older hard-coded-symbol assumptions. I checked the repository plan rather than accepting that statement.

### Outcome

I accepted the calculator after the full-close precision bug was corrected and verification passed.

Relevant files:

- `backend/src/portfolio/domain/calculate-portfolio.ts`
- `backend/src/portfolio/domain/portfolio.types.ts`
- `backend/src/portfolio/domain/portfolio-calculation.error.ts`
- `backend/src/portfolio/domain/decimal.ts`
- `backend/src/portfolio/domain/calculate-portfolio.spec.ts`
- `backend/test/portfolio/supplied-data.fixture.ts`
- `backend/test/portfolio/supplied-data.unit.spec.ts`

Relevant commit: `384e90b8c77b7a97cd8bf89aa45d7a15ef70e112`

Codex produced most of the calculator implementation and tests. I reviewed the financial logic, corrected inconsistent reporting, and accepted the precision fix only after tests proved the behavior.

---

## CSV import, atomic dataset replacement, and concurrency

### Goal and context

After the calculator was implemented, I used Codex to build the dataset lifecycle around it: production CSV parsing/validation, sample-data initialization, active dataset replacement, reset behavior, persistence, and optimistic concurrency.

Correctness requirements included invalid data never replacing the active dataset, portfolio-domain validation reusing the calculator rather than duplicating financial logic, financial CSV values parsing directly from strings into Decimal values, successful imports becoming active atomically, failed database operations rolling back, stale imports/resets failing instead of overwriting newer state, and application restart not overwriting a user-imported dataset.

### Prompt

I instructed Codex to use `$backend-typescript-quality` and implement only the import/dataset lifecycle layer.

The prompt required production trade and price CSV parsing, strict row-level validation with stable errors, direct string-to-Decimal financial parsing, dynamic symbol validation against the selected price snapshot, reuse of the calculator for short-position and portfolio-domain validation, SHA-256 source checksums, immutable dataset/price/trade creation, first-time sample initialization, idempotent bootstrap behavior, atomic trade dataset replacement, canonical sample reset, optimistic activation using expected active dataset ID, rollback when expected dataset changed, and PostgreSQL integration tests.

I explicitly prohibited authentication endpoints, HTTP controllers, portfolio/transaction APIs, frontend code, and duplicated portfolio formulas.

### Agent response

Codex implemented production CSV parsing, CSV/domain validation, import error types, source metadata/checksum handling, sample-data services, dataset lifecycle orchestration, PostgreSQL persistence and activation, optimistic concurrency, and tests.

The implementation supported first-time sample initialization, repeated bootstrap without reseeding, trade dataset replacement, sample reset, SHA-256 provenance, immutable persisted history, conditional active-state activation, and rollback on validation failure, database failure, and stale activation.

The existing pure calculator remained the source of truth for financial-history validity.

### My review

I checked that financial CSV fields were not parsed through `Number` or `parseFloat`, exchange remained metadata only, symbols were not restricted to the five supplied sample assets, parser/domain code did not depend on Prisma, portfolio formulas were not duplicated in import code, parsing and portfolio simulation happened outside the database write transaction, invalid imports performed no active-state change, successful replacement inserted immutable history and switched the active pointer atomically, and stale activation used optimistic concurrency rather than last-writer-wins.

The optimistic activation behavior followed the reviewed architecture:

1. capture the currently active dataset ID;
2. validate the candidate dataset outside the write transaction;
3. insert the immutable dataset/trades inside one transaction;
4. conditionally update `application_state` only if the expected dataset is still active;
5. roll back and return `DATASET_CHANGED` when another operation committed first.

### Outcome

I accepted the import/dataset lifecycle after tests passed.

Automated tests covered valid sample CSVs, missing columns, malformed CSV input, empty/duplicate trade IDs, invalid timestamps, invalid exchange/side values, invalid Decimal syntax and bounds, duplicate/invalid prices, missing symbol prices, dynamic non-sample symbols, short-position validation mapping, initialization, repeated initialization, invalid import preserving active data, atomic replacement, database rollback, stale activation, sample reset, failed reset, repeated reset, and concurrent first-time initialization.

The sample initialization/reset continued to reproduce the accepted portfolio display values.

Human correction: the Codex report stated that `PLAN.md` still contained older decisions about advisory locking, repeatable-read behavior, and fixed sample symbols. Those statements conflicted with the already reviewed plan, so I did not treat that part of the report as authoritative.

Relevant files:

- `backend/src/imports/application/dataset-lifecycle.service.ts`
- `backend/src/imports/application/sample-data.service.ts`
- `backend/src/imports/domain/csv-parser.ts`
- `backend/src/imports/domain/csv-portfolio-parser.ts`
- `backend/src/imports/domain/import-error.ts`
- `backend/src/imports/domain/import-types.ts`
- `backend/src/imports/domain/source-metadata.ts`
- `backend/test/imports/csv-parser.unit.spec.ts`
- `backend/test/imports/dataset-lifecycle.integration.spec.ts`

Relevant commit: `17d0fa494f02eca05bc61e93e0649ed9de85cdd3`

Codex produced most of the import and dataset-lifecycle implementation and tests. I reviewed the transaction boundaries, Decimal parsing, and stale-activation behavior before accepting it.

---

## Frontend architecture, responsive UX, and API integration planning

### Goal and context

After the main backend features were implemented, I used Codex to plan the React frontend before writing UI code.

The frontend needed to support login and session-based authentication, portfolio dashboard, transaction explorer, CSV import and sample reset, loading/error/empty/conflict/session-expired states, responsive desktop/tablet/mobile layouts, accessibility, and a consistent Tailwind CSS visual system.

Selected stack: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, and Recharts.

### Prompt

I asked Codex to create `FRONTEND_PLAN.md` only and not implement frontend code yet.

The prompt required planning for `/login`, `/`, `/transactions`, and `/data`.

It also required a professional financial-dashboard UI, six KPI cards, holdings and transaction tables, allocation and P&L charts, CSV upload/reset flows, responsive desktop/tablet/mobile layouts, query/mutation architecture, loading/error/empty/conflict states, keyboard accessibility, chart text alternatives, frontend tests, and Tailwind design tokens.

I explicitly required the frontend to treat backend financial values as the source of truth and not reimplement portfolio calculations.

### Agent response

Codex produced a frontend plan covering route structure, page layouts, component hierarchy, Tailwind tokens, responsive breakpoints, query keys, mutations and cache invalidation, authentication UX, error/loading states, accessibility, testing strategy, and implementation order.

The proposed UI used a neutral light background, white cards, subtle borders/shadows, indigo as the primary interaction accent, green/red only for gain/loss states, and visible signs/text in addition to color.

The plan separated server state from UI state using TanStack Query and avoided a global store for API data.

### My review

I accepted the main layout, route structure, responsive strategy, Tailwind direction, component boundaries, and TanStack Query approach.

I required corrections before implementation:

- inspect actual backend controllers and DTOs before coding instead of treating planned response shapes as authoritative;
- remove a proposed `['dataset', 'active']` query key because active dataset metadata came from the portfolio response and there was no dedicated endpoint;
- distinguish login 401 from protected-route/session-expired 401;
- prohibit frontend financial calculations;
- allow Decimal-string-to-number conversion only for chart coordinates;
- keep formatting as presentation only, not business logic.

### Outcome

I accepted the frontend plan as the UI/UX implementation baseline after those corrections.

Relevant files:

- `FRONTEND_PLAN.md`
- `docs/requirements.md`
- `PLAN.md`
- `AGENTS.md`
- `.agents/skills/frontend-typescript-quality/SKILL.md`

Relevant commit: `b9c9f7ad1bb77d2a2f40e21b03f8ec0d9aa99b70`

Codex produced most of the frontend planning document. I reviewed and corrected API/state-management assumptions, authentication error handling, and the boundary between backend financial logic and frontend presentation.

---

## Final ownership statement

Codex produced substantial parts of the planning documents, backend/database foundation, portfolio calculator, import lifecycle, tests, and frontend planning. I reviewed the work throughout, asked for revisions where outputs were over-assumptive or overly complex, corrected inaccurate explanations, and verified accepted changes through automated tests and manual checks.

I remain responsible for the submitted application and can explain the requirements, architecture, calculations, validation behavior, tests, and tradeoffs.
