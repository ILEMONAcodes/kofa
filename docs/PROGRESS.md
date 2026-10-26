# Progress

**Last updated:** 2026-10-24 · **Current phase:** 0 (complete; approvals not blocking) · **PRD:** v0.2 · **Contract version:** 0.2.0 (Draft)

Rules: each developer updates only the rows they own; joint rows are updated by whoever completes the task and confirmed by the other. Test results are the **actual** output summary, never assumed. See `docs/IMPLEMENTATION_PLAN.md` for files and test requirements per task.

**Status values:** Not started · Ready · In progress · In review · Blocked · Done · In use (approval optional) · Deferred

## Current focus

- **2026-10-26 shared Figma starter (Developer 2, explicitly requested):** editable foundations and ten property design frames created on `joint/FE-1.4-figma-foundations`. Partial draft; FE-1.4 is not complete. All ten frames structurally inspected (Inter, editable layers, zero reported auto-layout overflow); 11/11 selected contrast pairs passed; five desktop screens and mobile search visually reviewed. Figma Starter MCP quota prevents remaining visual checks and a staff-sidebar polish fix. See [handoff and exact remaining work](FIGMA_STARTER.md). No application code or contract changes.

- **Phase 0 documents are complete (J-0.1, J-0.2).** Implementation has **not** started.
- **v0.2 revision (2026-10-24) applied after team review:** currency/format conventions, unknown-error-code handling, complaint minimum fields/rate limits/privacy/verify-before-action, and an AI assistant with call-line handoff (6G, priority Should — both developers to confirm).
- **Not waiting on anyone (ADR-019).** J-0.3 approvals (MVP scope, OQ-21, OQ-22, ADR-001…017) can be recorded whenever convenient; they no longer block work. Proposed items are used as working assumptions.
- **Product name:** Kof'a — the doorway to your home (ADR-018).
- **Can start now:** `J-1.1`, `BE-1.2`, `FE-1.4`, `J-1.5` (then `J-1.3`). AI sessions must first confirm the developer role.

## Blockers and decisions needed

| # | Blocker | Blocks | Owner to resolve | Raised |
|---|---|---|---|---|
| 1 | Approval of MVP scope and ADRs (J-0.3) — **no longer blocking**, working assumptions in use | Nothing | Both developers, when convenient | 2026-10-23 |
| 2 | OQ-02, 05, 07, 10, 11, 12, 13 (defaults proposed in PRD §10.2) | J-4.1 → Phase 4 | Both + stakeholders | 2026-10-23 |
| 3 | OQ-08, 14 | J-5.1 → Phase 5 | Both + stakeholders | 2026-10-23 |
| 4 | OQ-03, 04, 06 (commission basis, inspection fee, payments) | J-6.1, J-6.7 → Phase 6A/6B | Stakeholders | 2026-10-23 |
| 5 | OQ-18 (legal content), OQ-20 (hosting), OQ-15 (email provider) | FE-6.26, J-7.7, BE-7.5, BE-3.4 | Stakeholders | 2026-10-23 |
| 6 | OQ-23 (AI provider, budget, data sharing), OQ-24 (call-line number and hours), OQ-25 (knowledge-base owner and content), OQ-26 (languages) | J-6.28 → all 6G tasks | Stakeholders | 2026-10-24 |

## Contract status board (from `docs/API_CONTRACT.md` §8)

| Group | Status | Frozen by |
|---|---|---|
| Conventions, health, auth, policies | Draft | J-1.3 |
| Taxonomy, property submission, public properties, staff properties | Draft | J-4.1 |
| Inquiries, clients | Draft (intent only) | J-5.1 |
| Appointments | Draft (intent only) | J-6.1 |
| Fees, transactions | Draft (intent only) | J-6.7 |
| Complaints and reports | Draft (shapes proposed, §4.8) | J-6.14 |
| AI assistant, public config, knowledge base, settings | Draft (shapes proposed, §4.9) | J-6.28 |
| Notifications | Draft (intent only) | J-6.18 |
| Reports | Draft (intent only) | J-6.22 |

## Active mocks (must be empty before a feature is accepted)

| Mock | Endpoint | Remove in task |
|---|---|---|
| none | | |

## Task tracker


