# Mobile verification and transactions

Task: FE-4.14 — section 91:14886 presentation
Objective: Implement the eight source mobile verification/publication/client-summary screens using existing tokens and components.
Owner: Joint (Developer 2, authorized frontend work). Branch: joint/FE-4.14-mobile-verification-transactions.
Required docs: implementation plan FE-4.14 and FE-6.10; API contract property verification/owner approval/publication and client transaction read schemas; UI design system mobile pattern and disclosure requirements.
Files expected to change: verification feature/model/routes, shared preview renderer, staff/client links, focused tests and progress/decisions handoff.
Dependencies: existing staff/client/media presentation. Retains the pushed media/help branch because that shared renderer and linked guidance are required.
Contract: unchanged; presentation examples only, no endpoint handlers.
Acceptance criteria: all eight source states and local assets; editable checks/method/approval fields with Other; validation; separate unavailable-service and example outcomes; staff/client navigation correct; exact static disclosed fee text, no fee calculation or permission/publication decisions in the client; 360/768/1280 representative layouts and keyboard/a11y checks.
Tests: focused model tests, Playwright route/content/forms/navigation/no-mutation/geometry/a11y checks, existing renderer regression; lint, typecheck, unit tests, build and mock audit.
Out of scope: real approval/verification/publishing, financial operations, authorization and actual transaction data.
Working assumptions: existing source examples are fictional; backend remains authoritative for state transitions, allowed actions and fee quotes. No new policy/business default is introduced.

Implementation:

- `/verification-preview/checks`, `checks-saved`, `owner-approval`, `publication-ready`, `publish`, `published`, `agreement`, `completed` follow source 18.01–18.08 order.
- Extended the existing source-driven mobile renderer and common Button/Input/Dropdown/Modal controls; retained DM Sans, original brown/cream tokens, 20 px gutters, 124 px header, 84 px fixed navigation and 32 px corners. Source timeline markers use the existing staff timeline geometry. No theme overrides or new dependencies.
- Downloaded all 41 exported source assets; exact hashes matched existing local SVGs/photo. Runtime uses local assets only. The publication photo retains its 350×220 source slot; original logo and navigation exports retain effective dimensions.
- Six check results and verification method are editable dropdowns. Owner approval has method options, Other text, editable WAT date/time and required evidence note. A native date/time control displays the browser locale while preserving the source value `2026-10-26T09:30`; no UTC conversion or submission is implied. Required source notes and Other text receive native validation.
- Save/complete/record/publish actions open an unavailable-service dialog. Only a separate “Preview example outcome” link opens the supplied sample state; the dialog explicitly says it does not represent entered values. No backend state machine, publication/permission guard, approval validity decision, money calculation or mutation is implemented.
- Source financial figures remain literal illustrative quote text, including the client fee ₦70,000, 2% condition and disabled inspection-fee example. No landlord quote/private fields are introduced into the client states.
- Staff workspace menu links to verification; client transaction pages link to agreement/completion examples. Client Help/fee guidance, inquiries, concerns and transactions connect to existing presentation routes. Six staff states have workspace navigation; the final two have consumer Back/Help/navigation. All eight are reachable through a numbered directory.

Validation:

- `npm --prefix frontend test`: 84 passed in 12 files. Initial new asset-existence assertion failed because Vite rewrote a dynamic `new URL` asset expression; replaced it with a Node filesystem path, then the full suite passed.
- `npm --prefix frontend run build`: passed, 183 static pages; all eight new routes generated. `typecheck`, `lint`, `mock-audit` passed; no active TEMP-MOCK handlers.
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/verification.spec.ts e2e/media-help.spec.ts --workers=2`: 17/17 passed (six verification and eleven existing renderer checks).
- Verified all eight source headings/body text, local photo loading/350×220 geometry, native validation/Other/date input, explicit example outcomes, zero mutation requests, staff/client entry links, fees/history, Help, eight-item menu, Escape focus restoration, representative axe and responsive 360/768/1280 geometry.
- Final focused asset check run from the repository root: 1/1 passed across all eight screens, including the logo’s 101.15×32.7833 geometry, four 22×22 SVG navigation slots and non-empty rendered assets.
- Rendered screenshots reviewed against the section source for checks, approval, publication metrics/photo, fee cards and timeline. OS status indicators remain replaced by the established design-preview label. Native select/date controls and the appended preview directory are intentional presentation adaptations.

Contract unchanged. No active endpoint mocks. No real records or legal policy content added. External review and real service integration remain pending.

Next: FE-4.14 permission/allowed-actions and verification/approval/publication integration after backend readiness; FE-6.10 real client transaction summaries and fee quote integration as a separate task.
