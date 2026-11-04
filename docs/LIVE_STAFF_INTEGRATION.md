# FE-4.14 — live staff property integration (partial module)

Task brief: connect existing staff property/landlord screens to BE-4.5 APIs while preserving original brown/cream app shell and responsive patterns. Developer 2 continues explicit cross-area authorization. Branch joint/FE-4.14-live-staff-properties, stacked on be/BE-4.5-staff-property-api.
Dependencies: database auth and staff API implemented. Contract v0.5.0; additive staff property-options catalogue clarified in v0.6.0 for valid dropdown IDs. No public taxonomy or browsing implementation inferred.
Files: frontend staff components/routes/types/API transport/CSS, backend reference options only, tests/docs. Acceptance: no example property data on connected routes; live queue/detail/directory, identity-preserving navigation, valid options for edit/assignment, availability, multipart media and signed evidence links; clear loading/empty/error/409 states; no fake workflow success. Verification/publishing remain unavailable until BE-4.6.
Tests: API reference privacy/roles; multipart transport and model tests; frontend lint/typecheck/build; real FastAPI/Postgres/browser connected journey on isolated fictional data with mobile/desktop checks. No remote application data, Neon migration, live bucket or production deployment.


## Connected flow

Sign in with a staff/admin account → `/staff/overview` → Properties → choose a real submission → details, edit listing, assign reviewer, confirm availability, media/evidence → landlord record and its properties. Administration also links to the property workspace. The selected UUID travels in `?id=` and survives session restoration. Opening a record-specific route without an ID offers the directory, never a sample record.

Queue filters and pagination run on the server. The private options endpoint supplies active reference IDs; labels are human-readable. Prices use integer kobo transport/shared naira parsing and timestamps display in Africa/Lagos. Saves use CSRF and current aggregate versions. Conflicts retain unsaved inputs and offer an explicit reload; success appears only after the API succeeds. Uploads use the shared client with browser-generated multipart boundaries and expired-session replay. Signed files can be refreshed; local downloads still require staff authentication. Photo/video removal requires confirmation. Older property workflow/success URLs show actual record details rather than fabricated outcomes.

## Remaining boundaries

This is the property-management portion of FE-4.14, not completion of J-4.15. The BE-4.6 follow-up now implements verification checklist writes, landlord approval and status transitions/publish guards together with their frontend; see [Property workflow](PROPERTY_WORKFLOW.md) for current validation. Public live browsing and landlord form integration remain pending. Other workspace domains keep their earlier presentation until their APIs are implemented. Staff invitation mail is still pending.

Production needs existing property migrations, active reference seeds and private storage configured. Next's local proxy body cap is raised to 101 MB to accommodate the backend multipart limit; actual frontend-host/Render/storage upload limits and real video probing still need deployed verification. No claim that 100 MB videos work through the deployed host. No Neon migration, live file, user-data mutation or deployment performed.

## Validation

- Full backend regression: 217 passed (two existing deprecation warnings); focused staff suite: 81 passed.
- Full frontend unit suite: 118 passed across 20 files, including multipart transport/session replay and stale-record error presentation.
- Backend Ruff and mypy pass (43 modules); frontend lint/typecheck and production build pass; mock audit finds no active TEMP-MOCK handlers. The audit does not mean unrelated presentation modules are integrated.
- Final production-build browser checks: 6/6 affected staff-screen checks passed. The live journey initially failed because its generic alert locator also matched Next's route announcer; scoped the assertion to the workspace and reran: 1/1 passed. All 7 distinct checks have passing results. The live test creates a landlord draft, uploads five photos and ownership evidence, submits, opens it from the live staff queue, verifies an actual concurrent 409 while retaining unsaved text, reloads/saves, assigns, confirms availability, uploads/sets cover/removes media, opens private evidence and verifies client denial. No endpoint mocks. Desktop/mobile overflow and serious/critical axe checks pass. Saved 360 px and 1280 px media screenshots visually checked; original brown/cream shell retained.
- User's `.DS_Store` and personal generated `next-env.d.ts` edits are preserved and excluded from the task.


## Owner-requested follow-ups

Keep these two reminders visible when planning the next work:
1. Staff invitation emails: admin invites staff; recipients set their password through a secure expiring invitation flow, with email delivery configured.
2. Cloudflare R2 file storage and direct uploads: configure private storage, implement authorized short-lived direct-upload grants with backend validation, then verify photos/videos and private evidence on Vercel/Render. Not implemented in this task.
