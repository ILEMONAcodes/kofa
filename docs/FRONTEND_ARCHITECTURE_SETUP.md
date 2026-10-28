# FE-2.3 — Frontend architecture setup

Owner: Developer 2 under explicit authorization to work in `frontend/**`. Branch: `joint/FE-2.3-frontend-architecture`. Contract: 0.2.0 Draft, unchanged.

## Task brief

Objective: establish an independently runnable Next.js App Router foundation with the original Figma design tokens, requested route/component blueprint, and public API types.

Required docs: ORCHESTRATOR §4/§9, frontend role guide, IMPLEMENTATION_PLAN FE-2.3, ARCHITECTURE §5/§6/§8, UI_DESIGN_SYSTEM §2/§8, API_CONTRACT §2/§4.3/§4.5.

Files: `frontend/**`, this handoff, `docs/PROGRESS.md`, `docs/DECISIONS.md`. Dependencies J-2.1/FE-1.4 remain incomplete; use ADR-002/003 and draft 0.2.0 as working assumptions under the developer’s explicit request. No backend is required for the foundation previews. Existing uncommitted Figma follow-up notes and user-owned `.mcp.json` are preserved.

Acceptance: strict TypeScript App Router; public/auth/client/admin layouts; routes `/properties`, `/properties/[id]`, `/landlord`, `/admin`; accessible common primitives; browse components; self-hosted fonts; public property/taxonomy interfaces; envelope transport with safe unknown-code/non-JSON/network/timeout behavior; contract money vectors. No live feature completion claimed.

Tests: ESLint, tsc, Vitest contract/transport/control tests, production build, mock audit, Playwright route/a11y/overflow checks at 360/768/1280px. Out of scope: backend/schema/contracts, actual authentication, live property search/detail, listing/media uploads, admin operations and complete Figma screen implementation.

## Design and route decisions

The developer corrected the initial Inter/teal request during implementation: **retain original Figma brown/cream, DM Sans and Instrument Serif**. No Inter/teal override was recorded and no Figma edits are part of this task. Surface/radius tokens follow UI_DESIGN_SYSTEM. The requested `[id]` directory carries a public slug to match the API. Existing `/list-your-property` entry redirects to `/landlord`; no landlord account is added.

Types are explicitly manual draft mirrors pending FE-2.5/OpenAPI. No generated-type conformance or real backend integration can be claimed until BE-2.4 and J-2.8. Phase-level work is not all complete.

## Verification

- `npm run lint`: passed, zero errors/warnings after naming the PostCSS export.
- `npm run typecheck`: passed (also passed inside the production build).
- `npm test`: 33 passed across three files (11 transport, 18 money, 4 controls). Initial single-refresh test reused a consumed Response mock; corrected to return a fresh response per request, then all assertions passed.
- `npm run build`: passed; all nine app routes emitted, including the dynamic public detail route.
- `npm run mock-audit`: no active TEMP-MOCK handlers.
- npm install audit: 480 packages audited, zero vulnerabilities. Initial metadata/archive downloads timed out; retry with cached packages and lower connection concurrency succeeded.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: 3 passed. Seven routes at each of 360, 768 and 1280px (21 page/width checks), zero axe WCAG 2 A/AA + 2.1 AA violations, no horizontal overflow, skip-link keyboard focus and disabled unconnected search controls verified. Bundled Chromium install failed because this Mac runs an unsupported macOS version; the installed Chrome ran successfully in isolated headless contexts.
- Mobile/tablet property-route renders visually inspected. These are foundation previews, not complete product screens.
- `git diff --check`: passed.

No real-backend integration, authenticated journey, media upload, generated-schema conformance or production deployment was tested. Authentication and full search/filter/Other/budget behavior remain their planned feature tasks. Next: BE-2.4 → FE-2.5 generated types, then feature UI implementation and J-2.8 integration.

## Committed-diff review

Single-session Code Reviewer pass after scaffold commit `15a8cc0`: no blocking findings for the architecture scope. Confirmed original theme/token usage, public-only data types, same-origin transport/CSRF boundary, no operational private screens, and no backend or contract edits. Manual draft types, unconnected route previews, remote-image allowlisting and later authenticated integration remain explicit follow-ups. Verdict: In review for the other developer; no PR published. Prior Figma follow-up notes and `.mcp.json` remain unstaged and preserved.
