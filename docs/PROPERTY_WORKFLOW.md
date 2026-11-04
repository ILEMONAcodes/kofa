# BE-4.6 — verification, landlord approval and publication

Task: BE-4.6 with FE-4.14 workflow connection. Owner: Developer 2, explicitly authorized cross-area. Branch: joint/BE-4.6-property-workflow, stacked on the pushed staff integration dependency.
Objective: record verification and landlord approval, enforce the contract transition table and connect real staff actions without changing the established theme.
Required docs: API contract §4.6/5; schema property verifications/checks/approvals/history; PRD FR-PROP-05–07 and BR-01/02; Architecture §7/security; implementation plan BE-4.6/FE-4.14.
Dependencies: BE-4.2–5 locally implemented/in review. Draft workflow shapes are working assumptions; clarify additive version/capability fields in API v0.7.0 before integration. Existing models suffice; no migration planned.
Files: backend workflow schemas/repository/service/router/detail serialization, frontend live staff workflow forms/types, local API/browser tests and shared docs.
Acceptance: legal/illegal transitions, reason/admin guards, current approval matching exact price/description, complete verification checklist/evidence ownership, row-lock/version concurrency, server-owned allowed actions, status history/audit, real frontend save/complete/approve/publish/unpublish. No public browsing module in this task.
Tests: PostgreSQL role/CSRF/state-machine/guard/concurrency tests; lint/mypy/unit/build; local real-stack browser workflow with negative publish and edit invalidation. Guarded fictional data only; no Neon changes, deployment, emails, money or real user data.
Working assumptions: verification writes occur in review; approval can also be renewed while approved/unpublished; verification saves create a new current working snapshot preserving previous results; five required checks and no failed checks for passing, NA needs a note. Optional aggregate version on these pre-existing body shapes; frontend always supplies it. Transition version mandatory. Server returns capabilities and blockers. Publishing rechecks recorded completion/checks, current exact approval. Reopening preserves recorded evidence/approvals; approval/publication rechecks still apply. See decisions and contract clarification.


## Connected workflow

Staff/admin sign in → Properties → select a submission → Review and publishing → Start review → save verification checklist → complete verification → record landlord confirmation of the current price and description → Approve → Publish. The server supplies available actions and blockers. Reasons are collected for corrections, rejection, unpublishing and reopening; only admins can reopen. Completed actions refresh the actual record and version. Legacy staff verification/review URLs retain the selected property ID and open this workspace, rather than sample success screens. Client agreement/feedback presentation is unchanged.

Price or description edits invalidate landlord approval. Fresh confirmation can be recorded while approved or unpublished. Publish and republish independently recheck verification and current approval; bypassing the disabled UI still fails at the API. Changes are serialized with property row locks, optimistic versions, audit entries and status history in the same transaction.

## Validation — 2026-11-04

- Full backend: **326 passed**, two existing dependency deprecation warnings. Includes independent contract state-table/role matrix, required reasons, current approval matching, checklist/evidence validation, history, CSRF, missing records, OpenAPI request-body presence and concurrent version conflicts. Ruff and mypy pass (46 modules). No migration or dependency added.
- Frontend: **118 unit tests across 20 files passed**; lint, typecheck, production build and mock audit pass. Build uses the isolated local API origin; no remote service was exercised.
- Chrome real-stack regression: **13 affected browser checks passed**, then the corrected complete workflow journey **1/1 passed**. All 14 distinct checks have passing results. The initial workflow timeout came from an exact-label locator on a textarea; using its accessible textbox role fixed it. An intervening run was deliberately interrupted to apply that correction. The final journey covers verification, owner confirmation, approval, editing/invalidation, denied direct publish, renewed confirmation, publication, unpublication, archive and admin reopening. 360/1280 widths and serious/critical axe checks pass; desktop screenshot reviewed.
- Test setup: a cleared local PostgreSQL cluster was recreated; the initial attempt failed to connect and was stopped. A previous cross-property-evidence fixture duplicated a taxonomy row; it now clones the property while sharing its valid taxonomy. Browser fixture creation reuses active taxonomy so repeat runs remain safe. Tests hard-reject remote/non-test database URLs. No Neon data, real emails, cloud files or deployments changed.
- Review: server-owned permissions, strict scoped inputs, integer money, protected private evidence, fail-closed capability handling and atomic state/audit changes checked. No blocking findings in this scoped review. External PR review remains outstanding.

## Remaining work

BE-4.6 and the workflow portion of FE-4.14 are **In review**, not deployed. Next module: public live browsing/search/detail (BE-4.7) and its frontend connection. Landlord form connection and broader property hardening also remain. Publication currently records guarded database state; public file delivery/CDN integration is still pending. This does not mark the whole marketplace integrated.

Keep the owner's two reminders: **staff invitation email delivery** and **Cloudflare R2/private storage/direct uploads with deployed-host validation**. Neither is completed here.
