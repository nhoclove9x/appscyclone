# Crypto Portfolio Analytics - Implementation Plan

## Required behavior

- NestJS, React, and PostgreSQL with authenticated, shared persistent data.
- Weighted-average positions aggregate by symbol across exchanges. Exchange remains transaction metadata only.
- PostgreSQL `NUMERIC` and Decimal arithmetic own all financial calculations.
- A valid trade import atomically replaces the global dataset; invalid imports preserve the previous dataset.
- Symbols are driven by the active price snapshot rather than a hard-coded allowlist.
- Current holdings contain open positions. Closed assets remain in transactions and per-asset performance.

## Architecture

- Backend modules: database, users/auth, portfolio, transactions, imports/datasets, health, and static frontend serving.
- Entities: users, PostgreSQL-backed sessions, price snapshots/prices, datasets/trades, and a singleton active-dataset pointer.
- React routes: login, dashboard, transactions, and data management.
- Standard server-side sessions use secure HTTP-only SameSite cookies. Unsafe requests validate the configured origin.
- Each read captures one active immutable dataset ID. Import/reset writes the dataset and changes the pointer in one transaction.

## Delivery order

1. Workspace, database schema, migrations, and configuration.
2. Pure Decimal calculator and regression tests.
3. CSV validation, idempotent initialization, atomic import, and reset.
4. Authentication and protected REST APIs.
5. Dashboard, charts, transaction explorer, and data-management flows.
6. Integration tests, Docker deployment, README, and AI workflow evidence.

## Acceptance gates

- Supplied files reproduce the documented per-asset and portfolio reference values.
- Cross-exchange trades share one symbol pool; invalid SELLs are rejected.
- Failed import changes neither active dataset ID nor results; reset restores all 200 sample trades.
- Protected endpoints reject anonymous and cross-origin modifying requests.
- All transaction fields, filters, sorting, and pagination work without changing portfolio calculations.
- Production containers persist PostgreSQL data and expose only the application port on localhost.

## Changes made after human review

- Removed hard-coded symbol restrictions and derive supported symbols from prices.
- Separated current holdings from closed-asset historical performance.
- Replaced custom session/CSRF machinery with standard PostgreSQL sessions plus cookie and origin protection.
- Removed repeatable-read reads, advisory locks, and mandatory transaction `datasetId` parameters.
- Retained Decimal arithmetic, atomic replacement, shared persistence, and aggregation by symbol across exchanges.
