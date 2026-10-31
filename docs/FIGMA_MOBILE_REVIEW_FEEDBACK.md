# Mobile verification and feedback references

Task: FE-4.14 — Figma 117:17185 presentation
Objective: Build the six 390 px source frames, preserving the original theme and linking to existing verification, publication and recovery examples.
Owner: Joint (Developer 2, authorized frontend work). Branch: joint/FE-4.14-mobile-review-feedback.
Required docs: implementation plan FE-4.14/FE-3.5; UI design system original tokens/mobile forms; API contract property checks/owner approval/transitions and authentication recovery behavior.
Expected files: reference model/screens/routes, shared mobile renderer, navigation entries, focused tests, decisions/progress and this handoff.
Dependencies: shared renderer from the pushed media/help and verification branches; retained in this branch until merged.
Contract: unchanged; no real requests or endpoint mocks.
Acceptance criteria: all six source screens and exact local assets; editable check/method/approval controls, hints and description-approval checkbox; explicit unavailable-service actions and separate source sample outcomes; correct staff versus consumer navigation; working recovery links; representative 360/768/1280 and keyboard/a11y checks.
Tests: unit/model tests, Playwright source contents/assets/controls/navigation/no-mutations/a11y, existing verification/media renderer regressions; lint/typecheck/build/mock audit.
Out of scope: real staff/private records, signed documents, state transitions, authentication, legal approval or financial processing.
Working assumptions: source private-looking data is fictional, and sample outcomes do not represent submitted values. Backend controls verification, permission and publication guards; Other preferences remain local inputs, not API enum additions.

Implementation:

- Six source-ordered routes: `/review-feedback-preview/staff-review`, `feedback`, `verification-passed`, `landlord-approval`, `publication-review`, `published`.
- Reuses the shared mobile renderer, original brown/cream tokens/DM Sans, common Button/Input/Dropdown/PopoverSelect/Modal, existing consent styles/checkmark and timeline geometry. Shared screen selection now uses a single section discriminator, preserving the existing media/help and verification routes.
- Downloaded all 33 exported SVG/photo assets; exact hashes matched existing local assets. No temporary Figma URLs, duplicate images or new dependencies. Verified 350×220 photo slots, 101.15×32.7833 logo and four 22×22 footer SVGs on all six routes.
- Retains the source's distinct Pending/Pass reference values, private-looking fictional owner/address callouts, document guidance, approval validity text and publication summary. The staff states have workspace navigation; the feedback reference has consumer Back/navigation with no extra Help button.
- Check/method/period selectors include Other text. The source's long approval method uses the existing accessible PopoverSelect with a 72 px wrapped trigger, retaining the 104 px total field height. Owner approval includes editable price, source date/time `2026-10-26T10:30`, required note and required unchecked description-approval checkbox. Native date formatting follows browser locale; no timestamp conversion is implied.
- Approved price is validated only for presentation through the existing integer-kobo `parseMoneyInput`; no fees, quote decisions, approval validity or publication guards are calculated. Save/complete/publish actions display an unavailable-service dialog; a separate source-example link is explicitly unrelated to entered values.
- Ownership proof opens the existing fictional staff document preview. Recovery buttons link to existing search, loading, login, verification-email and password-reset screens. Retry-After/countdown/email-preservation text remains implementation guidance, not simulated server behavior. No actual documents, resets, verification emails or publication occur.
- Workspace menu provides a “Review & recovery references” entry; the help screen links to the feedback reference. The numbered directory preserves all six source positions.

Validation:

- Unit suite: 88 passed in 13 files (`npm --prefix frontend test`). Includes source action/asset checks, distinct Pending/Pass data, description consent and money parsing boundaries.
- Build/typecheck/lint/mock audit passed; 189 static pages generated, including all six new routes; no active TEMP-MOCK handlers.
- Initial combined Chrome run: 21 passed, 1 failed. Existing media/help 11/11 and verification 6/6 passed. New approval test first had an ambiguous Other selector, then an ambiguous alert selector that included Next.js's route announcer. Selectors were scoped to the intended listbox/form; production behavior was not changed to satisfy these tests.
- Final fresh reference suite: 5/5 passed. Together with the unchanged 17 shared renderer checks, 22 distinct browser checks passed across the runs. Source headings/body text and static asset geometry/loading checked across all six frames; native fields, Other, wrapped selector, description checkbox, money validation, explicit outcomes, zero mutations, recovery/document links, six-item menu, Escape focus restoration, representative axe and 360/768/1280 widths verified.
- Rendered screenshots reviewed against the section source. OS status indicators remain replaced by the established sample-preview label; native date/dropdown behavior and appended directory/service notices are intentional presentation adaptations.

Contract unchanged; no backend edits, real private records, endpoints, permissions or state-transition decisions. Existing service integration tasks remain pending.

Next: FE-4.14 contract-backed review/verification/approval/publication integration; FE-3.5 real server error/recovery behavior as a separate task.
