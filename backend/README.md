# Kof’a authentication backend

FastAPI + PostgreSQL + SQLAlchemy/Alembic, following ADR-003 and API contract v0.3.0. Roles are `client`, `staff`, `admin`; everyone uses the frontend `/login`. Public registration creates clients only. Passwords have an **8-character minimum**, 128 maximum, and a common-password check; Argon2id hashes are stored.

## Local setup

Run commands from `backend/`. Use Python 3.12 or newer (local validation also covers 3.13).

```sh
python3 -m venv .venv
.venv/bin/pip install --constraint requirements.lock -e '.[dev]'
```

The ignored `backend/.env` is the private configuration file; `.env.example` is its committed template. **Do not overwrite `.env` if you have already added URLs.** Set `DATABASE_URL` to the Neon pooled URL and `DATABASE_URL_UNPOOLED` to the direct URL for the same development branch. Retain TLS/channel-binding parameters. A random local `AUTH_SECRET` has been generated if its slot was empty; keep it private. Never place database URLs or that secret in `NEXT_PUBLIC_` variables.

Use a development Neon branch for initial migrations; do not run downgrade or test cleanup on a shared/live database. Then:

```sh
.venv/bin/alembic upgrade head
.venv/bin/python -m app.cli seed-admin
.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

`seed-admin` reads private `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, or prompts for them interactively when blank. It never prints the password, creates no default account, and never promotes an existing non-admin account. Repeated calls leave an existing active admin unchanged.

In a second terminal start the existing frontend. Its server-only `API_ORIGIN` points to the backend (local default `http://127.0.0.1:8000`). `PUBLIC_ORIGIN` in the backend must exactly match the browser origin, including port: local default `http://localhost:3000`. Open that URL, then `/login`. Administrator goes to `/admin/administration`, staff to `/staff/overview`, clients to `/account/overview`. Admin → Users adds actual database team accounts and activates/deactivates access.

## Hosting

Neon hosts PostgreSQL; the FastAPI service also needs a Python/container host. `Dockerfile` runs as a non-root user and installs locked runtime dependencies. Run migrations explicitly as a release command, not on every web worker. No automatic admin seed runs on startup.

Backend private variables: both database URLs, `AUTH_SECRET`, `PUBLIC_ORIGIN=https://your-frontend-host`, `COOKIE_SECURE=true`, `APP_ENV=production`. Frontend needs only server-side `API_ORIGIN=https://your-backend-host`, then a rebuild (Next rewrites are built into deployment). The review-account JSON and review signing secret are no longer used. Do not expose database credentials in frontend hosting variables.

Registration requires current policy versions and records explicit consent. Development uses `draft-v1` with a visible draft notice. Production registration fails closed until approved policy versions and `POLICIES_APPROVED=true` are configured by the project owner; this task does not publish final legal text. Existing staff/admin login does not require public registration to be enabled.

## Invitations, reset and verification

Email links are single-use, expire after one hour, and use URL fragments to avoid access-log query leakage. Digests are stored in `password_reset_tokens`; the private outbox stores delivery links. Reset revokes all user sessions. `purpose` prevents verification links being used for reset/invitation.

Default `EMAIL_MODE=outbox` **queues mail without sending it**. Staff can use an administrator-supplied temporary password immediately. To deliver invitations/reset/verification mail, configure the `SMTP_*` fields privately, set `EMAIL_MODE=smtp`, and run an explicit worker/scheduled command:

```sh
.venv/bin/python -m app.cli send-email
```

No outgoing real email was sent during development/testing. Successful delivery discards the saved link payload. Failed messages retain a generic delivery error; retry policy/scheduling belongs to operations. Never expose the outbox as a public endpoint or log message links.

## Security and tests

Access JWT: 15 minutes, HttpOnly cookie. Rotating opaque refresh cookie: 14 days, path `/api/v1/auth`. Signed readable CSRF cookie + matching header and exact Origin are required for every unsafe auth/admin request, including login. Start forms with `GET /api/v1/auth/csrf`. No production CORS is enabled. Trust forwarded IPs only from the known Next/hosting proxy; configure Uvicorn's `--forwarded-allow-ips` for that proxy, never `*` on a public server.

Every API request checks the current database role/activity and a live session. Logout revokes its family; reuse of a rotated refresh token revokes the family. Database rate buckets persist across workers, enforce contract IP/account limits and store HMAC bucket identities. Audit rows exclude passwords/tokens/contact data and have database append-only guards. Public schema never contains password/session/outbox fields.

