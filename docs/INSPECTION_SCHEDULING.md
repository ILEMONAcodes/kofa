# J-6.6 — inspection scheduling integration

Task Brief: Joint (Backend lead), branch `joint/J-6.6-inspection-scheduling` from updated main `968e676`. Owner authorizes backend plus existing frontend integration. Objective: staff schedule from a qualified property inquiry, clients view/confirm/cancel/request rescheduling, staff reschedule/cancel/record outcomes, with database-enforced conflicts and private address disclosure. Required docs: PRD FR-APPT-01–06/BR-03/04/08/OQ-04/11; API §2/5/6 and appointment freeze; schema §6; architecture §4/6/7/12; existing client/staff inspection source screens. Dependencies: J-5.10 implemented; production migration is not authorization for a new production migration. Files: appointment models/migration/repository/service/schemas/router/tests; modular existing frontend routes, contract/schema/decision/progress docs. Contract: additive v0.10.0 / CR-APPOINTMENT-001, documented before implementation. Acceptance: own-object 404; staff/admin-only scheduling; overlapping staff/property/inquiry rejected atomically (including concurrent requests); versions and append-only history/audit; correct inquiry linkage; no landlord phone/email/docs in client output; address policy clarified with owner before implementation; fee zero/disabled with server disclosure; real local schedule→confirm→complete browser coverage and cancellation/rescheduling/conflict tests; reversible migration and OpenAPI drift. Out of scope: production DB writes/deploy/push, fees charged or payment recording, notifications, invitations, Cloudflare provisioning, reusable seed module. Working assumptions: OQ-04 default no inspection fee; active slots proposed/confirmed/reschedule_requested remain reserved until cancelled or rescheduled; one active appointment per inquiry; qualified inquiry required; rescheduling returns to proposed and needs fresh client confirmation; completion/no-show after scheduled end. Owner clarified the conflict: exact property address only after own appointment confirmation; private contacts/documents remain excluded.


## Implemented flow

Staff schedule from a qualified property inquiry using active staff, the actual property/client and a future date, time and duration. Clients can confirm, cancel or request a new time. Staff can reschedule, cancel, browse a filtered calendar and record completed/no-show outcomes after the visit ends. Existing inquiry and staff navigation lead into these live screens.

The database prevents overlapping active appointments for the same staff member or property and multiple active appointments for an inquiry. Adjacent slots are allowed. Versions prevent stale writes; history and audit record transitions. Proposed and reschedule-requested appointments reserve their slots. Cancellation releases them and requalifies an eligible linked inquiry.

Only the owning client's confirmed/completed appointment detail exposes its recorded meeting address and instructions. Lists, public browsing and other clients do not. Rescheduling clears confirmation and the address snapshot. Staff can distinguish the current property address from the address recorded at confirmation. Landlord contacts, documents, coordinates and private outcome notes remain excluded from client responses. All inspection fees are zero; no payment or charge is implemented.

## Contract, design and migration

API contract v0.10.0 adds client `/appointments` reads and confirm/cancel/request-reschedule actions, staff `/admin/appointments` CRUD/actions and `/admin/appointment-options`. Queries are paginated and validated; writes use existing authentication, CSRF, request-size and rate limits. Checked-in OpenAPI matches the application.

Client and staff layouts follow Figma file `TJtiCYvGNkGKJ6ibOIjGCd`, including nodes `78:3798` and `79:6945`, existing original cream/brown tokens, logo geometry and mobile navigation. Existing source assets are reused; actual property media comes from the API. No preview-next-screen links or mock scheduling handlers are used.

Migration `be62_appointments` follows `be52_inquiries`. It creates appointment/history tables, indexes, immutable-history trigger and GiST exclusion constraints using `btree_gist`. Local upgrade/downgrade is tested; downgrade preserves the shared extension. **No Neon migration, push or deployment was performed.** Apply the new migration through an explicitly approved database rollout before deploying this module.

## Verification — 5 November 2026

- Full local backend suite: **518 passed**. After the final confirmed-address snapshot addition: **58 focused tests passed**, including the new regression and OpenAPI snapshot (519 distinct backend cases across these runs).
- Ruff, mypy (61 files), dependency consistency and dependency audit passed; audit reported no known vulnerabilities. No dependencies added.
- Frontend: **146 tests across 26 files passed**; lint, TypeScript, production build and mock audit passed.
- Real local FastAPI/PostgreSQL/production-Next browser regression: **4 passed**, covering inspection scheduling, inquiries and staff publishing. Final affected inspection journey rerun after the snapshot addition: **1 passed**. It covers confirmation/address privacy, rescheduling, conflicts, outcomes, cancellation, calendar filters, responsive widths and axe checks.
- Source/client screenshots were visually compared; test screenshots are local `/tmp/kofa-inspection-{schedule,proposed,client,calendar}.png` artifacts.

Tests use explicitly guarded localhost test databases and fictional accounts. The outcome browser case uses `backend/tests/inspection_clock_e2e.py` to advance only a fictional local confirmed fixture; it exposes no application endpoint and refuses non-test databases. No reusable production seed module was introduced. An initially missing local PostgreSQL cluster was recreated in isolation. A server-timezone discrepancy found in testing was fixed by canonical UTC response serialization. Existing dependency/test-runner warnings did not fail checks.

## Handoff

Implementation is ready for other-developer review, not a claim of independent peer approval. Production rollout, fee charging, notifications and transaction handling are outside this task. Next module: transactions and fee records. Deferred reminders remain **staff invitation emails** and **Cloudflare R2/deployed private storage**.


### 2026-11-05 — approved Neon appointment migration

Owner explicitly approved `be62_appointments`. Applied upgrade from `be52_inquiries` to `be62_appointments` on the configured Neon database using the corresponding direct endpoint. Read-only catalog checks verified both appointment tables, both overlap exclusion constraints, unique active-inquiry index and append-only history trigger. No user records were read, seeded or modified by validation. The configured unpooled URL uses a pooled hostname; the migration used its direct counterpart in memory without changing saved credentials. Push and application deployment remain pending.
