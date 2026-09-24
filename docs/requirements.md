# Requirements: AI-Assisted Crypto Portfolio Analytics

**Status:** Implementation-ready specification for Codex agents  
**Assessment deadline:** 24 September 2026, 16:00 GMT+7  
**Authoritative inputs:** `assessment.pdf`, `trades.csv`, `prices.csv` supplied with the assignment  
**Product language:** English for the evaluator; development discussion may be in Vietnamese.

## 1. Objective and priorities

Build, test, document, and deploy an authenticated full-stack crypto portfolio analytics application. It must load the supplied synthetic transactions and fixed USD price snapshot, accurately calculate weighted-average-cost performance, let an evaluator inspect and replace the shared trade history, and work at a public HTTPS URL without local setup.

The assignment is evaluated on AI coding-agent workflow (35%), data and calculation correctness (30%), architecture and code quality (15%), product and UX (10%), testing and reliability (5%), and deployment and documentation (5%). Prioritize correctness, genuine review of AI work, and a functioning submission over extra features. The stated expected effort is 6–10 hours. Do not add live prices, exchange/blockchain connectivity, trading, or unrelated features.

## 2. Confirmed decisions and open inputs

| Area | Decision |
| --- | --- |
| Calculation scope | One portfolio per asset, combining trades from Binance and Coinbase. Exchange is a transaction filter and provenance field; it does **not** split cost-basis pools. |
| Backend | NestJS with TypeScript. |
| Frontend | React with TypeScript. |
| Database | PostgreSQL, shared by all authenticated users. |
| Hosting | Self-host on a personal Apple Silicon Mac mini that will remain powered on and connected to the Internet. |
| Public access | Prefer Tailscale **Funnel**; ngrok is an alternative if Funnel fails. The evaluator must reach the HTTPS URL without joining a tailnet. Tailscale Serve alone does not satisfy this. |
| Source control | Public repository on the user's personal GitHub account. |
| Authentication | Application login is required. No public sign-up is needed. Supply evaluator test credentials separately from source code. The evaluator account may import trades and reset sample data. |
| Import semantics | A successful re-import replaces the globally active trade dataset. All authenticated users see the same active dataset. Invalid imports must preserve the prior dataset. |
| Market data | Only the supplied `prices.csv` snapshot; no live market/exchange API. |

**Information still to obtain before final deployment:** the actual GitHub repository URL; confirmation that Docker Desktop and Tailscale are installed and usable on the Mac; the public hostname chosen after deployment; and how test credentials will be delivered to the evaluator. None of these is permission to invent a URL or place a secret in the repository. The language choice above is an implementation default that the owner may change.

## 3. Source files and data contracts

Keep the unmodified supplied CSVs in the repository, e.g. `sample-data/trades.csv` and `sample-data/prices.csv`, together with directions for restoring the sample dataset. Preserve original source values and full decimal precision.

### Trades

`trades.csv` has **200 records** spanning `2025-10-01T09:00:00Z` through `2026-03-27T18:40:00Z`. It has 40 records for each of BTC, ETH, SOL, CKB, and DOGE; 128 BUY and 72 SELL; 100 Binance and 100 Coinbase records. Each asset includes full closes and later reopens. The sample has unique trade IDs and does not create a short position.

| Column | Contract |
| --- | --- |
| `trade_id` | Required, nonempty, unique within the imported file; persist and display. |
| `timestamp` | Required, valid UTC ISO-8601 timestamp; calculations use ascending time order. |
| `exchange` | Required; exactly `Binance` or `Coinbase`. |
| `symbol` | Required; exactly `BTC`, `ETH`, `SOL`, `CKB`, or `DOGE`. |
| `side` | Required; exactly `BUY` or `SELL`. |
| `quantity` | Required decimal greater than zero. |
| `price_usd` | Required decimal greater than zero. |
| `fee_usd` | Required decimal greater than or equal to zero. |

### Prices

`prices.csv` has one current USD price for each of the five symbols. Every provided row has `as_of = 2026-03-31T23:59:59Z`. Required columns: `as_of` (UTC timestamp), `symbol` (supported asset), and `price_usd` (positive decimal). Load the fixed snapshot at initialization/reset, validate unique symbol rows, and show its timestamp prominently in the UI. Do not describe these March 2026 prices as live prices. No user-facing price upload is required by the assignment.

