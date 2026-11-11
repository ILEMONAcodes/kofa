# Support configuration and knowledge base — BE-6.29

Task Brief: Joint, Backend lead; joint/BE-6.29-support-knowledge stacked on availability accaaa4 pending merge. Objective: editable support contact/hours, staff article drafting, admin publication and published-only public Help. Read PRD FR-NTF/5.8/OQ-24/25, plan BE-6.29/FE-6.33, API §4.9, settings/article schema and existing help/admin routes. Files: backend models/migration/repos/services/routes/tests, connected existing frontend screens, contract/schema/progress. Acceptance: E.164 contact, WAT weekly/overnight hours, role matrix, optimistic conflicts and audit, private drafts, safe text rendering and real-stack browser coverage. Scope excludes LLM/provider calls, chat/review, final legal-policy publication, real SMTP, fees and production operations. Owner supplied initial public support phone +2348145935403 and Mon–Fri 09:00–16:00 WAT; email remains unset; admins can change all support details. No real articles are automatically published. New migration requires separate production approval. Pending notification migration is independent and may need a merge revision when its branch joins; current migration follows be615_complaints.

## How to use

- Public: `/resources/help`, then select a published article. Support call/email links and WAT opening status load from the API. Empty Help is valid until an admin publishes content.
- Staff: workspace menu → Knowledge base (`/staff/knowledge`), create/edit drafts.
- Admin: `/admin/knowledge`, review an article and publish/unpublish. Support settings: `/admin/support-settings`, also linked from knowledge screens. Blank phone/email clears it.
- New database migration: `be629_support`. **Not applied to Neon.** Apply only after approval, coordinating with the separately pending notification migration. No email worker, AI provider, or production settings were enabled.

Initial contacts/hours are application fallback values until the first admin save; all future changes are stored and audited in PostgreSQL. Weekly opening is inclusive, closing exclusive. Articles render as plain text so pasted markup cannot execute.

## Verification

- Focused local PostgreSQL support/OpenAPI suite: **39 passed**, including request budgets, simultaneous settings edits, draft privacy, publication lifecycle, audit minimisation and seeded migration downgrade/upgrade preserving unrelated users.
- ORM metadata vs migrated local database: **no differences**. Search EXPLAIN uses the status index on the small fixture; trigram index exists for larger search sets.
- Real production frontend + local FastAPI/PostgreSQL browser journey: **1 passed** on final build; staff draft → admin publish → public article → unpublish; support email changed through admin. Help overflow and axe checks passed at360/768/1280px; mobile/desktop screenshots reviewed.
- Frontend: **157 unit tests passed**; lint/types/build/mock audit passed. Backend Ruff/mypy(81 files)/pip consistency passed. OpenAPI snapshot matches.
- Audits: backend no known vulnerabilities; frontend high/critical gate passed, seven existing moderate development-tooling findings retained.
- Local single-session reviewer checked committed routes/services/repositories/schemas/UI and corrected one contract-table formatting issue; no blocking finding. Independent developer review still pending.
- No private environment file or unrelated changes are included. Full backend regression: **626 passed, 1 separate property-latency case deselected**; final focused39 checks also cover four cases added after full-suite collection. See PROGRESS.md.

## Approved Neon migration — 11 November 2026

Owner approved the migration and push after local validation. `be629_support` was applied successfully from `be615_complaints`; catalog-only checks verified both tables and indexes without reading/seeding application records. This supersedes the earlier local-only migration status. Pending notification branch still requires migration-head coordination before it joins. Application merge/deployment remains separate from this push.
