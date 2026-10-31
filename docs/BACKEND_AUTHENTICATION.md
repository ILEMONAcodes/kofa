# Database-backed identity and shared sign-in

Task: J-3.7 — Authentication module, including required BE-2.2/BE-3.1–3.4 foundations.
Objective: Replace temporary review identities with PostgreSQL users and revocable sessions, retain one login and database-assigned client/staff/admin destinations.
Owner: Joint, Developer 2 lead; user explicitly requests backend and frontend connection.
Branch: joint/J-3.7-database-authentication, retaining the preceding review-access implementation until replacement is integrated.
Documents: PRD FR-AUTH-01–08, FR-POL-02; API_CONTRACT §§2.2–2.7,4.1–4.2,5–6; DATABASE_SCHEMA §3/§8; ARCHITECTURE §6; ADR-003.
Scope: FastAPI identity scaffold, PostgreSQL/Alembic, Argon2id, register/login/refresh/logout/me, CSRF, role enforcement, admin team management, reset/verification email abstraction, frontend auth adapter and protected navigation. No property/inquiry/financial backend modules.
Dependencies: backend absent; bootstrap only identity prerequisites within this module. Neon selected by user; create ignored backend/.env placeholders, user supplies URLs later. Test against isolated real local PostgreSQL, not SQLite.
Working assumptions: ADR-003; draft authentication contract usable. User override: password minimum is 8 characters (2026-10-31), maximum 128; retain common-password rejection. Admin is the existing administrator role; public signup always client; landlords retain contact registration in listing flow. No real users or outgoing email in tests; no final legal text published.
Contract clarification CR-AUTH-001: define anonymous GET /auth/csrf bootstrap, current-policy shape, admin update version output, single-use set-password invitation flow, and database rate-limit support. Record version/changelog explicitly. Preserve existing cookie names/lifetimes/refresh path.
Acceptance: accounts persist in PostgreSQL; passwords/tokens hashed; sessions rotate and detect reuse; logout revokes server-side; current database role/activity enforced; client cannot self-promote; admin can create/deactivate staff but cannot demote/deactivate self; shared frontend login redirects by returned role; no review-account role grant; Neon placeholders private.
Validation: actual PostgreSQL API/security/permission/concurrency and migration up/down tests; frontend adapter tests, production build/typecheck/lint; connected browser login/registration/team/logout/refresh with actual FastAPI+PostgreSQL.


## Implemented flow

`/login` uses `/api/v1/auth/login`; PostgreSQL assigns the role and the existing destination helper routes clients to `/account/overview`, staff to `/staff/overview`, admins to `/admin/administration`. No public role selector or staff-entry link is restored. Admin Users creates database-backed staff/admin accounts and activates/deactivates users; API updates also support role changes with optimistic versions and self-protection.

Temporary `/api/review-auth`, its signing/account configuration, and browser role grants have been removed. The existing access-provider names and route-helper compatibility exports remain to avoid unrelated screen rewrites; their implementation now obtains identity only from FastAPI. Registration validates 8–128 characters, rejects common passwords, requires name/phone/consent and records the policy versions actually displayed on the form. Password reset and email verification use actual single-use private-outbox links. No old six-character review password is accepted.

Frontend server components forward only the access cookie to FastAPI with no-store fetches. When its cookie expires, `/session/restore` lets the browser send the refresh cookie at its intentionally restricted `/api/v1/auth` path, then returns to the safe role-appropriate URL. Parallel expired API requests share one refresh. Sign-out revokes the database refresh family, clears cookies, and fully navigates home to discard the client router's private-page cache.

## Neon/private configuration

The user has populated the pooled and direct URL slots in ignored `backend/.env`. A random local auth secret was generated only when its slot was blank; user-supplied URLs were preserved. Read-only SELECTs verified the pooled connection, actual client-to-Neon TLS, and the current identity migration revision. No real account was seeded into Neon and no real email was sent. Run the documented `seed-admin` command once to create the owner account privately; it prompts when seed email/password slots are blank.

During validation, a newly populated direct URL was initially inherited by migration tests, causing the migration runner and API tests to target different databases. Migration checks reached the new Neon identity tables, including downgrade/reapply. The user confirmed there were **no pre-existing records**; "existing data" referred to newly visible tables. Isolation was corrected: both test URL variables are explicitly set to the local test DB, Alembic is given the guarded URL directly, and fixture code refuses a remote host or a non-test database name before cleanup. No test users, operational records or private test credentials were seeded into Neon. Test fixtures are excluded from the runtime Docker image and are never exposed as HTTP routes.

## Startup and deployment

Full commands and private variable descriptions: [backend/README.md](../backend/README.md). Local backend is `uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log`; frontend remains Next.js. The initial administrator is created by `python -m app.cli seed-admin`, not a public registration role.

Neon is the database; the FastAPI service still needs a Python/container host for deployment. Set its `PUBLIC_ORIGIN` to the exact frontend origin, Secure cookies for HTTPS, and set frontend server-side `API_ORIGIN` to that backend. Do not copy database credentials to browser-exposed variables. No application was deployed or pushed by this task. The Dockerfile is supplied but Docker is not available locally, so its image build was not run.

SMTP delivery remains explicitly configurable: default outbox mode sends nothing; staff with temporary passwords can sign in immediately. Production public registration remains disabled until the owner supplies approved policy versions; this task publishes no final legal text. Other property/inquiry/financial screens continue using their existing illustrative data and are not claimed as live backend integrations.

## Verification

- Backend: **31 tests passed** against isolated real PostgreSQL, including 7/8-character boundaries, common-password rejection, cookie flags, CSRF/Origin checks, brute-force limits, role/endpoint matrix, active-role changes, logout and reset revocation, refresh reuse/concurrency, invitations/verification, audit immutability, seeded migration down/up, private CLI bootstrap and mocked SMTP safety. Ruff passed; mypy passed for 27 application modules. One upstream Starlette/httpx deprecation warning remains; no test failures.
- Frontend: **113 unit tests passed** in 19 files, including parallel refresh coalescing and the real auth adapter. ESLint and TypeScript passed; production build generated 247 pages; mock audit found no active TEMP-MOCK handlers. Original layout, catalogue, mobile launch and budget corrections retained.
- Real-stack Chrome run: **95/100 passed**. The five failures were inspected: worker/fixture timeouts (including a long browser/host pause), a test racing sign-out navigation, and a strict alert selector matching Next's route announcer. Corrected synchronization/selector and set the real-stack default timeout to 60 seconds. Fresh serial affected rerun: **5/5 passed**. All **100 distinct browser checks** have passing results across runs. After final router/repository/body-limit cleanup, the five database-auth browser journeys passed again against actual FastAPI/PostgreSQL.
- Read-only Neon check: pooled connection succeeded; client-to-Neon TLS is active; identity migration revision is at head. No real users seeded and no external email delivered.
- Generated user-owned `frontend/next-env.d.ts` edit restored/excluded. `backend/.env`, frontend private env, virtualenv and test artifacts are ignored. Docker image build was not run (Docker unavailable). No code was pushed or deployed by this task.

## Review / next steps

Code is ready for the other developer's review on `joint/J-3.7-database-authentication`. Shared contract v0.3.0 and schema deltas are explicitly recorded. Create the initial administrator privately, configure the backend host/frontend origin and SMTP as needed, then deploy. Remaining foundational OpenAPI/type generation/CI and existing-staff role-edit UI can proceed separately; live property/inquiry/financial APIs remain later modules.
