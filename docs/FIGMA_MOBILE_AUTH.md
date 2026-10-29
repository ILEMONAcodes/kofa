# Mobile authentication — Figma 43:981

Task: FE-3.5 — mobile authentication presentation
Objective: Implement all nine mobile authentication views from section 43:981 and connect their navigation to browse, property return links and landlord contact registration.
Owner: Joint (Developer 2, explicitly authorized frontend work)
Branch: joint/FE-3.5-mobile-auth
Required documentation: IMPLEMENTATION_PLAN Phase 3 FE-3.5; API_CONTRACT 2/4.2; UI_DESIGN_SYSTEM auth/routes/accessibility; PRD authentication; ARCHITECTURE frontend/mock policy.
Files expected to change: frontend/src/app/(auth), frontend/src/components/features/auth, mobile app shell, account layout/page, design-token metadata, browser tests and handoff docs.
Dependencies: FE-2.3 foundation and mobile browse implemented; backend BE-3.2/3.4 unavailable.
Contract: v0.2.0 Draft auth register/login/reset/verification/me/logout. No contract changes or endpoint mocks.
Acceptance: nine designs reviewable; source tokens and assets reused; accessible validated forms; fixed mobile actions with scrollable content; internal return paths preserved; no simulated signed-in state, email delivery, verification or password reset presented as real.
Tests required: validation/return-path unit tests; browser navigation, form validation, unavailable-service behavior, responsive geometry and axe; lint/typecheck/build/mock audit.
Out of scope: backend, session guards/refresh, real credentials, email delivery, legal policy publication and desktop Figma redesign.
Working assumptions: presentation-only while auth is unavailable, consistent with earlier browse implementation. Dedicated labelled /auth-preview routes expose success and fictional account designs without treating them as authenticated state. Existing common Input/Button replace generic Code Connect primitives (no primitives package exists).

## Implemented views and navigation

| Source | View | Route |
|---|---|---|
| 29:1187 | Welcome back | `/login` |
| 47:1232 | Make your next move | `/register` |
| 47:1388 | Check your inbox | `/verify-email` |
| 47:1508 | You’re verified | `/auth-preview/verified` |
| 47:1625 | Forgot your password | `/forgot-password` |
| 47:1742 | Reset-link confirmation | `/auth-preview/reset-link-sent` |
| 47:1866 | Choose a new password | `/reset-password` |
| 47:1983 | Password-updated confirmation | `/auth-preview/password-updated` |
| 47:2107 | Account summary | `/account` (signed out); `/auth-preview/account` (fictional source state) |

All nine source states are also available at `/auth-preview/<screen>` from the numbered preview selector. Preview routes are noindex; a visible label marks sample content. Fields are empty with source placeholders. Passwords are masked; registration/reset check matching passwords, 10–128 characters, required consent, name length and international phone format. Only backend can check common passwords or record current policy acceptance. Terms/privacy opens an unavailable-policy notice rather than fabricated legal copy. All form submissions stop locally, clear entered values and explain unavailable services; preview continuation links never include entered details. No authentication state is stored or faked. Return links preserve same-origin paths/query/hash and reject external or malformed URLs.

## Fidelity and assets

Source 390×844: header 108; heading y128; first login/register input y286, 350×48; actions y690, height154; account navigation y760, height84. Original Figma colors/font values recorded in `frontend/src/design-tokens/mobile-auth.json`; existing theme already matches, so no palette/font overrides. SVGs downloaded and verified: all 18 header exports match existing back/logo bytes; three navigation icons match existing assets; active account icon is a new exact export. Every asset stays local at native dimensions. No device corner clipping or fake OS clock/battery is drawn in production. Forms scroll independently above fixed actions; safe areas extend available spacing. Wider screens use a bounded card without claiming fidelity to the unrequested desktop authentication node.

## Integration boundary

This completes the requested mobile UI presentation, not the full FE-3.5 or FE-3.6 integration gate. Add RHF/Zod, actual versioned policies, typed API adapter, server field errors/loading/rate limits, email tokens, auth cookies and session refresh/guards once BE-3.2/3.4 and generated types are available. Server remains authoritative. Backend, contract and existing desktop browse layouts are unchanged. No active endpoint mocks or new dependencies.

## Review notes

Scope: frontend and small shared handoff/assumption/progress updates only. No backend or API contract changes, dependencies, network handlers, auth tokens, credentials or real personal records. Form submissions clear fields before opening the unavailable-service notice. Preview form keys isolate inputs across screens. Same-origin return paths are validated. The sample account is reachable only through explicit preview navigation; the real account page renders signed out. Existing desktop browse geometry and interactions are regression-tested.

Next: BE-3.2/3.4 provide actual identity/email services; FE-3.5 remaining integration and FE-3.6 session handling follow, then J-3.7 real-stack acceptance. The source mobile UI can be reviewed now without those services.

## Actual validation

- `npm run test`: 52 tests passed across 7 files.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. Production build generates all nine preview routes and five direct authentication routes.
- `npm run mock-audit`: no active TEMP-MOCK handlers.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: 20/21 passed initially; the new fixed mobile screen left its parent main landmark with zero height. Added mobile main minimum viewport height without changing screen geometry.
- Final rebuild followed by `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- e2e/mobile-auth.spec.ts e2e/foundation.spec.ts`: **7/7 passed** (1.5m), including the previously failing 360px foundation test, 768/1280px foundation scans and all nine authentication views. All 21 distinct browser checks verified across the regression and final affected-suite runs; no claim of a single 21/21 run.
- Source screenshots captured under ignored `frontend/test-results/auth-*-390.png` and visually reviewed. Header/icon/heading/input/action geometry matches source; exact SVG hashes recorded in mobile-auth.json. Reduced widths/heights 360×640 and 390×500 keep long registration content reachable; 768/1280 checks pass without horizontal overflow. Axe found no violations in all nine source views and responsive checks.
- Credential non-transmission, required consent, confirmation mismatch, safe return links, unavailable actions and signed-out real account were browser-verified. Existing desktop and mobile browse checks passed in the regression run.
- `git diff --check`: passed.
