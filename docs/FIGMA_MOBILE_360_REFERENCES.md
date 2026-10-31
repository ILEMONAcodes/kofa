# Mobile responsive references — 360 px

Task: FE-4.14 — Figma 94:15534 presentation
Objective: Implement all seven 360 px reference screens using existing original-theme controls and flow links.
Owner: Joint (Developer 2, authorized frontend work). Branch: joint/FE-4.14-mobile-360-references.
Required docs: implementation plan FE-5.7/FE-4.14/FE-6.16; UI design system mobile forms; API contract inquiry budgets/messages, property queue, complaint findings/outcome/actions and upload limits.
Expected files: responsive-reference model/screens/routes, shared renderer, existing navigation entries, focused tests, progress/decisions and this handoff.
Dependencies: existing client/staff/administration/media/review presentation and shared controls; preceding pushed branch retained until merged.
Contract: unchanged; no live records, requests or endpoint mocks.
Acceptance criteria: all seven source states at 360 px, correct source assets/geometry and header/footer variants, budget steps/validation/Other controls, source list filters, message form, media management and investigation form; explicit unavailable services and separately labelled source outcomes; no authorization/visibility/fee decisions in the UI; representative keyboard/axe and 360/390/768/1280 checks.
Tests: unit/model tests, focused Playwright contents/assets/budgets/filters/media/forms/links/no-mutations/a11y, shared-renderer regressions; lint/typecheck/build/mock audit.
Out of scope: actual inquiries, message polling, private files, complaints resolution, live data, publication or backend decisions.
Working assumptions: OQ-13 source upload limits; all example data is fictional, example outcomes are independent of entered values and Other preferences remain local inputs.

Validation: complete; see results below.

## Implementation

Entry: `/responsive-preview/inquiry`; the numbered seven-screen directory is available on every screen and linked from the shared help centre. Routes: inquiry, inquiries, conversation, overview, properties, media and investigation. Existing client/staff/admin destinations are reused for related sample flows.

Source: Figma `94:15534`, child frames `94:15727`, `94:15830`, `94:15924`, `94:16008`, `94:16127`, `94:16254`, `94:16411`. All seven detailed contexts and the section screenshot were inspected. All 39 exported assets matched existing local assets byte-for-byte; no new assets or theme colours were needed. Original DM Sans, brown/cream tokens, 124 px header, 20 px body gutters, 84 px bottom navigation, 120 px Back/Menu button and source radii are retained. At 360 px, the three photo slots are 101.333 × 110 px; the poster is 288 × 180 px. OS status-bar artwork is replaced with the existing explicit design-preview label.

Budgets use the shared integer-kobo formatter and ₦100,000 steppers; reversed/invalid ranges block the local action. Dropdowns include Other inputs. Sample queue filters can be cleared. Refresh messages announces a local sample refresh without polling. Investigation findings/evidence are required, while the public note stays optional. Service actions never claim success; separate example outcomes link to existing sample screens.

Media uses the existing in-memory picker and limits. Caption/order/cover, selected-photo preview/removal and video selection stay local. The 360 px source retains bottom navigation rather than the older media screen's fixed listing-action bar. Source file-status cards are illustrative and labelled as such; actual local selections are managed separately. Permanent complaint actions, permissions, real evidence storage and server validation are outside this task.

## Validation results

- 90 unit tests passed across 14 files.
- Typecheck, lint, mock audit and production build passed (196 static pages). No active TEMP-MOCK handlers.
- Final Chrome run: 26/26 passed (4 new reference tests and 22 existing media/help, verification and review regressions). An earlier 25/25 run passed before final spacing/dialog corrections and the added photo-dialog test.
- All seven reference screens checked at 360/390/768/1280 px; axe passed on all seven at 360 px. Source photo/poster dimensions and loaded assets, 120 px header controls, navigation, required forms, budgets/Other, local queue filters, refresh/no mutations and single-dialog photo removal passed.
- Screenshots reviewed against the Figma section; the final currency-symbol spacing is corrected. No backend integration is marked complete.