### Explicit contracts and persistence

- Define typed DTOs for incoming CSV data, trade rows, price rows, import results/errors, holdings, portfolio summary, transaction queries, and authenticated user/session responses.
- PostgreSQL is authoritative for the active dataset and users. Use migrations, not untracked manual schema edits. Restrict database network access to the application host/internal container network.
- Retain source trade fields and a stable import identity so transactions can be traced to the imported dataset. A model such as `users`, `imports`, `trades`, `prices`, and an active-dataset pointer is acceptable; use the simplest schema that makes atomic replacement and reset reliable.
- Numeric values must never pass through JavaScript binary floating-point arithmetic for financial calculations. Use a decimal arithmetic library and PostgreSQL `NUMERIC` (or an explicitly justified equivalent); keep decimal values as decimal/string through API boundaries. Do not round stored or intermediate monetary values.

## 4. Portfolio calculation rules

Process transactions for **each symbol across both exchanges** in ascending timestamp order. Use a deterministic tie-breaker, such as `trade_id`, when timestamps match; document it. Keep one quantity, cost basis, and cumulative realized P&L per symbol. A SELL must not exceed the available quantity at that point in the ordered history.

**BUY**

```text
grossBuy       = quantity * price_usd
costAdded      = grossBuy + fee_usd
newQuantity    = previousQuantity + quantity
newCostBasis   = previousCostBasis + costAdded
averageCost    = newCostBasis / newQuantity
```

The BUY fee is capitalized into cost basis.

**SELL**

```text
grossProceeds  = quantity * price_usd
netProceeds    = grossProceeds - fee_usd
costRemoved    = averageCostImmediatelyBeforeSale * quantity
saleRealizedPL = netProceeds - costRemoved
newQuantity    = previousQuantity - quantity
newCostBasis   = previousCostBasis - costRemoved
```

Accumulate realized P&L across all sales, including sales before a later reopening. A partial SELL leaves the average cost of the remaining quantity unchanged. After an exact full close, set remaining quantity, basis, and average cost to **exactly zero** before processing any later BUY; do not retain division residue.

**Valuation per symbol**

```text
currentValue = remainingQuantity * snapshotPrice
unrealizedPL = currentValue - remainingCostBasis
totalPL      = cumulativeRealizedPL + unrealizedPL
allocation   = currentValue / sum(currentValue across symbols)
totalFees    = sum(all BUY and SELL fee_usd values for the symbol)
```

Portfolio totals are sums of the corresponding **unrounded** symbol values. If portfolio current value is zero, show allocation as 0% or an explicit N/A consistently; avoid division by zero. Do not add fees a second time to P&L. Report currency amounts with sign and two displayed decimals, while quantities and unit prices show enough digits for BTC/CKB. State the chosen display rounding mode in README. Tiny differences between summed displayed cells and a total rounded from exact values are possible; never silently change the calculation to force a visual match. Charts and headline values must use the same calculation output as the holdings table.

### Independent reference results for supplied CSVs

These values were computed from the provided files using decimal arithmetic and the rules above. Use them as independent regression targets, **never as hard-coded application data**. USD figures in this table are rounded for display.

| Asset | Remaining quantity | Remaining cost basis | Current value | Realized P&L | Unrealized P&L | Total fees |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BTC | 0.07742920 | $9,114.34 | $8,633.36 | -$463.75 | -$480.98 | $486.42 |
| ETH | 2.846898 | $11,648.43 | $11,458.76 | -$984.43 | -$189.66 | $529.66 |
| SOL | 53.3643 | $11,433.18 | $11,126.46 | -$2,408.93 | -$306.72 | $518.99 |
| CKB | 1,947,047 | $13,382.76 | $13,921.39 | +$1,499.63 | +$538.63 | $525.21 |
| DOGE | 63,970.78 | $14,390.53 | $15,480.93 | -$2,695.48 | +$1,090.40 | $648.58 |
| **Portfolio** | — | **$59,969.24** | **$60,620.89** | **-$5,052.96** | **+$651.65** | **$2,708.86** |

**Portfolio total P&L:** `-$4,401.31`. These displayed per-asset figures may not add to the independently rounded portfolio figure down to the cent; tests must compare the underlying exact decimal values or round the unrounded aggregate, not sum rounded UI strings.

