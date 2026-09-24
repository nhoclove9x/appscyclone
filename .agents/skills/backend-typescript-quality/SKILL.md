---
name: backend-typescript-quality
description: Implement or review NestJS/backend TypeScript in this repository with strict types, Decimal-safe finance, clear boundaries, and focused tests. Do not use for frontend-only work.
---

# Backend TypeScript Quality

Keep backend code explicit, strongly typed, testable, and appropriately modular. Apply these rules to implementation and review without adding architectural ceremony.

## TypeScript and financial safety

- Keep strict TypeScript enabled and do not permit implicit `any`.
- Avoid explicit `any`. At a verified external boundary, accept `unknown` and narrow it immediately with validation or type guards.
- Prefer precise domain types and exhaustive handling for meaningful unions.
- Avoid unsafe assertions. An assertion must follow a runtime guarantee that TypeScript cannot express.
- Never use JavaScript `number` for financial calculations.
- Preserve Prisma `Decimal` or the selected Decimal type through financial-domain code. Convert financial API values to decimal strings only at the boundary.

## NestJS boundaries

- Keep controllers thin. They translate HTTP input/output, invoke one application use case, and map expected failures.
- Put business rules in services or deterministic domain functions. Keep financial calculations framework-independent where practical.
- Validate DTOs and other untrusted input at system boundaries.
- Keep Prisma and database records inside the persistence layer. Do not use Prisma records as domain models.
- Inject dependencies instead of constructing infrastructure inside business services.
- Export only the providers a module's consumers actually require.
- Keep one coherent reason to change per function, class, and module.

## SOLID without ceremony

- Use composition and extension points only when real variation exists.
- Do not create inheritance hierarchies whose implementations weaken or change the parent contract.
- Keep interfaces focused on actual consumers and place them at boundaries that benefit testing or dependency direction.
- Keep high-level business rules independent from HTTP and infrastructure details.
- Do not create an interface for every class.
- Do not introduce repositories, factories, strategies, adapters, or abstract classes unless they provide a concrete testing, dependency, or architectural benefit.

## Project invariants

- Aggregate portfolio positions and cost basis by symbol, never by exchange. Exchange is transaction metadata only.
- Use Decimal for every financial calculation and never silently convert through `number`.
- Calculate holdings, cost basis, P&L, and allocations from immutable trades and prices; do not persist derived values.
- Activate datasets atomically. Keep immutable financial records behind restricted write paths.
- Keep API financial values as decimal strings.
- Avoid N+1 queries, but do not add caches, denormalization, or speculative optimization without evidence.
- Expose stable application error codes. Never expose internal exceptions, secrets, session data, uploaded CSV contents, connection details, or raw database errors.

## Testing

- Favor deterministic unit tests for pure domain calculations, including boundary cases and known exact values.
- Integration-test transaction boundaries, optimistic dataset activation, rollback behavior, and persistence constraints.
- Do not mock pure functions unnecessarily.
- Test observable behavior and public contracts rather than private implementation details.

## Review checklist

For every changed backend area, actively check for:

- duplicated logic or an oversized service;
- HTTP or persistence concerns leaking into domain logic;
- unsafe Decimal-to-number conversion;
- weak typing or unvalidated external input;
- speculative abstractions or incompatible inheritance;
- hidden side effects or unnecessary mutable state;
- unhandled failures or unstable client error shapes;
- incorrect transaction boundaries, stale-state activation, or partial writes.

Run the smallest relevant backend typecheck, lint, and tests, then expand verification in proportion to the change's risk.
