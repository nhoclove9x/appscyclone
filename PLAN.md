# Implementation Plan: Crypto Portfolio Analytics

  ## 1. Summary and verified inputs

  The project will be a TypeScript monorepo with two application folders:

  - backend/: NestJS REST API, authentication, PostgreSQL persistence, CSV
    validation, and all portfolio calculations.

  - frontend/: React application consuming the REST API.
  - Root-level configuration will contain Docker Compose, workspace scripts,
    sample-data/, README.md, and AI_WORKFLOW.md.

  No implementation changes have been made.

  Inputs reviewed:

  - docs/requirements.md
  - docs/trades.csv
  - docs/prices.csv
  - Original assessment: docs/assessment.pdf

  Verified source facts:

  - 200 unique trades: 40 each for BTC, ETH, SOL, CKB, and DOGE.
  - 128 BUY and 72 SELL trades.
  - 100 Binance and 100 Coinbase trades.
  - Five unique prices with snapshot time 2026-03-31T23:59:59Z.
  - Each asset contains two full closes followed by reopen activity.
  - No trade in the sample creates a short position.
  - Independent Decimal calculations reproduce the reference totals:
      - Current value: $60,620.89
      - Remaining cost basis: $59,969.24
      - Realized P&L: -$5,052.96
      - Unrealized P&L: +$651.65
      - Total P&L: -$4,401.31
      - Fees: $2,708.86

  ### Functional requirements

  - Protected login/logout with no public registration.
  - Shared portfolio for every authenticated user.
  - Dashboard with six portfolio totals, price timestamp, holdings, and two
    charts.

  - Transaction explorer with filters, timestamp sorting, and pagination.
  - Protected trade CSV replacement and sample-data reset.
  - Atomic imports: failed imports leave the current dataset unchanged.
  - PostgreSQL persistence across users and restarts.
  - Public HTTPS deployment with no database exposure.
  - Complete loading, empty, error, stale-data, and success states.
  - Repository documentation and 5–8 truthful AI workflow examples.

  ### Domain rules

  - Positions are grouped strictly by symbol.
  - exchange never creates a separate cost-basis pool.
  - exchange remains stored and filterable for traceability.
  - Transactions are ordered by timestamp ASC, trade_id ASC.
  - BUY fees increase cost basis.
  - SELL fees reduce proceeds.
  - Partial SELL preserves average unit cost.
  - Exact full close resets quantity, cost basis, and average cost to Decimal
    zero.

  - Realized P&L survives later reopening.
  - Portfolio totals are calculated from unrounded values.
  - All financial values remain PostgreSQL NUMERIC or Decimal objects and
    cross API boundaries as strings.

  - Frontend never recalculates portfolio finance logic.

  ## 2. Architecture, persistence, APIs, and security

  ### Application structure

  Use a modular monolith and feature-first organization.

  Backend modules:

  - ConfigModule: validated environment configuration.
  - DatabaseModule: Prisma client, migrations, transactions, readiness checks.
  - UsersModule: provisioned users and password hashes.
  - AuthModule: login, session management, CSRF, guards, logout.
  - PortfolioModule: pure weighted-average calculator and portfolio query
    service.

  - TransactionsModule: filtering, sorting, pagination, and gross-value
    output.

  - ImportsModule: CSV parsing, validation, staging, atomic activation.
  - DatasetsModule: active dataset metadata and sample reset.
  - HealthModule: liveness/readiness endpoints.
  - StaticAppModule: serves the React production build.

  Within each module, controllers remain thin; application services coordinate
  use cases; domain functions contain deterministic rules; repositories
  isolate Prisma/database operations.

  Frontend organization:

  - app/: router, providers, authenticated shell, error boundary.
  - features/auth
  - features/portfolio
  - features/transactions
  - features/data-management
  - shared/api, shared/ui, shared/format, and shared/types

  Enforce strict TypeScript, ESLint, Prettier, no implicit any, DTO
  validation, consistent naming, and dependency boundaries. Generate frontend
  API types from the backend OpenAPI contract.

  ### Database entities

  1. users
      - UUID, normalized unique email, Argon2id password hash, disabled flag,
        timestamps.

  2. sessions
      - Hashed opaque session token, user_id, hashed CSRF token, expiry,
        creation and last-used timestamps.

      - Many sessions belong to one user.

  3. price_snapshots
      - UUID, as_of, source checksum, creation timestamp.

  4. prices
      - Snapshot FK, symbol, price_usd NUMERIC(38,18).
      - Unique constraint on (snapshot_id, symbol).

  5. imports
      - Represents an immutable valid dataset version.
      - UUID, source type SAMPLE | UPLOAD, filename, SHA-256 checksum, row
        count, importing user, linked price snapshot, created/activated
        timestamps.

      - One user may create many imports.
      - One price snapshot may support many imports.

  6. trades
      - Import FK, original trade ID, source row number, timestamp, exchange,
        symbol, side, quantity, price, and fee.

      - Monetary/quantity fields use NUMERIC(38,18).
      - Unique constraint on (import_id, trade_id).
      - Indexes cover timestamp and transaction filters.

  7. application_state
      - Singleton global row containing active_import_id.
      - The active pointer is the sole authority for the shared portfolio.

  Superseded valid imports remain immutable for auditability but have no user-
  facing historical browser in v1. Calculated holdings are not persisted,
  avoiding stale derived data.

  ### REST API

  All endpoints use /api/v1. Financial fields are decimal strings.

  Authentication:

  - POST /auth/login
  - POST /auth/logout
  - GET /auth/me
  - GET /auth/csrf

  Portfolio and transactions:

  - GET /portfolio
      - Returns active dataset metadata, snapshot timestamp, summary, and
        holdings in one coherent response.

  - GET /transactions
      - Query: datasetId, symbol, exchange, side, from, to, sort, page,
        pageSize.

      - Returns every source field, exact gross trade value, pagination
        metadata, and dataset ID.

  Dataset management:

  - POST /imports/trades
      - Authenticated multipart CSV upload.

  - POST /datasets/reset-sample
      - Authenticated reset with explicit confirmation from the frontend.

  Operations:

  - GET /health/live
  - GET /health/ready

  Important public DTOs:

  - DecimalString
  - AuthenticatedUser
  - DatasetMetadata
  - PortfolioSummary
  - Holding
  - TransactionQuery
  - TransactionPage
  - ImportResult
  - ImportValidationError
  - ApiError

  Use a consistent error envelope:

  {
    code,
    message,
    requestId,
    details?
  }

  CSV errors include physical row number, field, trade ID when available, and
  actionable text.

  ### Dataset coherence and concurrency

  - Portfolio reads run in one repeatable-read transaction.
  - GET /transactions requires the dataset ID received from GET /portfolio.
  - If the active dataset changed, return 409 DATASET_CHANGED; React
    invalidates and refetches portfolio and transactions.

  - Import and reset acquire the same PostgreSQL advisory transaction lock.
  - Validation and portfolio simulation complete before database activation.
  - A successful import transaction inserts the import/trades and switches the
    global pointer atomically.

  - Any exception rolls back the new data and leaves the previous pointer
    unchanged.

  ### Authentication flow

  1. Login page submits email/password over the same HTTPS origin.
  2. Backend applies rate limiting, verifies the Argon2id hash, creates a
     random 256-bit opaque session, and stores only its hash.

  3. Production cookie is Secure, HttpOnly, SameSite=Lax, host-only, and
     path /.

  4. Session expires after eight hours.
  5. Login validates the configured origin. All later modifying requests
     require matching origin plus X-CSRF-Token.

  6. Logout deletes the server-side session and clears the cookie.
  7. All portfolio, transaction, import, and reset endpoints reject
     unauthenticated requests.

  8. Evaluator credentials are provisioned through a one-off CLI command using
     environment-provided secrets; plaintext passwords are never stored or
     logged.

  ## 3. Import strategy and frontend product

  ### Initialization and CSV replacement

  - Copy the unchanged source files into sample-data/trades.csv and sample-
    data/prices.csv.

  - After migrations, bootstrap initialization acquires the dataset lock.
  - Seed sample data only when no active dataset exists.
  - Restarting the application never overwrites a user-imported dataset.
  - Reset runs through the same parser, validator, calculator, and activation
    service as normal imports.

  Trade validation pipeline:

  1. Enforce upload size and CSV content type.
  2. Parse with strict quoting and malformed-row detection.
  3. Validate the exact required header set.
  4. Validate nonempty, unique trade IDs.
  5. Require timestamps with an explicit UTC offset.
  6. Validate exchange, symbol, and side enums.
  7. Parse quantity, price, and fee directly as Decimal values.
  8. Reject exponent notation, NaN, Infinity, nonpositive quantity/price, and
     negative fees.

  9. Sort by timestamp and trade ID.
  10. Simulate positions by symbol across both exchanges and reject a short-
     creating SELL.

  11. Confirm every traded symbol has a valid active snapshot price.
  12. Activate the dataset in one transaction.

  prices.csv is user-inaccessible and is imported only during initial seeding/
  reset. Missing, duplicate, invalid, or incomplete prices fail
  initialization/reset visibly. A corrupt active snapshot causes portfolio
  readiness failure and an explicit API error; zero prices are never
  fabricated.

  ### Frontend routes and components

  1. /login
      - Email/password form, validation, pending state, invalid-credential
        state, and session-expired feedback.

  2. /
      - Authenticated dashboard shell.
      - Header with UTC snapshot time and active import metadata.
      - Six KPI values.
      - Holdings table.
      - Current-value allocation chart.
      - Realized versus unrealized P&L chart.
      - Text/table alternatives for chart content.

  3. /transactions
      - Filters for symbol, exchange, side, and inclusive UTC date range.
      - Ascending/descending timestamp sorting.
      - Server-side pagination.
      - All eight CSV fields, gross value, and visible fee.
      - Filters never alter the global portfolio calculations.

  4. /data
      - Shared-data warning.
      - CSV upload with validation-error table.
      - Current dataset metadata.
      - Reset button with a typed or explicit confirmation dialog.
      - Import/reset completion feedback and automatic query invalidation.

  Responsive behavior:

  - KPI grid collapses cleanly.
  - Holdings and transaction tables use horizontal scrolling with sticky
    identifying columns.

  - Controls remain keyboard operable.
  - Focus is visible, labels are semantic, contrast meets WCAG AA, and gains/
    losses use signs and text in addition to color.

  - When total current value is zero, allocations display 0% and the pie chart
    is replaced by an explicit empty-state message.

  ## 4. Testing strategy and implementation order

  ### Automated testing

  Backend unit tests:

  - Multiple BUYs and fee-capitalized average cost.
  - Partial SELL and SELL-fee handling.
  - Full close followed by reopening.
  - Cross-exchange trades sharing one asset pool.
  - Same-timestamp trade-ID ordering.
  - Short-position rejection.
  - Zero holdings and zero total value.
  - Missing price failure.
  - Supplied sample regression for all five assets and portfolio totals.

  CSV/import tests:

  - Missing or unexpected columns.
  - Empty file and malformed CSV.
  - Duplicate or empty IDs.
  - Invalid UTC dates and enums.
  - Invalid decimal syntax and limits.
  - Nonpositive quantity/price and negative fees.
  - Row-level error locations.
  - Failed replacement preserves the previous active dataset.
  - Successful replacement changes all active reads.
  - Reset restores 200 trades, five prices, and reference totals.
  - Concurrent import/reset operations serialize correctly.

  Auth/integration tests:

  - Login success/failure and rate limit.
  - Session expiry/logout.
  - Unauthenticated endpoint rejection.
  - Invalid CSRF/origin rejection.
  - Authenticated import/reset.
  - Secrets and CSV contents absent from logs.
  - Persistence across application restart.

  Frontend tests:

  - Login and route protection.
  - KPI and holdings formatting.
  - Loading, empty, API failure, missing-price, invalid-upload, success, and
    dataset-changed states.

  - Filters mapped correctly to API queries.
  - Reset confirmation.
  - Accessible chart alternatives and keyboard navigation.

  End-to-end/release tests:

  - Playwright flow: login, dashboard, filter/paginate, invalid import, valid
    replacement, reset, logout.

  - Production build and Docker Compose smoke test.
  - Mobile and desktop viewport checks.
  - External clean-browser HTTPS test outside the tailnet.
  - Root command pnpm verify runs lint, typecheck, unit/integration tests,
    frontend tests, and production builds.

  ### Implementation order

  1. Foundation
      - Initialize Git/pnpm workspace, NestJS, React/Vite, strict conventions,
        environment schema, Docker Compose, and CI.

  2. Persistence and authentication
      - Add Prisma schema/migrations, PostgreSQL sessions, evaluator
        provisioning CLI, auth guards, CSRF, and auth integration tests.

  3. Domain calculator
      - Implement the pure Decimal calculator and complete deterministic unit/
        regression tests before HTTP/UI work.

  4. Import and dataset lifecycle
      - Implement parsers, validators, atomic activation, bootstrap seed,
        reset, locking, and persistence tests.

  5. Read APIs
      - Implement coherent portfolio and paginated transaction endpoints,
        OpenAPI schema, and generated frontend types.

  6. Frontend
      - Implement login, dashboard, holdings, charts, explorer, upload/reset,
        responsive states, and accessibility.

  7. Production packaging
      - Build React into the NestJS production image; add ARM64-compatible
        Compose, health checks, persistent PostgreSQL volume, migrations,
        restart policy, backup/restore commands, and localhost-only app
        binding.

  8. Deployment and submission
      - Deploy on the intended always-on Apple Silicon Mac.
      - Publish with tailscale funnel --bg 3000, verify the generated HTTPS
        URL and persistence after reboot. Current Funnel supports background
        persistence and HTTPS proxying to a local port according to the
        official Tailscale Funnel documentation.

      - Verify from an external clean browser.
      - Complete README, actual URLs, and 5–8 reviewed AI_WORKFLOW.md
        examples.

      - Initialize/push the public GitHub repository and deliver credentials
        outside source control.

  ## 5. Assumptions and measurable acceptance criteria

  ### Explicit assumptions

  - Assumption A1: Use pnpm workspaces, Node 24 LTS, React/Vite, NestJS,
    Prisma, and PostgreSQL 17.

  - Assumption A2: Use TanStack Query/Table, React Router, React Hook Form,
    Tailwind, accessible Radix primitives, and Recharts.

  - Assumption A3: All provisioned authenticated users may read, import, and
    reset the single shared dataset; no role hierarchy is required.

  - Assumption A4: Empty trade uploads are rejected. Zero holdings remain
    supported through a valid history that closes every position.

  - Assumption A5: CSV files must contain exactly the documented headers;
    unexpected headers are rejected to catch schema mistakes.

  - Assumption A6: Symbols are restricted to BTC, ETH, SOL, CKB, and DOGE.
  - Assumption A7: Holdings include every symbol appearing in the active trade
    dataset, including fully closed symbols; price-only symbols with no trades
    are not shown.

  - Assumption A8: Date filters are UTC calendar dates: from starts at
    00:00:00Z, and to is implemented as the exclusive start of the following
    UTC day.

  - Assumption A9: Default transaction page size is 25 and the maximum is 100.
  - Assumption A10: Upload limit is 5 MB.
  - Assumption A11: Display rounding is decimal round-half-up: USD to two
    decimals, percentages to two decimals, and quantities/unit prices retain
    enough asset-specific precision. Storage and intermediate values are never
    rounded.

  - Assumption A12: Superseded valid imports are retained for audit but are
    not exposed as a historical browser in v1.

  - Assumption A13: The Mac mini referenced by the requirements is the
    production host. Its exact Tailscale hostname, public URL, GitHub URL, and
    credential-delivery channel remain deployment inputs and will not be
    invented.

  - Assumption A14: Live prices, price uploads, registration, social login,
    trading, blockchain/exchange integrations, and per-user portfolios are out
    of scope.

  ### Acceptance criteria

  1. Authentication
      - Every business endpoint returns 401 without a valid session.
      - Valid credentials create a secure cookie-backed session.
      - Invalid CSRF or origin returns 403.
      - Logout invalidates the server session.
      - No plaintext credential appears in repository, database, or logs.

  2. Portfolio calculation
      - Binance and Coinbase trades for the same symbol produce one holding.
      - Sample data matches all five reference holdings and the portfolio
        totals above.

      - Tests prove fee, partial-sale, full-close, reopen, tie-break, zero-
        value, and short-rejection behavior.

      - API financial values are decimal strings.

  3. Initialization and persistence
      - An empty database initializes exactly 200 trades and five prices.
      - Restart preserves a later user import.
      - Two authenticated browsers see the same active dataset.
      - PostgreSQL remains inaccessible from the public network.

  4. Import/reset
      - Every invalid test file returns actionable row/field errors.
      - A failed import leaves active dataset ID and all displayed totals
        unchanged.

      - A successful import switches all readers to one new dataset ID
        atomically.

      - Reset restores source checksums, row counts, timestamp, and reference
        results.

  5. Dashboard
      - All six required KPIs, snapshot UTC timestamp, and required holdings
        columns are visible.

      - Both charts reconcile to the holdings response.
      - Negative/zero values remain understandable without color.
      - Zero-value portfolios show no misleading pie chart.

  6. Transaction explorer
      - All 200 sample trades can be browsed.
      - Symbol, exchange, side, UTC date range, sort, and pagination work
        individually and together.

      - Every source field, gross value, and fee is visible.
      - Explorer filters do not change dashboard calculations.

  7. Reliability and accessibility
      - Required loading, unauthenticated, empty, missing-price, validation,
        API/database error, success, and stale-dataset states have visible UI.

      - Keyboard-only navigation works for login, filters, upload, reset, and
        pagination.

      - Automated accessibility checks have no critical violations.
      - pnpm verify and the production build pass from a clean checkout.

  8. Deployment and submission
      - The public URL uses HTTPS and opens without joining a tailnet.
      - Login, invalid import, valid import, reset, refresh, and restart are
        verified externally.

      - Containers restart automatically and PostgreSQL data survives restart.
      - README contains exact setup, migration, test, deployment, health,
        backup, and restore instructions.

      - AI_WORKFLOW.md contains 5–8 real reviewed examples, including at least
        one corrected or rejected AI result.

      - Actual repository URL, application URL, and separately delivered
        evaluator credentials are supplied.
