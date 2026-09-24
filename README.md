# AppsCyclone Crypto Portfolio Analytics

Authenticated full-stack crypto portfolio analytics app for the assessment. It loads the supplied synthetic trades and fixed USD price snapshot, calculates weighted-average-cost portfolio performance on the backend, and lets an authenticated evaluator inspect transactions, import a replacement trade CSV, or reset the canonical sample data.

## Local setup and environment variables

### Prerequisites

- Node.js 22+
- pnpm 11+
- Docker Desktop or another Docker runtime
- PostgreSQL is provided locally by `docker-compose.yml`

### Install dependencies

```bash
pnpm install
pnpm --filter backend prisma:generate
```

### Configure environment

Copy the example environment file and replace local-only placeholders:

```bash
cp .env.example .env
```

Important variables:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Local PostgreSQL container settings. |
| `DATABASE_URL` | Backend Prisma/PostgreSQL connection string. |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `PORT` | Backend HTTP port, default `3000`. |
| `ALLOWED_ORIGINS` | Comma-separated exact origins allowed for unsafe requests. For Vite local dev include `http://localhost:5173` and/or `http://127.0.0.1:5173`. |
| `SESSION_COOKIE_NAME` | Session cookie name. |
| `SESSION_SECRET` | Strong external secret, at least 32 characters. Never commit a production value. |
| `SESSION_TTL_SECONDS` | Finite session lifetime. |
| `TRUST_PROXY_HOPS` | Keep `0` locally. Use `1` only when directly behind one trusted HTTPS reverse proxy. |
| `PROVISION_USER_EMAIL`, `PROVISION_USER_PASSWORD` | One-off evaluator/test user provisioning inputs. |

### Start database and prepare data

```bash
docker compose up -d database
DATABASE_URL='postgresql://portfolio:portfolio-local-only@localhost:5433/portfolio?schema=public' pnpm --filter backend prisma:migrate:deploy
```

Provision a local evaluator user:

```bash
DATABASE_URL='postgresql://portfolio:portfolio-local-only@localhost:5433/portfolio?schema=public' \
PROVISION_USER_EMAIL='evaluator@example.com' \
PROVISION_USER_PASSWORD='Admin@123!' \
pnpm --filter backend users:provision
```

Local evaluator login:

- Email: `evaluator@example.com`
- Password: `Admin@123!`

Seed the canonical sample dataset if the database is empty:

```bash
DATABASE_URL='postgresql://portfolio:portfolio-local-only@localhost:5433/portfolio?schema=public' \
pnpm --filter backend exec ts-node -e "import { PrismaService } from './src/database/prisma.service'; import { DatasetLifecycleService } from './src/imports/application/dataset-lifecycle.service'; import { SampleDataService } from './src/imports/application/sample-data.service'; const prisma = new PrismaService(); const lifecycle = new DatasetLifecycleService(prisma, new SampleDataService()); lifecycle.initializeSampleDataIfNeeded().then((result) => console.log(JSON.stringify({ datasetId: result.datasetId, tradeCount: result.tradeCount, priceCount: result.priceCount }))).finally(async () => prisma.\$disconnect());"
```

## Commands

### Development

Backend:

```bash
DATABASE_URL='postgresql://portfolio:portfolio-local-only@localhost:5433/portfolio?schema=public' \
NODE_ENV='development' \
PORT='3000' \
ALLOWED_ORIGINS='http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000' \
SESSION_COOKIE_NAME='AppsCyclone.sid' \
SESSION_SECRET='local-dev-session-secret-at-least-32-characters' \
SESSION_TTL_SECONDS='28800' \
TRUST_PROXY_HOPS='0' \
pnpm --filter backend dev
```

Frontend:

