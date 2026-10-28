# Full PRD frontend design coverage

## Task brief

Task: FE-1.4 remaining frontend design inventory. Objective: design all remaining in-scope PRD frontend experiences in Figma, including photos/video, client journeys, staff/admin operations and shared states. Owner: Joint, Developer 2 explicitly authorized by the developer. Branch: `joint/FE-1.4-full-prd-designs`.

Sources: PRD §§3–8, UI_DESIGN_SYSTEM, API_CONTRACT 0.2.0 Draft §§4–6, existing Figma foundations and 47-screen handoff. Assumes ADR-001/003/007/014 and OQ-03/04/11/13/18/24 defaults. Later-module shapes are conceptual design only, not API mocks or implementation. No actual call number, personal data, money, final legal copy or provider requests.

Files: this handoff, DECISIONS, PROGRESS, UI_DESIGN_SYSTEM; Figma existing file. Dependencies: existing foundations available; backend and application implementation remain separate tasks. Acceptance: PRD coverage matrix; responsive editable screens; reusable components/tokens; connected key flows; no canvas collisions; structural and rendered visual review. Tests: Figma geometry, text/component hierarchy and reaction graph checks; screenshots; git whitespace check. Out of scope: application/backend code and deferred product features. Risks: draft contracts and policy/support configuration require later integration/review.

Status: Design coverage complete; in review. Application implementation remains separate.

## Deliverables

[Open the current Figma index](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=105-17085).

401 product screens/state variants, plus 21 responsive reference frames: **422 current frames audited**, excluding five archived frames and the handoff guide. This revision adds 354 product frames and 21 responsive references to the preceding 47-screen slice. Counts include confirmation/error/lifecycle variants, not 401 distinct routes.

All current product frames share page `0:1` (Complete product flows), because Figma NAVIGATE reactions require the same page. Desktop and mobile are in separate Sections packed from actual bounds. There are 23 Sections including the archive and responsive references. The Start here page links directly to each chapter. Foundations remain on page `12:2`.

Mobile retains 390 × 844 app-style viewports, scrollable content and persistent navigation; listing media keeps fixed review/back actions. Staff mobile uses Overview / Properties / Inquiries / Menu, without profile pictures. Seven representative templates also have 360, 768 and 1280 px references: inquiry form, inquiry list, conversation, dashboard, property queue, media and investigation. These references illustrate layout rules; every individual screen was not separately rendered at every breakpoint.

## PRD coverage

| PRD | Frontend design coverage | Representative frame keys in inventory |
|---|---|---|
| FR-HOME-01 | Discovery homepage, search/list/contact entry points, help launcher | Existing Home; speak; assistant |
| FR-AUTH-01–04, 07 | Registration/consent, login/logout, verification, reset, expiry and throttling states | Existing auth; logout; verification-expired; reset-expired; rate-limit |
| FR-AUTH-05/06/08 | Staff creation/invitation, role/access states, edit/deactivate confirmation; session/permission states | users; user-create; email-invite; user-deactivate; access-denied; session-expired |
| FR-PROP-01/02 | Six-step contact registration/listing, photos, video, private evidence, review and receipt | Existing listing; uploads; upload-progress; upload-ready; upload-failed; upload-invalid |
| FR-PROP-03/04 | Queue/filter/assignment, listing edit, change request and staff-recorded landlord response | property-queue; property-assign; property-edit; request-changes; landlord-response |
| FR-PROP-05–07 | Six checks, scope/method/evidence, current owner approval, guarded publication, reject/unpublish/archive/reopen | staff-verification; owner-approval; publication-ready; publication-confirm; property-transition; property-reject; property-archive; property-reopen |
| FR-PROP-08/13 | Last-confirmed availability, stale review, status history | availability; availability-saved; staff-property; property-transition-done |
| FR-PROP-09–12/14 | Search/filter/sort/pagination and detail, gallery/video, fees/terms, verification scope, availability; public privacy | Existing search/detail/filter; gallery; gallery-next; video-playing; search-empty. Slugs/SEO metadata remain implementation requirements, not new editable SEO settings. |
| FR-INQ-01–08 | Interest/inspection and general forms, receipt, own inquiry list/thread, async refresh/send; staff pipeline, qualification, separate internal notes | interest; speak; inquiry-sent; inquiries; thread; message-sent; pipeline; staff-inquiry; qualification |
| FR-APPT-01–06 | Client list/detail/confirm/cancel/reschedule and address privacy; staff scheduling/conflict/outcome; calendar; fee-condition example | appointments; appointment; appointment-confirmed; reschedule; cancel-appointment; appointment-create; appointment-conflict; appointment-outcome; calendar; appointment-fee |
| FR-TXN-01–05 | Transaction creation, terms timeline, backend quote disclosure, client own summary, manual ledger/reversal, completion/cancellation | transaction-create; staff-transaction; transaction-event; fee-quote-ready; transaction-active; ledger; payment-record; payment-reversal; transaction-complete; transaction-cancel |
| FR-CMP-01–09 | Minimal public report/client complaint forms/evidence, duplicate/reference states; own status/public notes; staff triage/investigation/hold/resolve/dismiss/admin permanent action/reopen | report; report-receipt; report-duplicate; complaint-new; complaint; case-queue; case; investigation; case-hold; case-resolve; case-dismiss; case-permanent; case-reopen |
| FR-CMP-10 | Counts never cause automatic actions; priority-only rule retained in investigation copy | case-hold; case-held; reporting |
| FR-ADM-01–04 | Operations home, landlord/client directories, staff/user tools, optional audit viewer | dashboard; landlords; landlord; clients; client-record; users; audit |
| FR-NTF-01/02 | Key-event email templates, invitation/verification/reset emails, optional notification centre and read state | email-*; notifications; notification-detail |
| FR-RPT-01/02 | Date-filtered KPI report with PRD definitions; optional CSV export state | reports; export-ready |
| FR-POL-01/02 | Six draft policy/help pages; registration/submission consent retained | terms; privacy; fees; verification; refunds; reporting; help; existing consent |
| FR-AI-01–09 | Disclosed assistant, sourced answer, feedback, human handoff/outage/limit paths; call control, hours, message/report actions; knowledge drafting/admin publication, transcript review and support settings | assistant; assistant-answer; assistant-handoff; assistant-unavailable; assistant-feedback; knowledge; article-edit; article-publish; ai-review; ai-conversation; settings |
| NFR-02/04/09/13 | Responsive templates, focus/error/disabled patterns, safe failures, offline/error/empty/loading states, NGN and WAT examples | Responsive section; focus-states; network-error; server-error; form-error; conflict; search-loading; staff-loading; staff-empty |