Tests use **dedicated local PostgreSQL**, never SQLite or Neon. Unit test URL uses `TEST_DATABASE_URL`; browser test URL uses `KOFA_E2E_DATABASE_URL`. Both must have a loopback host and a database name starting `kofa_auth_test`. Both pooled and direct URLs are overridden explicitly in tests and Alembic receives the guarded URL separately. Startup refuses a Neon/remote URL before any fixture cleanup. The test server resets only its dedicated local fixture database.

```sh
.venv/bin/pytest -q
.venv/bin/ruff check .
.venv/bin/mypy app
```

Local validation uses task-owned PostgreSQL on port 55432 (`kofa_auth_test_utf8` and `kofa_auth_test_e2e`). Other developers can create their own isolated local databases and set the test variables. Frontend Playwright starts this real backend test server and the production Next build; fixtures are seeded through guarded local test-only CLI code, never a public backdoor endpoint.

Property/inquiry/appointment/payment endpoints remain separate modules. Their existing frontend screens still use illustrative records; completing authentication does not make those operations live.

## Property foundations (BE-4.2)

The next migration adds property/media/document/verification metadata and landlord consent linkage. It does not expose upload or property APIs yet. Review and apply `alembic upgrade head` on the intended deployment only; tests must use an isolated local test database, never the application Neon URL. Back up before deployment migrations.

After the migration, `python -m app.cli seed-taxonomy` inserts initial Abuja areas and amenity options, preserving existing records. It creates no users or sample properties. This command is explicit and does not run automatically. Rollback is blocked if landlord consents exist; never delete real consent records merely to bypass that guard.

## Upload storage service (BE-4.3)

Uploads are not exposed over HTTP until the landlord-submission task. Storage defaults to disabled. For development set STORAGE_DRIVER=local and choose a private STORAGE_LOCAL_ROOT outside frontend/public. For production use STORAGE_DRIVER=s3 and fill the S3_* placeholders in private hosting settings, with a private bucket. No storage account is provisioned by this code. See [upload service and validation](../docs/PROPERTY_UPLOADS.md). The Dockerfile installs ffmpeg for ffprobe; local video validation requires ffprobe on PATH.

## Landlord contact submissions (BE-4.4)

The four contract endpoints are available under /api/v1/landlord-submissions after the migration. No landlord account is required. Bootstrap /api/v1/auth/csrf first; send Origin and the CSRF cookie/header for all mutations. Draft creation returns a 24-hour X-Upload-Token scoped to the property; keep it private and attach it to uploads/removal/submit. Five photos plus ownership proof or authorisation letter are required before submission. All completed records enter submitted and receive a stable reference. See [setup, limits and handoff](../docs/LANDLORD_SUBMISSIONS.md).

Set real private S3 configuration before deployed file operations. Schedule `python -m app.cli cleanup-files` to retry queued object deletions. CAPTCHA_REQUIRED is false by default; a verifier adapter must be configured before enabling. No production storage, CAPTCHA provider or cleanup scheduler was configured by this task.

## Staff property management (BE-4.5)

Staff/admin sessions can use queue/detail/PATCH/assign/availability/media routes under /api/v1/admin/properties and the read-only /api/v1/admin/landlords directory. Read the [staff API handoff](../docs/STAFF_PROPERTY_API.md) for versioning, private links and deployment prerequisites. No new migration in this task. Verification and publish transitions are the next module; public browsing and frontend staff integration are not included yet.

## Inquiries and messaging (J-5.10)

Migration `be52_inquiries` adds inquiries, text messages, staff-only notes, append-only status history and hashed idempotency requests. Apply reviewed migrations on the intended database before enabling the connected UI; no production migration was run by this task. Routes use normal authenticated sessions, CSRF/Origin checks, per-actor rate limits and audience-specific DTOs. Clients use `/account/inquiries` and staff/admin `/staff/inquiries` and `/staff/clients`. See [contract and deployment handoff](../docs/LIVE_INQUIRIES.md). No email delivery, inspection scheduling or production fixture data added.

Regenerate the checked-in OpenAPI snapshot with `python -m app.openapi`; this export uses non-secret local settings and does not connect to a database. `tests/test_openapi.py` catches drift.

## Inspection scheduling (J-6.6)

Migration `be62_appointments` adds appointments/history and btree_gist exclusions for overlapping staff/property slots. This task only applies migrations to isolated local test databases. Production rollout requires a separate explicit approval and an intended direct database URL; do not run downgrade against real appointments. Client UI `/account/inspections`, staff `/staff/inspections` and `/staff/calendar`, scheduling from a qualified property inquiry. Read [inspection handoff](../docs/INSPECTION_SCHEDULING.md) and API v0.10.0 §4.7B for versions, cancellation/rescheduling, zero-fee disclosure and the owner-approved confirmed-address exception. No mail, fee collection, storage provisioning or public role selector is added.