```bash
pnpm --filter frontend dev --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

### Tests and verification

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Run the complete automated test suite, including backend PostgreSQL integration
tests, with one command after the local database is running:

```bash
DATABASE_URL='postgresql://portfolio:portfolio-local-only@localhost:5433/portfolio?schema=public' pnpm test:all
```

Functional correctness for the assessment requirements is covered by the
portfolio calculator tests, supplied-data regression tests, CSV validation
tests, import lifecycle integration tests, and protected API integration tests.

### Production build

```bash
pnpm build
```

This builds the NestJS backend and Vite frontend. The frontend output is generated under `frontend/dist/`.

## Architecture and data flow

### Backend

- NestJS REST API under `/api/v1`.
- PostgreSQL persistence through Prisma migrations.
- Server-side cookie sessions stored in PostgreSQL through `connect-pg-simple`.
- Origin validation protects unsafe cookie-authenticated requests.
- Main backend areas:
  - `auth`: login/logout/me, session guard, user provisioning, Argon2id password hashing.
  - `portfolio`: protected portfolio and transaction read APIs.
  - `imports`: CSV parsing/validation, sample initialization/reset, atomic trade dataset replacement.
  - `database`: Prisma client provider.

### Frontend

- React + TypeScript + Vite.
- Tailwind CSS for a clean responsive financial dashboard.
- React Router routes:
  - `/login`
  - `/`
  - `/transactions`
  - `/data`
- TanStack Query owns server state.
- React Hook Form owns login and transaction-filter form state.
- Recharts renders charts using backend-calculated values.

### Data flow

1. User logs in with `POST /api/v1/auth/login`.
2. Browser receives an HTTP-only session cookie.
3. Protected frontend routes call `GET /api/v1/auth/me`.
4. Dashboard calls `GET /api/v1/portfolio`.
5. Transactions page calls `GET /api/v1/transactions` with URL-backed filters.
6. Data page uploads trade CSV to `POST /api/v1/imports/trades`, resets sample data with `POST /api/v1/datasets/reset-sample`, or activates an empty transaction dataset with `POST /api/v1/datasets/clear-transactions`.
7. Successful import/reset invalidates portfolio and transaction queries.

The active dataset is global. All authenticated users see the same active portfolio.

## Portfolio calculation approach

Portfolio calculations are performed by pure deterministic backend domain code, not by the frontend.

Rules:

- Aggregate positions by `symbol` only.
- `exchange` is transaction metadata for filtering and traceability. It never creates separate holdings or cost-basis pools.
- Process trades per symbol by `timestamp ASC`, then `tradeId ASC`.
- BUY:
  - `costAdded = quantity × executionPrice + fee`
  - BUY fees increase cost basis.
- SELL:
  - `netProceeds = quantity × executionPrice - fee`
  - `costRemoved = averageCostBeforeSale × quantity`
  - SELL fees reduce proceeds and are not deducted from cost basis.
- A SELL that exceeds available quantity fails validation.
- Exact full close normalizes quantity, cost basis, and average cost to zero.
- A later BUY after full close opens a new position while historical realized P&L remains.
- Current valuation uses the immutable price snapshot referenced by the dataset.
- Closed symbols are excluded from current holdings but can remain in per-symbol performance.

Reference display totals for supplied sample data:

| Metric | Display value |
| --- | ---: |
| Current value | `$60,620.89` |
| Remaining cost basis | `$59,969.24` |
| Realized P&L | `-$5,052.96` |
| Unrealized P&L | `+$651.65` |
| Total P&L | `-$4,401.31` |
| Fees | `$2,708.86` |

## Precision and rounding decisions

- PostgreSQL stores financial values as `NUMERIC(38,18)`.
- Backend financial-domain logic uses `decimal.js`; it does not use JavaScript binary floating point for calculations.
- API financial fields cross the network as decimal strings.
- Frontend treats API decimal strings as display data and does not recalculate portfolio results.
- Recharts receives numeric coordinates converted from already-calculated backend values only for rendering.
- Display formatting:
  - USD amounts show two decimal places using `Intl.NumberFormat`.
  - Gains/losses show visible `+` or `-` signs in addition to color.
  - Quantities show enough decimal places for crypto quantities.
- Totals are calculated from unrounded backend values. Rounded table rows may not add visually to a rounded total by the final cent.

## Deployment URL

Public deployment URL: **TBD before submission**.

The accepted deployment approach is to run the app on the owner’s Mac mini and expose the web application through HTTPS using Tailscale Funnel, with ngrok as a fallback. PostgreSQL must not be exposed publicly.

Before final submission, update this section with:

- the actual public HTTPS app URL;
- the repository URL;
- how evaluator credentials were delivered separately from source control.

## Assumptions, limitations, and tradeoffs

- Only supplied/fixed price snapshots are supported. There are no live prices, exchange integrations, blockchain integrations, or trading features.
- User registration is intentionally not public. Evaluator users are provisioned by CLI/env input.
- There is one globally active dataset shared by all authenticated users.
- Trade import replaces only the active trade dataset and reuses the active dataset’s immutable price snapshot. Sample reset creates a new sample price snapshot and sample dataset.
- Historical datasets remain in PostgreSQL for immutability/provenance, but v1 has no UI for browsing inactive historical datasets.
- The frontend is intentionally API-driven and does not duplicate portfolio business logic.
- The frontend and backend are expected to be same-origin in production for simple cookie behavior. Vite dev uses a proxy for local development.
- `TRUST_PROXY_HOPS=1` should only be used behind exactly one trusted local HTTPS reverse proxy.
- Upload size for trade CSV is limited to 1 MB, which is sufficient for the supplied assessment dataset and modest evaluator CSV variants.

## Future improvements

- Serve the built frontend from the NestJS backend for a single production origin.
- Add a dedicated health/readiness API for deployment checks.
- Add a dedicated active-dataset metadata endpoint if the data-management page grows beyond portfolio-derived metadata.
- Add end-to-end browser tests for full login/import/reset flows.
- Improve chart chunk loading with route-level code splitting if the frontend grows.
- Add a UI for historical inactive dataset audit browsing.
- Add operational backup/restore documentation for the PostgreSQL volume.
