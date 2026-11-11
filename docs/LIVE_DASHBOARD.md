# Live non-financial dashboard — J-6.22 / BE-6.23 / FE-6.24 / J-6.25

Task Brief: Joint, Backend lead; `joint/J-6.25-live-dashboard` from main `0264d26`. Objective: replace dashboard sample figures with four private database aggregates and date filters. Required docs: PRD FR-ADM-01/FR-RPT-01/OQ-17, plan 6E, API conventions/permissions, existing domain schemas and dashboard layouts. Files: backend report repository/service/schema/router/tests, existing frontend dashboard routes/reusable report component/tests, contract/progress/decision docs. Dependencies: existing property/inquiry/inspection/complaint tables and authenticated role guards; financial dependencies deferred by owner. Contract CR-REPORT-001 v0.13.0 (main baseline v0.11.0; v0.12.0 reserved for the separate pending notification branch). Reporting has no dependency on that migration. Acceptance: four exact current-state counts, documented date bases/WAT bounds, strict paired date filters, one consistent aggregate query, staff/admin only, no PII, live admin/staff entry points, loading/error/empty states and fixture-backed API/browser tests. No migration, financial KPIs, reusable seed module, provider setup or new visual design. Working assumptions: OQ-17 system-derived-only default; user explicitly authorizes frontend integration.

## Metric definitions

These are **current workload counts**, not historical snapshots. No date filter means all eligible records. A paired inclusive `from` / `to` date range uses Africa/Lagos calendar days (start inclusive, following-day midnight exclusive). A selected cohort is still evaluated using each record's current status.

| Metric | Current statuses / condition | Date column |
|---|---|---|
| Listings awaiting review | `submitted`, `in_review` | `properties.submitted_at` |
| Open inquiries | `new`, `in_progress`, `qualified`, `inspection_scheduled`, `negotiating` | `inquiries.created_at` |
| Upcoming inspections | `proposed`, `confirmed`, `reschedule_requested`, starting at or after response `as_of` | `appointments.scheduled_at` |
| Active complaints | `new`, `triage`, `investigating` | `complaints.created_at` |

Draft, changes-requested, approved, published, unpublished, rejected and archived listings are outside the review card. Closed/spam inquiries and resolved/dismissed complaints are excluded. Past, cancelled, completed/no-show inspections are excluded. `from` / `to` do not convert a past inspection into an upcoming one. Returned-change listings await the landlord, rather than a fresh staff review. Financial metrics and PRD metrics beyond these four are not part of this scope.


## Integration and rollout

Staff: `/staff/overview`. Admin: `/admin` redirects to `/admin/overview`; `/admin/reports` opens the same live metrics with the established reporting heading. `/admin/administration` keeps existing team/content tools, linked from the dashboard. Native date inputs, apply/reset and refresh controls use the shared API client and common components. Loading uses the existing logo indicator, failed requests display a retry state without fabricated zeros, and an empty successful result keeps four zero cards with an empty-state message. Counts and applied dates are replaced together when a response arrives; stale responses are discarded by the shared resource hook.

The existing brown/cream tokens, logo, card surfaces, buttons and mobile navigation are retained. Dashboard-specific desktop rules remove the inherited 480px fixed app-shell cap, show two columns and use normal page scrolling. Small screens retain the established app shell. No new fonts, images, dependencies or custom colors. Queue links open the existing workspaces; they do not claim to pre-apply a multi-status/date report cohort as a queue filter.

No new database migration or production data operation is required. Reporting uses existing tables and has no dependency on the deferred notification migration. Push/merge/deployment and other-developer review remain separate. When merging the pending notification branch, retain the newer reporting contract version and merge its reserved v0.12.0 catalogue/changelog rather than downgrading the contract header.

## Test fixtures

`tests/test_reports.py` uses a hand-counted local dataset with all relevant statuses, exact WAT day boundaries, a past active inspection, exclusions and separate dates. `tests.seed_reports_e2e` is a guarded localhost browser fixture, not reusable development/production seed data. It is rejected for non-local or non-`kofa_auth_test*` database names. It creates fictional records only; no remote records or contacts are accessed.

## Verification — 11 November 2026

- Initial regression: 576 backend tests passed with one latency case scheduled separately; 154 frontend tests in 28 files passed. Production build, typecheck, lint and mock audit passed. The 5 November backend audit found no known vulnerabilities; frontend high/critical audit passed with eight existing moderate tooling findings. No dependencies changed.
- Final resumption on fresh isolated localhost PostgreSQL: 18 reporting/OpenAPI checks passed, as did Ruff, mypy (70 files), lint, TypeScript and three dashboard component tests. Separately scheduled 5,000-listing search regression passed at p95 260.76 ms against the unchanged 500 ms target. Combined with the initial regression, 577 distinct backend cases passed across runs.
- Final real-stack Chrome: two checks passed. Admin/staff entry points, counts, dates, empty state, refresh after a new inquiry, client denial, 360/768/1280 layouts, desktop width and axe assertions were verified without endpoint mocks. Final desktop and mobile screenshots were visually inspected after splash completion.
- Screenshot review corrected the inherited 480px desktop cap through dashboard-scoped CSS. Small screens retain the established app shell and theme. Temporary test infrastructure expired during the pause and was recreated locally; Neon was not accessed.
- No private environment edits, real records, production migrations, new dependencies or assets. Unrelated .DS_Store and REGISTRATION_RECOVERY.md remain excluded. Existing Starlette/httpx and pypdf warnings are non-fatal.

Single-session review checks aggregate DTO privacy, role/date guards, single-statement consistency, parameterized queries, current-state wording and scoped styles. Independent peer review, push/merge and deployment remain pending. No migration required.