### Phase 0 — Analysis and documentation

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| J-0.1 | Analyze the PRD, extract requirements, list gaps | Both | Must | — | Done | — | — | Requirements, gaps, open questions and MVP proposal written |
| J-0.2 | Create agent instruction files and shared documents | Both | Must | J-0.1 | Done (draft) | — | — | All 14 required files exist; IDs and cross-references resolve |
| J-0.3 | Review and approve MVP scope, ADRs and defaults for open questions | Both | Must | J-0.2 | In use (approval optional) | OQ-21, OQ-22 | — | Approvals recorded in DECISIONS.md when convenient (not a gate); PRD status set to Approved v1.0 |

### Phase 1 — Foundations: architecture, schema, API conventions, design system

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| J-1.1 | Ratify ADR-001…013 (accept or amend) and the NFR targets | Both | Must | J-0.3 | Not started | OQ-19 | — | Each ADR marked Accepted, Revisit or amended (approval by either developer; not a gate) |
| BE-1.2 | Finalize schema conventions and core tables through Phase 4 (users, areas, amenities, landlords, properties, media, documents, verification, approvals, history) | Backend | Must | J-0.3 | Not started | — | — | Every table through Phase 4 has types, constraints, indexes and PII class; ERD current; FE confirms API shapes can be served |
| J-1.3 | Finalize API conventions, auth + health + policies endpoints; adopt change protocol | Both | Must | J-1.1 | Not started | OQ-09 | — | Conventions agreed (incl. currency/formatting §2.10 and unknown-error-code handling §2.4); auth, health, `/policies/current` endpoints status `Agreed` with request/response examples; permission matrix covers them |
| FE-1.4 | Design system v1: tokens, AA contrast results, component inventory, page templates, copy rules | Frontend | Must | J-0.3 | Not started | OQ-01 (logo/colours only; name is Kof'a) | — | All tokens defined; contrast table complete; every Phase 3–4 screen has a template; BE confirms data needs (§11) |
| J-1.5 | Resolve or accept defaults for blocking open questions of Phases 2–4 | Both | Must | J-0.3 | Not started | OQ-02, 05, 07, 10, 11, 12, 13 | — | OQ-02, 05, 07, 10, 11, 12, 13 each marked Decided (with date) or Default accepted |

### Phase 2 — Project skeletons

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| J-2.1 | Repo scaffolding: README, .gitignore, CODEOWNERS, PR template, docker-compose (Postgres, MinIO, Mailpit), .env.example | Both (lead: Backend) | Must | J-1.1 | Not started | — | — | Fresh clone + README gets Postgres up; CODEOWNERS assigns paths per ARCHITECTURE §3; PR template carries the task checklist |
| BE-2.2 | FastAPI skeleton: app factory, settings, DB session, Alembic baseline, /health, error envelope, request-ID logging, pytest, ruff, mypy | Backend | Must | J-2.1, J-1.3 | Not started | — | — | `GET /api/v1/health` matches contract; validation, 404, 503 and unhandled-exception errors use the envelope (unhandled → INTERNAL_ERROR, no internals); `Money` schema rejects non-NGN and non-integer amounts; every emitted error code is in the contract registry; `alembic upgrade head`/`downgrade base` clean |
| FE-2.3 | Next.js skeleton: App Router, strict TS, Tailwind tokens, route-group layouts, API client with envelope parsing, env config, lint/typecheck/test tooling | Frontend | Must | J-2.1, FE-1.4 | Not started | — | — | App builds; public/auth/client/admin layouts render; client converts envelope into typed `ApiError` (`code: string`) and degrades safely on unknown codes, non-JSON, network and timeout failures; shared `formatMoney`/`formatMoneyCompact`/`parseMoneyInput` pass the contract vectors; tokens match design system |
| BE-2.4 | Export OpenAPI and add contract drift check against the endpoint index in API_CONTRACT.md | Backend | Must | BE-2.2 | Not started | — | — | `make openapi` writes openapi.json; check fails on undocumented or missing method+path pairs |
| FE-2.5 | Generated TS API types from OpenAPI; MSW mock layer with TEMP-MOCK labelling and mock-audit script | Frontend | Must | BE-2.4, FE-2.3 | Not started | — | — | `npm run api:types` regenerates types; every mock handler carries `TEMP-MOCK` label; mock-audit lists active mocks; a single flag disables all mocks |
| BE-2.6 | Backend CI workflow (lint, mypy, tests with Postgres service, migration check, openapi drift, dependency audit) | Backend | Must | BE-2.2, BE-2.4 | Not started | — | — | Runs on `backend/**` PRs; required check; fails on drift or failing tests |
| FE-2.7 | Frontend CI workflow (lint, typecheck, unit tests, build, mock-audit, dependency audit) | Frontend | Must | FE-2.3, FE-2.5 | Not started | — | — | Runs on `frontend/**` PRs; required check; prints active mocks |
| J-2.8 | Skeleton integration smoke: frontend reaches real /health through the `/api` rewrite; dev docs | Both (lead: Frontend) | Must | BE-2.2, FE-2.3, FE-2.5 | Not started | — | — | docker-compose + both dev servers: UI shows backend status; CORS not needed; documented commands work |

### Phase 3 — Authentication and role permissions

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| BE-3.1 | User, session and token models + migration; admin seed command | Backend | Must | BE-2.2, BE-1.2 | Not started | — | — | Migration up/down clean; unique case-insensitive email; seed-admin creates admin from env, idempotently |
| BE-3.2 | Register (client), login, refresh, logout, me, policies/current — Argon2id, cookie sessions, CSRF | Backend | Must | BE-3.1, J-1.3 | Not started | — | — | Endpoints match contract; refresh rotation + reuse detection; cookie flags correct; generic login error; consent versions recorded |
| BE-3.3 | RBAC dependencies (default deny), staff user management API, login rate limiting, audit log basics | Backend | Must | BE-3.2 | Not started | — | — | Permission matrix tests exist for every protected endpoint; admin cannot demote/deactivate self; 429 uses envelope + Retry-After |
| BE-3.4 | Password reset (single-use, ≤1 h) and email verification via email-service abstraction (console/Mailpit in dev) | Backend | Should | BE-3.2 | Not started | OQ-15 | — | Reset token single-use and expiring; no account enumeration; reset revokes sessions; email goes through outbox/abstraction |
| FE-3.5 | Auth screens: login, register (with consent), forgot/reset password — mock-backed until BE-3.2/3.4 | Frontend | Must | FE-2.5, FE-1.4, J-1.3 | Not started | — | — | Client validation mirrors contract; server field errors shown; a11y labels; loading/disabled states; mocks labelled TEMP-MOCK |
| FE-3.6 | Session handling and route guards: role-based navigation, 401/403 handling, silent refresh, logout | Frontend | Must | FE-3.5 | Not started | — | — | Unauthenticated → login; wrong role → Forbidden page; one refresh attempt on TOKEN_EXPIRED; UI hides unauthorised actions (display only) |
| FE-3.8 | Admin staff-management screens (list, create, activate/deactivate, role) | Frontend | Should | FE-3.6, J-1.3 | Not started | — | — | Admin-only route; forms use contract validation; self-demotion blocked in UI and by API |
| J-3.7 | Auth integration: remove auth mocks; E2E register→login→me→refresh→logout; client blocked from /admin; staff allowed | Both (lead: Backend) | Must | BE-3.3, FE-3.6, FE-3.5 | Not started | — | — | E2E green on real backend; no TEMP-MOCK for auth left; auth endpoints `Integrated` |

### Phase 4 — Property module (end to end)

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| J-4.1 | Freeze property contract: taxonomy, lifecycle, verification and approval fields, upload flow, public/private field matrix, `allowed_actions` | Both (lead: Backend) | Must | J-1.3, J-1.5 | Not started | OQ-02, 05, 07, 10, 11, 13 | — | Every property endpoint `Agreed` with full request/response examples and error cases; amenity and area lists fixed; both approve |
| BE-4.2 | Property domain models + migrations; seed amenities and areas | Backend | Must | BE-3.1, J-4.1 | Not started | — | — | Migration up/down clean; constraints from schema doc enforced; seed idempotent |
| BE-4.3 | Media and document service: storage abstraction (local/S3), content-sniff validation, limits, private docs, thumbnails, EXIF stripping, signed URLs | Backend | Must | BE-4.2 | Not started | — | — | Disallowed type/size rejected with 415/413; documents never publicly reachable; signed URLs expire; thumbnails produced; EXIF GPS removed |
| BE-4.4 | Public landlord submission endpoints (draft, upload token, files, submit) with rate limits and CAPTCHA hook | Backend | Must | BE-4.2, BE-4.3, BE-3.3 | Not started | — | — | Matches contract; submit blocked without ≥5 photos + ≥1 evidence document; token scoped to one submission; landlord PII stored privately; consent recorded |
| BE-4.5 | Staff property API: queue with filters, detail (incl. signed docs, landlord), edit with optimistic version, assign, media management, availability, landlord directory | Backend | Must | BE-4.2, BE-3.3 | Not started | — | — | Staff/admin only; version conflict → 409; price/description edit invalidates approval; `stale_availability` filter works (14-day default) |
| BE-4.6 | Verification recording, landlord-approval recording, status state machine and publish guards | Backend | Must | BE-4.5, BE-4.3 | Not started | — | — | Transition table from contract enforced; publish requires passed verification and current approval; every transition written to status history and audit |
| BE-4.7 | Public search and detail API + taxonomy endpoint with indexes | Backend | Must | BE-4.2 | Not started | — | — | All filters/sorts per contract; only published; unknown filter → 422; no private field in response; p95 target met on seed data |
| BE-4.8 | Dev seed data: ≥30 properties across statuses, 10 clients, 3 staff | Backend | Must | BE-4.2, BE-4.3 | Not started | — | — | `make seed` populates a usable dataset; includes unpublished/rejected to test visibility; idempotent |
| BE-4.9 | Property module hardening: privacy-leak sweep, query plans, docs sync | Backend | Must | BE-4.4, BE-4.5, BE-4.6, BE-4.7, BE-4.8 | Not started | — | — | Automated test proves no public/client endpoint exposes P3 fields; EXPLAIN shows index use; all property endpoints `Implemented`; OpenAPI drift check green |
| FE-4.10 | Landlord submission multi-step form with upload UI (mock-backed until BE-4.4) | Frontend | Must | FE-2.5, FE-1.4, J-4.1 | Not started | — | — | All steps validate per contract; uploads show progress/retry/remove; review step; consent captured; privacy explanation shown |
| FE-4.11 | Property search page: URL-synced filters, sort, pagination, loading/empty/error states (mock-backed until BE-4.7) | Frontend | Must | FE-2.5, FE-1.4, J-4.1 | Not started | — | — | Every filter in the contract reflected in URL; mobile filter drawer; shareable URLs; SSR for SEO |
| FE-4.12 | Property detail page: gallery, facts, verification panel with scope and disclaimer, availability, SEO metadata, inert interest CTA | Frontend | Must | FE-4.11 | Not started | — | — | Matches design system §9; verification copy follows §5; metadata and structured data present; 404 for unpublished |
| FE-4.13 | Homepage: hero, three CTAs, search entry, featured verified listings, trust section | Frontend | Must | FE-4.11 | Not started | — | — | CTAs route correctly; featured list from API; LCP budget respected |
| FE-4.14 | Admin shell + property review queue, landlord list, review/verification screen with transition actions | Frontend | Must | FE-3.6, J-4.1 | Not started | — | — | Queue filters; documents via signed URLs; checklist + approval forms; actions limited to API `allowed_actions`; 409/403 handled |
| J-4.15 | Property integration: remove mocks; E2E submit→review→verify→approve→publish→search→detail→unpublish; privacy checks | Both (lead: Backend) | Must | BE-4.9, FE-4.10, FE-4.11, FE-4.12, FE-4.13, FE-4.14, J-3.7 | Not started | — | — | E2E green on real stack; no TEMP-MOCK for property features; landlord data absent from every public page and response |

### Phase 5 — Inquiries (leads) and clients (end to end)

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| J-5.1 | Freeze inquiry, messaging and client contract: lifecycle, qualification fields, assignment, internal notes, warnings | Both (lead: Backend) | Must | J-4.1, J-1.5 | Not started | OQ-08, OQ-14 | — | All inquiry/message/client endpoints `Agreed` with examples; transition table fixed; client-visible vs staff-only fields listed |
| BE-5.2 | Inquiry, message, note and history models + migration | Backend | Must | BE-4.2, J-5.1 | Not started | — | — | Migration up/down clean; partial unique index prevents duplicate open inquiry per client+property |
| BE-5.3 | Client inquiry API: create (idempotent), list own, thread, post message | Backend | Must | BE-5.2, BE-3.2 | Not started | — | — | Clients see only own inquiries (404 otherwise); duplicate open inquiry → 409; rate limit; internal notes never serialised |
| BE-5.4 | Staff inquiry API: pipeline filters, assign, transitions, qualification, internal notes, reply | Backend | Must | BE-5.2, BE-3.3 | Not started | — | — | Transition table enforced; status history and audit written; reply visible to client; notes not |
| BE-5.5 | Admin client directory API (list, detail with history, deactivate) | Backend | Must | BE-5.2, BE-3.3 | Not started | — | — | Staff/admin only; client PII visible to staff only; deactivation blocks login |
| FE-5.6 | Express-interest flow on property detail + "Speak to our team" page (login gate, short qualification form, success state) | Frontend | Must | FE-4.12, FE-3.6, J-5.1 | Not started | — | — | Anonymous user is guided to login/register and returned; form validated; duplicate-inquiry error handled; CTA live on detail page |
| FE-5.7 | Client area: my inquiries list and thread view with refresh and off-platform warning | Frontend | Must | FE-3.6, J-5.1, FE-1.4 | Not started | — | — | Shows only own data; composer works; warning banner present; refresh every 30 s while open |
| FE-5.8 | Admin inquiry inbox/pipeline: filters, detail, reply, assign, status, qualification, internal notes | Frontend | Must | FE-4.14, J-5.1 | Not started | — | — | Internal notes visually distinct from replies; transitions limited to allowed actions; unread indicator |
| FE-5.9 | Admin client directory and client detail | Frontend | Must | FE-4.14, J-5.1 | Not started | — | — | List/search/detail with inquiry history; deactivate with confirm dialog |
| J-5.10 | Inquiry integration: remove mocks; E2E interest→staff reply→client sees reply; notes never exposed | Both (lead: Frontend) | Must | BE-5.3, BE-5.4, BE-5.5, FE-5.6, FE-5.7, FE-5.8, FE-5.9, J-4.15 | Not started | — | — | E2E green; internal-note leak assertion passes; no TEMP-MOCK for inquiry features |

### Phase 6 — Appointments, transactions, complaints, notifications, reporting, policies, AI assistant

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| J-6.1 | 6A Freeze appointment contract: lifecycle, parties, reschedule/cancel rules, address disclosure, fee fields | Both (lead: Backend) | Must | J-5.1 | Not started | OQ-04, OQ-11 | — | Endpoints `Agreed`; transition table fixed; exact-address disclosure rule encoded; fee fields match OQ-04 outcome |
| BE-6.2 | 6A Appointment models + staff scheduling API with conflict detection | Backend | Must | BE-5.2, J-6.1 | Not started | — | — | Overlap for same staff/property rejected (409); links inquiry→appointment; status history + audit; inquiry status moves to `inspection_scheduled` |
| BE-6.3 | 6A Client appointment API (view, confirm, cancel, request reschedule) and staff outcome recording; exact address after confirmation | Backend | Must | BE-6.2, BE-5.3 | Not started | — | — | Client sees only own; exact address appears only after confirmation; cancellations by role recorded; outcome stored |
| FE-6.4 | 6A Admin appointment list/calendar, schedule-from-inquiry form, outcome form | Frontend | Must | FE-5.8, J-6.1 | Not started | — | — | Create from inquiry; conflict error shown; outcome recorded; list filters by date/status/staff |
| FE-6.5 | 6A Client appointment views: details, confirm/cancel/reschedule request, fee disclosure text | Frontend | Must | FE-5.7, J-6.1 | Not started | — | — | Shows disclosure text from API before any fee-implying action; exact address shown only when API returns it |
| J-6.6 | 6A Appointment integration: remove mocks; E2E schedule→confirm→complete; disclosure rule verified | Both (lead: Backend) | Must | BE-6.3, FE-6.4, FE-6.5, J-5.10 | Not started | — | — | E2E green; exact address absent before confirmation; no TEMP-MOCK left |
| J-6.7 | 6B Freeze fee and transaction contract: rules, calculation basis, lifecycle, ledger, disclosure fields | Both (lead: Backend) | Must | J-6.1 | Not started | OQ-03, OQ-04, OQ-06 | — | OQ-03/04/06 decided or defaults accepted; worked examples from the proposal written into the contract; endpoints `Agreed` |
| BE-6.8 | 6B Fee rules configuration and calculation service (pure functions, kobo, rounding, rent vs sale) | Backend | Must | J-6.7 | Not started | — | — | ₦50m sale at 2% ⇒ ₦1,000,000 per party; half-up integer rounding `(base*bps+5000)//10000` matches the contract vectors; rent bases follow OQ-03; rules versioned, never edited; snapshot stored on transactions |
| BE-6.9 | 6B Transaction and ledger models + staff API: create, events, fee invoice, manual payment recording, complete/cancel, audit; client summary | Backend | Must | BE-6.8, BE-6.2, BE-5.4 | Not started | — | — | State machine enforced; ledger append-only (corrections by reversal); fees come only from the service; client summary shows own only |
| FE-6.10 | 6B Admin transaction and fee screens (terms timeline, fee breakdown from API, payment recording) | Frontend | Must | FE-5.8, J-6.7 | Not started | — | — | No fee arithmetic in frontend (lint/grep check + review); ledger shown; reversal flow; actions from API |
| FE-6.11 | 6B Client fee explainer page and transaction summary in account area | Frontend | Must | FE-5.7, J-6.7 | Not started | — | — | Shows fee, payer, basis and refund/credit rules from API/content before agreement; off-platform warning present |
| J-6.12 | 6B Transaction integration: remove mocks; E2E inquiry→appointment→transaction→fees→payment→complete; worked-example cross-check | Both (lead: Backend) | Must | BE-6.9, FE-6.10, FE-6.11, J-6.6 | Not started | — | — | E2E green; ledger totals equal displayed fees; fee figures equal the worked examples in the contract |
| J-6.13 | 6B Payment gateway integration (webhooks, reconciliation) — deferred until legal and product approval | Both (lead: Backend) | Deferred | J-6.12 | Not started | OQ-06 | — | Only started after an approved ADR and OQ-06 decision |
| J-6.14 | 6C Freeze complaint, suspicious-listing report and investigation contract (minimum fields, rate limits, privacy, verify-before-action) | Both (lead: Backend) | Must | J-4.1 | Not started | OQ-16 | — | §4.8 endpoints `Agreed`; minimum fields, rate limits, privacy rules, outcomes and allowed actions fixed; staff-vs-admin action split fixed |
| BE-6.15 | 6C Complaints/reports models and API: public report, client complaint, evidence upload, staff investigation (findings, outcome, actions), precautionary hold, reporter notification | Backend | Must | BE-6.9, BE-3.3, BE-4.3, J-6.14 | Not started | — | — | Minimum fields enforced; rate limits, honeypot, duplicate detection work; reporter identity only on admin schemas; cannot resolve without findings/outcome/action; permanent actions admin-only; hold sets review date and property history; counts never act automatically |
| FE-6.16 | 6C Report-a-listing form, complaint form, my-complaints tracker, admin complaints queue and investigation screen | Frontend | Must | FE-4.14, FE-5.7, J-6.14 | Not started | — | — | Report reachable from every listing; only minimum fields; privacy sentence and reference shown; client sees status and public note only; admin sees investigation panel, hold banner and only the actions the API allows |
| J-6.17 | 6C Complaints integration: remove mocks; E2E report→triage→resolve | Both (lead: Backend) | Must | BE-6.15, FE-6.16 | Not started | — | — | E2E green: report→triage→investigate→resolve with reporter identity absent for non-admin; duplicate and rate-limit paths; no TEMP-MOCK left |
| J-6.18 | 6D Freeze notification event catalog and (optional) in-app list contract | Both (lead: Backend) | Should | J-6.7 | Not started | OQ-15 | — | Events, recipients, template names and trigger conditions listed; no PII beyond need |
| BE-6.19 | 6D Notification outbox, worker, email sending and event hooks (inquiry reply, appointment changes, listing decisions, transaction updates) | Backend | Should | J-6.18, BE-6.9, BE-6.3, BE-5.4, BE-4.6 | Not started | — | — | Outbox row written in same transaction; worker retries with backoff; failures never break requests; emails tested in Mailpit |
| FE-6.20 | 6D In-app notification centre (bell, list, mark read) | Frontend | Could | FE-5.7, J-6.18 | Not started | — | — | Unread count; mark read; links to entities |
| J-6.21 | 6D Notifications integration: E2E key events produce emails (and in-app if built) | Both (lead: Backend) | Should | BE-6.19 | Not started | — | — | E2E green with Mailpit assertions |
| J-6.22 | 6E Freeze KPI definitions and reporting contract (system-derivable KPIs only) | Both (lead: Backend) | Should | J-6.7 | Not started | OQ-17 | — | Each KPI has formula, source columns, period; excluded KPIs listed |
| BE-6.23 | 6E KPI aggregate endpoints with date ranges | Backend | Should | BE-6.9, BE-5.2, BE-4.2, J-6.22 | Not started | — | — | Numbers match hand-computed expectations on a fixture dataset; staff/admin only; query plans acceptable |
| FE-6.24 | 6E Admin dashboard home: queue counts, KPI cards/charts, date filter | Frontend | Should | FE-4.14, J-6.22 | Not started | — | — | Matches API numbers; accessible chart alternatives; loading/empty states |
| J-6.25 | 6E Reporting integration: remove mocks; verify KPIs against the dev seed | Both (lead: Backend) | Should | BE-6.23, FE-6.24 | Not started | — | — | Dashboard figures equal fixture expectations |
| FE-6.26 | 6F Policy and disclosure pages: terms, privacy, fees, verification limits, refunds, reporting (placeholder content until legal approval) | Frontend | Must | FE-2.3 | Not started | OQ-01, OQ-18 | — | Pages exist, linked from footer and consent checkboxes; placeholder banner visible until counsel approves; version string matches `/policies/current` |
| BE-6.27 | 6F Stale-availability job: flag listings not confirmed within the threshold | Backend | Could | BE-4.5, BE-6.19 | Not started | — | — | Listings past the threshold appear under `stale_availability` and trigger a staff email |
| J-6.28 | 6G Freeze AI assistant contract and safety policy: scope and intents, knowledge-base rules, handoff triggers, call-line and hours config, guardrails, logging and retention, evaluation criteria | Both (lead: Backend) | Should | J-5.1, J-4.1 | Not started | OQ-23, OQ-24, OQ-25, OQ-26 | — | §4.9 endpoints `Agreed`; handoff triggers and refusal categories fixed; call-line number and hours supplied (OQ-24); provider and data-sharing decided (OQ-23); initial FAQ list and ≥40-question golden set drafted (OQ-25) |
| BE-6.29 | 6G Support settings, public-config endpoint, knowledge-article models and admin API (draft → admin publish) | Backend | Should | BE-3.3, J-6.28 | Not started | — | — | `/public-config` returns call line, hours and `is_open_now` (Africa/Lagos); only published articles are retrievable; only admins publish and change settings; changes audited; phone validated as E.164 |
| BE-6.30 | 6G Assistant service and conversation API: LLM client interface (mock + real), retrieval over articles and public property search, deterministic handoff guards, output filter, rate limits, token budget, logging, message-the-team handoff | Backend | Should | BE-6.29, BE-4.7, BE-5.3, J-6.28 | Not started | — | — | Answers only from approved sources with source references; every handoff includes the call option; output never contains a phone/email other than the support contact; assistant tools cannot reach landlord, user, inquiry or document data; provider error, timeout or budget exhaustion → 200 handoff `service_unavailable`; message-team handoff creates a `general` inquiry with transcript note; LLM key server-side only; rate limits per contract §6 |
| BE-6.31 | 6G Assistant evaluation and red-team suite: golden Q&A, handoff cases, prompt injection (incl. in article text), PII extraction, legal/payment/complaint refusals | Backend | Should | BE-6.30 | Not started | — | — | ≥ 90% of golden questions answered with the correct source; 100% of out-of-scope cases hand off with the call line; 100% of injection and PII cases pass; actual results recorded |
| FE-6.32 | 6G Assistant chat widget: launcher, panel, disclosure, messages with source chips, handoff card (click-to-call, hours, message team, report listing), rate-limit/offline/error states | Frontend | Should | FE-5.6, J-6.28 | Not started | — | — | AI disclosure shown; plain-text/safe-markdown rendering only; call link and hours always visible and from `/public-config`; handoff card for every handoff, `429` and failure; works at 360 px; keyboard and screen-reader operable; no keys or prompts in the client |
| FE-6.33 | 6G Admin screens: knowledge-article editor, assistant conversation review (flagged, handed-off), support settings (call line, hours, enable toggle) | Frontend | Should | FE-4.14, J-6.28 | Not started | — | — | Staff draft articles, admins publish; flagged and handed-off conversations reviewable with notes; admin-only settings with E.164 and hours validation |
| J-6.34 | 6G Assistant integration: remove mocks; E2E answer from the knowledge base; out-of-scope → call line; message-team handoff creates an inquiry; injection and PII checks | Both (lead: Backend) | Should | BE-6.31, FE-6.32, FE-6.33, J-5.10 | Not started | — | — | E2E green with the mock-LLM test mode; handoff card shows the configured call line; no private data in any transcript; manual live-model run recorded; no TEMP-MOCK left |

### Phase 7 — Integration testing, security review, bug fixes, deployment

| ID | Task | Owner | Pri | Depends on | Status | Blockers | Branch / PR | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| J-7.1 | Full regression: all core journeys E2E, bug triage list | Both (lead: Backend) | Must | J-6.6, J-6.12, J-6.17, J-6.21, J-6.25, J-6.34, FE-6.26 | Not started | — | — | All Must journeys pass on a clean database; defects logged with owner and severity |
| BE-7.2 | Backend security review: authz sweep, validation, uploads, rate limits, secrets, headers, dependency audit, PII in logs | Backend | Must | J-7.1 | Not started | — | — | ASVS L1 checklist completed with evidence; no open High/Critical; findings fixed or accepted via ADR; assistant red-team suite (BE-6.31) re-run and passing |
| FE-7.3 | Frontend security and quality review: XSS, CSP, cookie handling, a11y (axe + manual), responsive and low-bandwidth, Lighthouse | Frontend | Must | J-7.1 | Not started | — | — | No open High/Critical; axe clean on key pages; Lighthouse budgets met; CSP in place |
| J-7.4 | Performance and data-integrity pass: indexes, N+1, search plans, image optimisation, backup/restore drill | Both (lead: Backend) | Must | J-7.1 | Not started | — | — | NFR-01 targets met on a 5k-listing dataset; restore drill succeeds and is documented |
| BE-7.5 | Backend deployment: Docker image, production config, migrate-on-deploy, backups, retention purge job, logging/monitoring, health checks | Backend | Must | BE-2.6 | Not started | OQ-20 | — | Staging and production deployable from CI; rollback documented; backups scheduled; secrets only via env |
| FE-7.6 | Frontend deployment: build, env, caching, sitemap/robots, error pages, monitoring | Frontend | Must | FE-2.7 | Not started | OQ-20 | — | Staging and production deployable; sitemap lists published properties; error boundary reports with request_id |
| J-7.7 | Staging UAT with real staff scenarios, fixes, legal content published, release acceptance checklist, go/no-go | Both (lead: Backend) | Must | BE-7.2, FE-7.3, J-7.4, BE-7.5, FE-7.6, FE-6.26 | Not started | OQ-18 | — | UAT scenarios pass; counsel-approved policy content live; every Must requirement traced to a passing test; both developers sign |
| J-7.8 | Production release and hypercare bug-fix window | Both (lead: Frontend) | Must | J-7.7 | Not started | — | — | Release tagged; monitoring reviewed daily for the agreed window; defects triaged |

## Test results log

Record the real result of each task's test run here (newest first).

| Date | Task | Command(s) | Result (pass/fail counts) | Notes |
|---|---|---|---|---|
| 2026-10-24 | J-0.2 (v0.2 revision) | cross-reference check (task IDs, OQ IDs, files, dependency graph) | see session output | Documents only; no code yet |
| 2026-10-23 | J-0.2 | cross-reference check (task IDs, files, dependencies) | passed | Documents only; no code yet |

## Defect log

| ID | Found in | Severity | Owner | Status | Description |
|---|---|---|---|---|---|
| — | | | | | |

## Task report template (paste after each task)

```
Task: <ID> <title>          Owner: <FE|BE|Joint>          Branch/PR: <link>
Result: Done | In review | Blocked
Tests run: <commands> → <actual results>
Docs updated: <files or "none needed">
Contract changes: <none | version bump + link>
Deviations / risks: <…>
Next unblocked task(s): <IDs>
```

## Session setup note
Each developer creates a local, git-ignored `.dev-role` file in the repo root containing `frontend` or `backend`, or states the role at the start of every AI session. `AGENTS.md` and `CLAUDE.md` (identical) tell the AI to read it. J-2.1 extends the root `.gitignore`; keep the `.dev-role` line.
