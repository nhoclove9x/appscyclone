---
name: frontend-typescript-quality
description: Implement or review React/frontend TypeScript in this repository with strict API types, clear state boundaries, accessible UI, and no client-side portfolio calculations. Do not use for backend-only work.
---

# Frontend TypeScript Quality

Keep React code explicit, accessible, strongly typed, and easy to follow. Apply SOLID at component and module boundaries without importing object-oriented ceremony into React.

## TypeScript and API contracts

- Keep strict TypeScript enabled and do not permit implicit `any`.
- Do not use unsafe casts to silence the compiler. Narrow `unknown` values at untrusted boundaries.
- Give API requests and responses explicit types.
- Prefer discriminated unions when UI states have meaningful variants.
- Use generated or shared API types when available instead of manually duplicating backend domain models.
- Keep financial values as API-provided decimal strings for display and formatting. Do not implement portfolio calculations in the frontend.

## React boundaries

- Use functional components and hooks.
- Give each component a clear rendering or interaction responsibility.
- Keep API access in query functions, feature services, or focused hooks rather than presentational components.
- Separate server state from local interaction state.
- Prefer composition over large components controlled by many unrelated props.
- Extract a hook when it represents reusable stateful behavior, not merely to move lines out of a component.
- Use a feature-level provider or query boundary when it resolves real shared ownership. Do not introduce global state just to avoid a few props.
- Keep formatting and conversion helpers centralized when more than one view uses them.

## State management

- When TanStack Query is selected, let it own server state.
- Do not copy query data into local state or a global store without a concrete editing, snapshot, or offline requirement.
- Keep transient interaction state local to the nearest owning component.
- After mutations, explicitly invalidate or update every affected query.
- Avoid effects for values that can be derived during render or actions that belong in event handlers or query callbacks.

## UI quality

- Design loading, empty, error, unauthenticated, stale/conflict, and success states intentionally.
- Keep all controls keyboard-operable with semantic labels and visible focus.
- Communicate gains and losses with signs or text in addition to color.
- Keep tables usable at narrow widths through intentional overflow, responsive columns, or an equivalent accessible treatment.
- Give charts accessible textual or tabular alternatives using the same API data.
- Preserve backend ownership of all financial calculations, even when chart libraries require numeric coordinates for rendering.

## SOLID without ceremony

- Apply responsibility, substitution, interface focus, and dependency direction at module, component, hook, and API-boundary level.
- Do not introduce class hierarchies, interface-per-component patterns, generic design systems for one-off elements, premature global state, or unnecessary wrapper components.

## Review checklist

For every changed frontend area, actively check for:

- components mixing API, business, interaction, and presentation responsibilities;
- portfolio or cost-basis logic inside views;
- duplicated server state or formatting logic;
- unnecessary effects or unstable dependencies;
- unsafe API typing or casts;
- obvious avoidable rerenders caused by unstable values or excessive shared state;
- inaccessible interactions, missing labels, lost focus, or color-only meaning;
- mutation flows that leave related queries stale.

Run the smallest relevant frontend typecheck, lint, and tests, then expand verification in proportion to the change's risk.