## 5. Import, validation, and reset

1. On first initialization of an empty database, seed the supplied prices and trades. Seeding must be idempotent and must not overwrite a later user import on restart.
2. Provide a protected upload for `trades.csv`. Validate the entire file and compute the ordered positions before making it active. Reject malformed CSV, missing required columns, empty or duplicate IDs, invalid UTC timestamps, unsupported enumerations, invalid/nonfinite decimals, nonpositive quantities/prices, negative fees, and any SELL creating a short position. Reject an empty trade file only if that choice is documented; an intentional zero-holdings state must still render properly.
3. Provide actionable errors with CSV row number and field or trade ID where applicable. Avoid showing a false success or an incomplete partial import.
4. Make replacement atomic with a database transaction and a single active-dataset switch. After failure, prior summary, holdings, and transactions remain unchanged. After success, all subsequent readers see only the new dataset, with a visible import timestamp/status. Avoid a window in which some endpoints read the old dataset and others the new one within one page load; use dataset versioning or an equivalent coherent response strategy.
5. Provide a protected **Reset sample data** action with a clear confirmation UI. It re-imports the exact supplied trade history and fixed price snapshot and updates every user's shared view. The evaluator test account must be able to use it.
6. Missing or malformed prices must produce a visible error state. Do not fabricate a zero price or silently omit a holding. Define and test how a valid trade import with a symbol absent from the fixed snapshot is handled (reject the import or mark valuation unavailable); for the five supported symbols, the supplied snapshot contains all prices.

## 6. Authentication and shared access

- Require login for dashboard data and all import/reset endpoints. No public registration or social login is needed.
- Seed/provision a test account without committing its password. Store a salted password hash, not a plaintext password. Keep database credentials, cookie/session signing keys, and tunnel credentials outside git; provide `.env.example` with names but no real values.
- Use a secure, HTTP-only session cookie or another documented secure mechanism. Protect modifying routes against unauthenticated access; for cookie-based auth, address CSRF using same-site settings and origin/CSRF validation. Provide logout and an appropriate session expiry.
- The test account can read, import, and reset the **global** dataset. Make the shared-data effect clear before replacement/reset. Authentication is for the application; PostgreSQL itself must also require credentials and remain unreachable from the public Internet.
- Do not print uploaded CSV contents, passwords, connection strings, tokens, or cookies in logs. Log safe failure context for diagnosis.

## 7. Frontend requirements

### Dashboard and holdings

- Show portfolio current value, remaining cost basis, realized P&L, unrealized P&L, total P&L, and total fees paid.
- Show the snapshot timestamp in UTC with a clear label. Display signs and currency consistently; use plus/minus signs or text in addition to color for gains/losses.
- Show one holdings row per asset: remaining quantity, weighted-average cost, current price, remaining cost basis, current value, realized P&L, unrealized P&L, total P&L, and portfolio allocation. A closed asset may remain if cumulative realized P&L is nonzero.
- Provide at least two useful charts: current-value allocation and realized versus unrealized P&L by asset. Label negative and zero values clearly. Empty portfolios must not produce a misleading pie chart.

### Transaction explorer

- Show every CSV field, computed gross trade value, and clearly visible fee.
- Support filtering by symbol, exchange, side, and inclusive date range; sort by timestamp; provide pagination or virtualization so all records can be browsed. Define date-range boundary/time-zone behavior in the UI or README.
- Filters are for exploration only and must **not** implicitly recalculate the global portfolio or split weighted-average cost by exchange.

### States and accessibility

- Handle initial loading, unauthenticated state, empty/zero holdings, missing price data, invalid upload, database/API failure, and successful import/reset with visible feedback.
- Design for common desktop and mobile sizes; make tables usable on narrow screens. Use semantic labels, keyboard-operable controls, visible focus, readable contrast, and text alternatives for chart information.

## 8. Suggested architecture and implementation boundaries

Use a public GitHub monorepo with `backend/` and `frontend/` and a root README. Separate CSV parsing/validation, deterministic portfolio calculation, persistence, auth, HTTP controllers, and React presentation. The calculation function should accept explicit typed inputs and return explicit typed outputs without querying the DB or rendering UI. Make the API the sole owner of validation and portfolio calculations; frontend consumes its results rather than reimplementing finance logic.