Backend-only obligations such as session rotation, persistence, authorization and SEO rendering are represented by relevant UI states or handoff rules; they are not claimed implemented or tested by these designs.

## Media experience

- Photos: 5–20 required, JPEG/PNG/WebP, up to 10 MB each; thumbnails, caption/order/cover controls, preview and remove confirmation.
- Video: optional one MP4/WebM up to 100 MB; choose/replace, progress, retry, invalid-file state, preview and remove. No invented duration limit or transcoding promise.
- Private evidence: at least one ownership/authorisation document; maximum 10 PDF/JPEG/PNG files up to 10 MB each. Staff document preview and expired-access recovery are separate from public media.
- Report/complaint evidence: optional maximum three JPEG/PNG/PDF files up to 5 MB each, private.
- Public gallery has photo/video navigation and tap-to-play control design. Actual playback/upload is not implemented. Existing listing upload and review frames now link to media management and include video information.

Cover/order/caption controls follow the previous visual concept and staff media management. Public submission cover/order persistence still needs reconciliation in J-4.1; no API contract was silently extended.

## Guardrails and working assumptions

Landlords remain contact records, with no landlord login/dashboard. Staff record responses and current price/description approval. Changed advertised price/description requires fresh approval. Client exact-address disclosure appears only on the confirmed appointment example. Private contacts/evidence and internal inquiry notes remain in staff screens. Complaint findings/outcome/evidence are excluded from client case screens; permanent actions are admin-only after supported investigation. Ledger corrections use reversing entries.

Fees are illustrative backend-returned quotes using the OQ-03 working default, not final pricing or frontend calculations. OQ-04's fee-disabled default is retained, with a separate enabled-fee design example. Six policy pages have explicit legal-review placeholders. No final legal copy is published. Company call line/hours remain unconfigured: visible Call controls are disabled until approved details are supplied. AI failure/limit paths retain message/report alternatives. No live AI, email, upload, funds or personal data were used.

Optional Could-tier designs (notification centre, audit viewer, CSV export and answer feedback) are included without changing MVP priority. Calendar is designed regardless of the PRD's §5 Should / §6 Could wording; that priority discrepancy does not change this visual coverage. All Won’t exclusions remain: native app, landlord dashboard, favourites, real-time chat/attachments, gateway/escrow, subscriptions/sponsored listings, SMS/WhatsApp, voice/languages and land/commercial listing modules.

Contracts remain v0.2.0 Draft. Later-module request/response shapes must be frozen before API mocks/application implementation. Outstanding per-step draft-save and staff allowed-actions contract gaps remain with J-4.1. No application feature task is marked implemented.

## Actual validation

- 422 frames: zero Section overlaps, frame overlaps, unexpected auto-layout overflow or missing navigation destinations in the final audit.
- 50/50 exact prototype journey chains passed, including original signup/reset/listing and expanded client, media, inspection, transaction, investigation and admin flows.
- All 350 unique reaction destinations resolved, including component state destinations; component CHANGE_TO reactions were not confused with screen navigation.
- Native layer audit: 8,920 text layers and 5,051 component instances; fonts DM Sans and Instrument Serif. Discrete illustrative property photos are reused; full UI screenshots are not embedded as screens.
- Visual review: initial account mobile plus four early layouts; 19 representative final renders, four corrected renders, and final guide/KPI/recovery renders. Narrow status-bar overflow, staff menu truncation/navigation and email app chrome were corrected. Long mobile content intentionally scrolls behind the fixed viewport boundary.
- Recomputed 13 selected text contrast pairs: 13/13 ≥4.5:1; input-border pair 4.39:1 ≥3:1. This is not a complete accessibility certification.
- `git diff --check` run for the handoff.

