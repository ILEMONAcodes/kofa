# BE-4.5 — staff property queue and management

Task brief: implement API_CONTRACT §4.6 queue/detail/edit/assign/availability/media and landlord directory, without verification/publish transitions. Owner: Developer 2 Backend. Branch: be/BE-4.5-staff-property-api, stacked on BE-4.4.
Documentation: IMPLEMENTATION_PLAN BE-4.5; API_CONTRACT §§2,4.6,5; DATABASE_SCHEMA §4; ARCHITECTURE security/storage. Dependencies BE-4.2/3.3/4.3/4.4 implemented, in review.
Files: staff schemas/repository/service/router, protected local file delivery, media helper refactor, application/body-limit wiring, API tests and docs.
Acceptance: staff/admin only; queue filters, strict queries and pagination; private detail includes signed evidence/media; optimistic version conflicts 409; price/description invalidate approval without recomputing verification; valid staff assignment; stale availability 14-day default; audited mutations; landlord directory; media scoped to the correct property.
Tests: every role, deactivation, query/filter/sort/edge cases, version conflict, approval invalidation, media management, signed link ownership/expiry/auth, upload bounds and all existing regression checks.
Working assumptions: draft staff DTOs refined in CR-STAFF-PROPERTY-001. Protect live/archived/rejected detail edits until staff explicitly reopen/unpublish via later workflow; availability confirmation remains allowed for live records. Assignment/availability/media operations serialize with row locks; optional version supported where prior body shape omitted it. PATCH property requires version.
Out of scope: verification/landlord-approval recording/transitions/public browsing; frontend, real email delivery, real bucket/Neon changes. Staff invitations remain pending email configuration.

## Implemented scope

Queue filters/pagination/sorts use comma-separated contract conventions with strict unknown/duplicate query rejection. Summary joins area/owner/assignee/current verification/cover in a bounded query count (tested with one versus multiple listings). Stale availability means null or older than 14 days; the exact cutoff is fresh. Detail assembles explicit staff-only DTOs, evidence links, verification and approval/history snapshots. These are reads only; no verification/publish mutation exists yet.

Property edits validate merged fields and optimistic version, then supersede current approval only for actual price/description changes. Unrelated edits preserve approval and all edits preserve verification records, per contract. Published detail editing requires unpublishing. Assignments allow active staff/admin or null; availability confirmations require aware nonfuture times. Mutations audit and increase aggregate version. Queries live in repositories; services own rules/transactions.

Media additions reuse the validated private upload service and shared bounded multipart transport; metadata edits/cover selection are atomic, removal queues private deletion and selects a replacement cover. Local downloads stream files after current role + signed key/property/file checks and audit; no public file mount added. Production S3 retains five-minute signed bearer URLs. Storage may remain disabled while no assets are requested; retrieving linked assets requires real private storage configuration.

## Integration boundary

- No schema/model additions or migrations in this task; apply existing BE-4.2/4.4 migrations before deployment. No Neon operations performed.
- The frontend staff workspace remains a separate integration task. No UI files were changed. Real private S3 credentials/configuration are still needed for deployed uploads/assets.
- GET detail/list asset URLs are signed on demand; expiration requires refreshing the detail/list response. Local URLs work through the same-origin frontend API rewrite and require staff cookies.
- Read-only staff assignee name/ID references are included where already assigned. Admin account management provides the existing roster; a dedicated staff-facing assignment picker endpoint may be added in frontend integration if needed.
- Next: BE-4.6 verification recording, landlord approval and guarded approve/publish/unpublish transitions. Staff email invitations remain pending mail-provider/worker setup as requested.

## Validation investigation

First focused staff suite: 70 passed. Expanded full suite: 211 passed/1 failed due to the deletion test attempting to read an expired ORM object's ID after successful row removal. Captured the ID before deletion; no application behavior change needed for that failure. Final regression also includes repository separation, empty optional values, exact stale boundary and SELECT-count checks.

## Final evidence

- Full `pytest -q`: **213 passed**, two pre-existing deprecation warnings (Starlette TestClient/httpx and pypdf's add_js test helper). Includes 77 staff cases and the previous 136 backend cases.
- `ruff check .`: passed. `mypy app`: passed (43 source modules). `git diff --check`: passed.
- Role matrix covers anonymous/client/staff/admin across all eleven staff routes. Tests verify concurrent version conflict, exact 14-day stale boundary, approval invalidation with unchanged verification, cross-file signatures, current-role/deactivation rejection, media cover/deletion, directory privacy, and bounded SELECT count for larger queue pages.
- Local PostgreSQL and temporary files only. No real data, bucket, Neon, frontend/browser or deployment operations. Full service uses repository-owned SQL. No new migration/dependencies.
- API v0.5.0 / CR-STAFF-PROPERTY-001; cross-developer review pending, task In review. Not pushed.

Pinned Python dependency audit re-run for this task: no known vulnerabilities; hash-lock recommendation remains, OS packages not audited. `pip check` reports no broken requirements. No dependency changes made.