For the Mac mini, provide an ARM-compatible Docker Compose setup with a persistent PostgreSQL volume, a single app port bound to localhost or otherwise inaccessible directly from the public Internet, health checks, migrations on deployment, and restart behavior. NestJS may serve the production React build to provide one origin and simplify cookies and Funnel. Keep the database port unpublished. Document startup, stop, backup/restore, and how to confirm that the app and tunnel are running after reboot. If Docker is not installed, document the exact prerequisite and verify the chosen images on Apple Silicon.

Only expose the app through **Tailscale Funnel** or an HTTPS ngrok endpoint; do not expose PostgreSQL. Confirm the deployed URL from a device/browser outside the tailnet with a clean session. The computer, container runtime, app, DB, and tunnel must stay running throughout review. Record the actual public URL and repository URL in README when known.

## 9. Automated tests and verification

Document one command that runs all tests. Tests must assert known numeric results and meaningful failure behavior, not merely successful execution.

Minimum deterministic calculation cases:

- Multiple BUYs at different prices; BUY fees included in average cost.
- Partial SELL retains remaining average cost; SELL fees reduce net proceeds and realized P&L.
- Full close zeros basis; subsequent BUY starts a new basis while prior realized P&L remains.
- Cross-exchange transactions for the same symbol share one cost-basis pool.
- Short-creating SELL is rejected; same-timestamp ordering is deterministic; zero holdings and zero portfolio value are safe.
- Supplied sample files produce the reference totals in section 4 within a documented decimal tolerance or exact decimal target.

Minimum import/auth/persistence cases:

- Missing columns, duplicate trade IDs, invalid dates/enumerations/decimal fields, malformed rows, and short-creating SELL return useful row-level errors.
- Re-import failure leaves the active database dataset unchanged; a valid re-import replaces it completely; reset restores the supplied sample and reference totals.
- Protected endpoints reject unauthenticated requests; an authenticated test user can import/reset.
- Missing price produces an explicit failure state. Production build succeeds.

Manual release checks: log in from an external browser, confirm sample totals and UTC snapshot time, filter and paginate all transactions, import an invalid file and observe no data change, import a valid modified file and observe shared changes, reset, refresh/restart, check mobile layout, and verify HTTPS public reachability.

## 10. Required repository deliverables

1. Public GitHub source repository containing `backend/`, `frontend/`, migrations, automated tests, deployment configuration, and original sample CSVs.
2. Live HTTPS application URL accessible without installing software or joining a tailnet; provide evaluator test credentials separately.
3. `README.md` covering local prerequisites, environment variables, development/test/production build commands, architecture/data flow, calculation and precision rules, seed/import/reset behavior, deployment instructions and actual URL, assumptions, limitations, and future improvements.
4. `AI_WORKFLOW.md` with **5–8 real, selected examples** from actual Codex-agent work. Collectively cover requirements/planning, architecture or data model, implementation, tests/debugging, and at least one actual correction or rejection of AI output. For every example include goal/context, exact prompt or faithful excerpt with constraints and acceptance criteria, agent response, the owner's concrete review/verification, and what was accepted/edited/rejected and why. Name actual tools/models, disclose if AI produced most of a file/feature, and link relevant commits/diffs/tests when available. Do not invent an example or submit a raw chat export.

## 11. Execution order and acceptance gates

1. **Foundation:** inspect actual repo and Mac prerequisites; establish typed data contracts, migrations, sample seed, auth, and environment template. Verify the project boots locally.
2. **Calculation and import:** implement pure decimal calculation and atomic CSV import; add numeric and failure tests; verify the supplied sample against section 4.
3. **Product:** implement login, dashboard, holdings, charts, explorer, upload/reset, and visible states. Confirm API-derived figures reconcile.
4. **Deployment:** build and start on Mac mini, enable public HTTPS tunnel, verify from outside the tailnet, and leave service running.
5. **Submission:** complete README and truthful AI_WORKFLOW examples throughout work, run tests/build/manual smoke checks, commit and push, then submit the **actual** repo URL, public app URL, and test credentials through the assessment channel.

**Done means** the deployed application can be opened and used by an evaluator without local setup, all required views and import/reset flows work against shared PostgreSQL data, calculation tests pass with known expected numbers, invalid imports leave prior data intact, and every submission artifact is present and explainable by the owner before the deadline.