No presentation-mode click-through, real form interaction, app/API/unit/E2E, keyboard/screen-reader/axe, live media playback, email delivery or device-browser tests were run. Figma prototypes describe visual/flow intent and cannot prove runtime permissions, accessibility or backend behavior.

## Handoff

[Screen inventory](FIGMA_SCREEN_INVENTORY.md) contains every newly designed product screen/state pair, with desktop and mobile links, plus responsive references. Existing 47 frames are documented in [the preceding flow handoff](FIGMA_COMPLETE_FLOWS.md).

Next: Developer 1 reviews the design inventory and implements modules through the existing frontend tasks; reconcile/freeze J-1.3, J-4.1, J-5.1 and the relevant Phase 6 contracts before integration. Full FE-1.4 acceptance remains a team review; application tasks and runtime accessibility acceptance remain outstanding.

Figma session: `a13922b2-431b-4460-a32d-1b2fb1aa02dc`. Guide `105:17085`; StaffAppNavigation `84:2518`. Temporary construction scripts, renders and audit evidence: `/tmp/kofa-design/full-prd/`. Durable links are in the inventory.

## Presentation correction — 2026-10-27

Task brief: FE-1.4 canvas presentation only; Developer 2 requested restoration of the original brown backing, matching mobile edges and clear workspace order. Branch: `joint/FE-1.4-canvas-presentation`. Reuse the original authentication Section appearance and mobile shell. Screen content, contact flow, node IDs and prototype actions are preserved; no contract or application changes.

All 23 Sections now use the original dark-brown canvas backing/border. Mobile shells match the original 32 px clipped corners; their cream UI colours are retained. The background contrast makes each frame boundary visible. Sections are ordered 01–22, with archive 99; frame names use chapter/sequence prefixes such as `07.01`. Sidebar stacking, row-major frame order, canvas chapter positions and the Start here index now agree. Pages are ordered Start here → Foundations → Complete product flows.

Validation: all 427 frames including five archives checked; zero Section/frame overlaps, numbering mismatches, mobile-edge mismatches or backing mismatches. Sidebar numbers increase in order. Product text and prototype-action snapshot digest is unchanged (`4af94ecd` before/after); no screen content/contact fields were edited. Desktop/mobile client Section renders and mobile recovery Section render visually reviewed. No application tests were needed for these presentation-only changes.

## Reference layout correction — 2026-10-27

Task brief: add the missing mobile counterpart for the original verification/feedback references; separate mixed responsive widths into Mobile 360, Tablet 768 and Desktop 1280 chapters; remove Section 99 and its five archived frames as explicitly requested. Owner: Developer 2, authorized shared Figma design work. Branch: `joint/FE-1.4-reference-layouts`. Preserve relevant content, current frame IDs and prototype links. Use existing editable components and brown canvas backing. No API/application changes. Validation: width/numbering/geometry audit, prototype paths, retained-content comparison and rendered Section review.

Completed layout: **21 Desktop references / 22 Mobile references**, with six corresponding screens in each. The mixed reference collection is now **23 Mobile (360 × 844), 24 Tablet (768 × 1024), 25 Desktop (1280 px wide)**. All 21 existing responsive reference frames retain their IDs/content, grouped by actual width. Tablet navigation spans the device width; narrow mobile navigation fits inside its shell. Section 99 and all five archived frames were deleted; the archive index link was removed. The index/sidebar now run continuously from 01–25.

Current totals supersede earlier counts: **407 product/state frames + 21 responsive references = 428 frames across 25 Sections**, with no archives. Audit: zero Section/frame overlaps, unexpected overflow or missing reaction targets; new mobile review → passed → owner approval → ready → published path passed all four transitions. Four Section renders and the corrected tablet frame visually reviewed. Existing desktop reference content is retained; mobile adapts the same relevant information into scrollable app layouts. No application/runtime tests were run.

Current reference links: [21 Desktop](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=43-984), [22 Mobile](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=117-17185), [23 Mobile responsive](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=94-15534), [24 Tablet](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=119-17570), [25 Desktop responsive](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=119-17571).

## Filter/control correction — 2026-10-28

[Current control handoff](FIGMA_FILTER_CONTROLS.md): no bathroom search filter; dropdown choices and conditional Other entry; ₦100,000 budget steps. Chapters 26/27 contain desktop/mobile control overlays and examples, retaining the original visual identity. Current total is 547 frames including 119 control-overlay/example frames; product/reference inventory remains 428 frames. The PRD override is recorded in DECISIONS; API shapes remain unchanged.
