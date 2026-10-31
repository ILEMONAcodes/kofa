# UI copy and action hierarchy polish

Task: FE-1.4 — product copy and button hierarchy.
Objective: Remove design/mock commentary from user-facing screens and emphasize key actions with the original brown/inverse button treatment.
Owner: Joint (Developer 2, authorized frontend work). Branch: joint/FE-1.4-ui-copy-button-polish; based on merged main ae3f970.
Required docs: UI design system original tokens, action hierarchy, honest error feedback and accessibility; existing source-screen presentation handoffs. API contract unchanged.
Expected files: browse/auth/listing/client/workspace/shared presentation copy, CTA variants, route metadata, focused tests and handoff/progress docs.
Acceptance: no mock/design-preview commentary in visible UI; brown/light-text emphasis for main navigation and record actions, secondary/cancel/clear controls remain distinct; original theme/assets/radii; unavailable actions still report that nothing was submitted/saved; local file and draft-policy limitations stay honest; no backend or live-service claims.
Tests: copy/action helper tests, public journey and representative authentication/listing/workspace browser checks, responsive/axe, unit suite, lint, typecheck, build, mock audit.
Out of scope: connecting APIs, pretending unavailable operations succeeded, changing authorization/fees, publishing legal policy text as final, renaming route URLs or altering existing local next-env.d.ts.
Working assumptions: user's polish request overrides earlier visible design-reference labels; provenance/fictional-data context remains in repository handoffs rather than product screens. Actual unavailable-service feedback remains part of the UI.
Validation: complete; see results below.

## Implemented approach

Home browse/listing actions now default to the original primary brown with inverse text. Shared record/detail/inquiry actions receive the same emphasis through a small presentation-only helper. Back, Cancel, Clear, Remove and other secondary actions retain their existing styles. Footer actions use the existing accent/secondary tokens for contrast on brown surfaces; there are no new colours, fonts or assets.

Removed visible design/mock banners and implementation commentary across public browsing, auth, landlord forms, account, staff, administration, verification, media/help and responsive references. Cleaned metadata, accessible image descriptions, source fixture labels and navigation wording. Internal route URLs and source identifiers remain stable. Source fixture amounts, permissions, validation and API contracts are unchanged; this does not make integrations complete.

Unavailable operations use concise customer-facing errors explaining that nothing was sent, saved or changed. Their old links to example success/receipt pages were replaced with Help. Confirmation layouts remain independently accessible and are tested separately; failed operations never navigate to a success state. File selection remains local until upload, and policy pages retain their pending-finalisation status. Existing next-env.d.ts changes remain excluded.

## Validation results

- 96 unit tests passed in 16 files, including action hierarchy, unchanged fee amounts/conditions, source-copy checks and disabled-action handling. Lint, standalone typecheck, production build (205 static pages) and mock audit passed; no active TEMP-MOCK handlers.
- Full Chrome run: 85 passed, one landlord browser-history test failed because it invoked browser Back before the preceding client navigation had settled. Added an explicit route assertion before browser Back; application navigation logic was not changed.
- Final focused Chrome run: 36/36 passed across administration, detail, media/help, landlord and new UI-polish tests, after final phone/settings copy cleanup. Across the full and targeted runs, all 86 distinct checks have passing results.
- Product-copy checks cover public browsing, authentication, listing forms, client/staff/admin, media/help, verification/review and responsive references. Primary brown/inverse and secondary white/brown controls verified by computed styles. Responsive, keyboard, original asset geometry, representative axe, local file operations, no-mutation/error behavior and 12-property browsing regressions passed. Screenshots reviewed at mobile/desktop widths.
- An earlier partial run was stopped while replacing development-only outcome links with Help; its stale video-message assertion was updated to the new customer wording. No interrupted run is counted as a passing full suite.
- Source confirmation layouts remain independently tested; failed operations now offer Help without navigating to successful account/submission/publication states. Phone support remains disabled when no contact number is configured. Policy finalisation notices remain truthful.

Existing local next-env.d.ts edits were preserved and excluded. No backend, API contract, authorization rules, payment behavior, dependencies or assets changed. Next: separately scoped FE-4.11 / FE-3.5 / FE-4.10 service integrations when their backend contracts are ready.
