# BE-4.4 — landlord draft, uploads and submission API

Task brief: expose API_CONTRACT §4.4 draft/file/delete/submit endpoints, using BE-4.2/4.3. Owner: Developer 2; branch be/BE-4.4-landlord-submissions. Dependencies: identity, property metadata and private media services implemented. Draft contract v0.3.0 used initially; implementation and clarifications recorded in v0.4.0 / CR-LANDLORD-001.
Files: submission schemas/repository/service/router; bounded body middleware and application wiring; reference/cleanup migration; tests and docs.
Acceptance: anonymous contact registration without landlord account; strict property/phone/taxonomy/money/consent validation; signed property-scoped token; 5 drafts/IP/day, 60 uploads/token/hour; CAPTCHA-ready dependency; private uploads/removal; ≥5 photos and ≥1 evidence before submit; stable unique reference; no P3 output; status history/audit; bounded multipart intake.
Tests: success, invalid inputs/consent, wrong/expired tokens, cross-property delete, limits, CSRF/Origin, privacy, storage failures, idempotent submit, migrations up/down, full regression/lint/typecheck/dependency check.
Out of scope: frontend integration, production storage provisioning, Neon migration, staff verification/publication/search endpoints. Existing private settings preserved.
Assumes OQ-02/13 defaults and existing local/S3 abstraction. Owner resolved the blocked-contact contradiction: every completed submission stays submitted; private review notes/audit flags only.

## Implemented routes

- POST /api/v1/landlord-submissions → 201 minimal draft ID/token/expiry receipt; contact + property + amenities + policy consent + initial history/audit commit together. No landlord login or user row created.
- POST /api/v1/landlord-submissions/{id}/files → 201 minimal file receipt; one file; private storage service; authenticated CSRF origin plus scoped upload capability.
- DELETE /api/v1/landlord-submissions/{id}/files/{file_id} → 204, scoped ownership check, draft/changes_requested only, cover replacement and durable private-object deletion queue.
- POST /api/v1/landlord-submissions/{id}/submit → 200 stable reference, requires five photos and ownership proof/authorisation letter; repeats return same receipt without duplicate history. Every completed submission remains submitted.

Row locks serialize uploads/removal/submission and protect count/reference invariants. Full status workflow is a later task. No contact or document read endpoint was added. Minimal Pydantic response DTOs and OpenAPI multipart schema prevent accidental private-field serialization.

## Setup / handoff

1. Review/apply the new migration on the intended deployment after backup; never run tests against application Neon. This task applied migrations only to the isolated local test database.
2. Run seed-taxonomy on that deployment if not already populated. Configure real private S3-compatible storage through hosting secrets; default disabled returns safe 503 for file operations. No provider was provisioned.
3. Schedule python -m app.cli cleanup-files for durable deletion retries; a request attempts only two queued objects immediately. No external scheduler configured here.
4. Frontend landlord form integration remains separate; backend routes alone do not connect the existing form. The Next.js proxy and host upload-size/time limits must also be verified for the 100 MiB video path.
5. CAPTCHA_REQUIRED remains false unless a verifier adapter is installed; enabling without one fails closed. No real external challenge provider contacted.

Storage service limitations from BE-4.3 remain: real bucket and ffprobe/container validation not performed locally; no transcoding; no full malware scanner; failed compensation during an upload can still require storage reconciliation. No final policy copy published.

## Investigation notes

Initial API run: 28 passed/1 failed (oversized JSON incorrectly 400); bounded JSON read moved before parsing. Next full run: 133 passed/1 failed (oversized multipart wrapped an AppError in a Starlette ExceptionGroup and became 500). Receiver-owned oversize flag now preserves 413 without buffering whole files. ClosingMultiPartParser closes partial temporary files on all receive failures/cancellation, compensating for Starlette's narrower cleanup. Targeted oversized + happy-path rerun: 2 passed.

## Final validation

- `pytest -q`: **136 passed** (38 submission API/resource/migration cases + 98 existing tests). Isolated local PostgreSQL 18.4 and temporary private files only. No Neon access.
- `ruff check .`: passed. `mypy app`: passed (39 source modules).
- Pinned dependency audit including python-multipart: no known vulnerabilities; hash-lock recommendation remains.
- Existing Starlette TestClient and pypdf test-helper deprecation warnings remain. No new OpenAPI drift tooling, full frontend/browser run, real storage/ffprobe test or Docker build claimed.
- Schema v0.5; API contract v0.4.0, CR-LANDLORD-001; frontend review pending. User explicitly resolves submitted status.
- Not pushed/deployed. Next: staff property queue/verification/publication APIs, plus separate landlord form integration when storage is configured.
