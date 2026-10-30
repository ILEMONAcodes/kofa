# Administration and support mobile — Figma 80:2309

Task: FE-6.16 — administration/support presentation extension
Objective: Implement all 50 source views using the existing mobile workspace renderer, original tokens and shared controls, with connected preview navigation.
Owner: Joint, Developer 2 continuing authorized frontend work.
Branch: joint/FE-6.16-mobile-administration-support (from merged origin/main ccd566a).
Required documentation: IMPLEMENTATION_PLAN FE-3.8, FE-6.10/6.16/6.24/6.33; API_CONTRACT §4.7–4.9; PRD transactions/complaints/administration/AI; UI_DESIGN_SYSTEM mobile tokens and accessibility; ARCHITECTURE frontend/mock policy.
Files expected: source registry/model, existing staff renderer extension, administration preview route, admin/staff preview entry links, scoped styles if needed, focused tests and handoff/progress/assumptions notes.
Dependencies: merged client and staff preview shells. Real authentication, allowed actions, transactions, complaints, support and reporting integrations are separate tasks.
Contract: unchanged 0.2.0 Draft. No endpoint mocks, API payloads, permission decisions, fee computations, live records, evidence access, exports, invitations, permanent actions, publication or real support/AI calls.
Acceptance: all 50 source views retain content and original theme, numbered directory, editable fields/dropdowns/Other, connected source flows and prior staff links, explicit unavailable-service feedback with separately labelled example results; no false successful operations.
Tests: all-route render/overflow and SVG geometry checks, navigation/form/Other/confirmation flows, money input presentation, no outbound service mutations, representative axe and 360/768/1280 review widths; existing staff regression, unit tests/lint/typecheck/build/mock audit.
Out of scope: backend, authorization/session implementation, service state machines, fee/ledger arithmetic, public policy publication, real user data, AI providers, real payments and operational settings changes.
Working assumption: continue the existing explicitly fictional UI-preview approach. Source fee defaults are illustrative, not an adopted fee rule. Source support settings are examples, not final configuration or a real call line. Native form checks are presentation-only; service forms and server validation remain integration work.

Implementation notes

- Entry: `/administration-preview/administration`; the 50 source screens are numbered in the shared workspace menu. `/admin` links to both Staff and Administration previews. Footer Overview/Properties/Inquiries continue to open the existing staff views; the source workspace-menu frame links between both sections.
- Extended the existing staff renderer with an administration mode instead of duplicating its UI. Shared Button/Input/Dropdown/Modal controls and original brown/cream/DM Sans tokens remain in use. Administration search placeholders use the source ink token; report lines preserve intentional whitespace.
- Prior staff **View reports**, **Review concerns**, **Create transaction** and client-record transaction links now reach the corresponding administration examples. Record destinations, confirmation states and example outcomes are centrally listed in the new model.
- All 250 exported SVGs were downloaded and matched existing assets by exact file hash. No new raster images or document contents are supplied in this section, and no temporary Figma asset URLs appear in runtime code. Source body paragraphs were compared across all 50 frames with no content mismatch.
- Grouped directory controls are collected recursively for local sample filtering. Other preferences display a required text field. Monetary inputs use the existing integer-kobo parser for presentation validation; there is no fee, percentage, ledger, revenue or quote calculation.
- Backend operations show **Service not connected**; example outcomes are separate links. Payments, reversals, fee rules, case actions, user access, article publication, exports and support settings never change a real record or send a service request. No invitations/emails, file exports, evidence fetches, phone calls or AI requests are made.
- Source fee-rule numbers and report KPIs are static examples. Support contact details remain explicitly unconfigured. Article text is fictional preview content, not a published policy or live assistant source. Actual identities, `allowed_actions`, privacy checks, configuration validation and services belong to later integration tasks.
- Source-copy follow-up: the complaints queue uses “Search inquiries” and “Inquiry status” labels in Figma. These were preserved rather than silently rewriting the design.

Validation — 2026-10-30

- `npm run test -- --run`: 76 tests passed across 10 files, including source/control identities, navigation targets, required/optional money parsing and grouped-filter discovery.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. All 50 administration routes are statically generated; total frontend static generation reached 136 pages.
- Chrome administration suite: 12/12 passed in the final run. All 50 headings, source paragraphs, scroll widths and header/navigation SVG geometry checked at 390×844; flows cover cross-section menu links, filters/Other, money errors, complaint review, invitations/settings and guarded example confirmations. No service POST/PATCH/DELETE requests occurred in the instrumented mutation checks.
- Existing staff regression: 10/10 passed in the combined run. That run also found two administration defects (nested filters and intentional report whitespace); both were fixed and the entire administration suite then passed. The fixes are scoped to administration mode.
- Responsive checks passed at 360/768/1280; representative axe checks found no serious/critical violations in Create transaction, Investigation, Invite user, Edit article and Support settings. This is scoped coverage rather than a full accessibility certification.
- Rendered Transactions, Transaction detail, Complaint detail, Administration, Users, Reports, Knowledge and Support settings screenshots were inspected against their source frames. Full pixel-by-pixel verification of every frame remains a design-review follow-up.
- Source inventories compared across all 50 frames: paragraph contents, visible InputField labels/defaults and Button counts all matched. All 250 source SVG exports matched existing local files by hash. Mock audit found no active handlers.
- Next integration work remains module-specific: FE-6.10 transactions, FE-6.16 complaints, FE-3.8 users, FE-6.24 reporting and FE-6.33 support/content. No service integration is claimed complete.

Final review correction: the receipt input now uses the source date `26 Oct 2026 · 09:00 WAT`, independently of the staff landlord-response form's `27 Oct` default. The added receipt-date/confirmation browser check passed (1/1), bringing administration coverage to 13 distinct passing checks across the full suite and focused review rerun. Production build passed again after this correction. No other staff date defaults changed.
