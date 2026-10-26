# Kof’a complete design flows

2026-10-26 · FE-1.4 design slice · In review · Developer 2, explicitly authorized shared UI/UX work.

## Task brief

Fix overlapping desktop/mobile frames, complete authentication and landlord submission designs, and connect their journeys while retaining the brown/cream identity and app-like mobile navigation. Branch: `joint/FE-1.4-complete-design-flows`. Assumes ADR-001/007 (landlords are contact records), ADR-003 authentication and API_CONTRACT v0.2.0 Draft §§4.1, 4.4–4.6. Developer confirmed contact registration within listing, with no landlord account. No profile-picture requirement.

Acceptance: distinct canvas sections, complete scoped desktop/mobile screens, connected forward/back/edit paths, consistent editable components, structural and screenshot review. No application implementation or contract change.

## Design handoff

[Open Figma](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a).

| Section | Node | Contents |
|---|---|---|
| Browse desktop | 43:978 | Home, search, detail |
| Browse mobile | 43:979 | Home, search, detail, filters |
| Authentication desktop | 43:980 | Nine screens |
| Authentication mobile | 43:981 | Nine screens |
| List property desktop | 43:982 | Six steps, receipt, verification explanation |
| List property mobile | 43:983 | Six steps, receipt, verification explanation |
| Operations and feedback | 43:984 | Six review/publication/feedback screens |
| Archived layouts | 43:985 | Five historical frames, outside current flows |

There are 47 current screens. Sections are packed from actual frame dimensions with separate desktop/mobile columns, avoiding the previous fixed-row overlap. Long mobile forms scroll inside 390 × 844 viewports with persistent actions. Account retains app navigation. No profile photographs or avatar upload fields are required.

Authentication covers login, registration/consent, verification email sent, verified, forgotten password, reset email sent, reset password, reset success and signed-in account. Verification uses email links. Reset confirmation is generic; reset links are single-use and expire after one hour. Error patterns include invalid credentials, throttling and expired links.

Landlord submission: Contact registration → Property → Pricing → Features → Photos/documents → Review/consent → Submitted receipt → Verification explanation. Review provides edit links. Contact details, exact address and ownership documents remain private. Submission is pending review, not publication. Staff review proceeds through passed checks, verification and recorded owner approval, readiness, then publication. Verification copy does not promise legal title assurance.

Nine named prototype starts cover desktop/mobile browse, authentication, reset-link entry, listing, and staff publication. These are static prototypes with fictional sample data, not working authentication, uploads or email delivery.

New reusable components: Consent `44:1196`; multiline Textarea `64:2540`. Existing button, field, badge, property-card, logo and app-navigation components remain in use. Guide: `18:532`; foundations: page `12:2`.

## Validation and limits

- Structural audit of 47 screens: zero section/frame collisions, zero unexpected auto-layout overflow and zero missing reaction targets.
- 11/11 exact prototype path checks passed: desktop/mobile signup, forgotten-password confirmation, reset completion, full listing, review edit, and staff publication.
- Reviewed rendered overviews of all seven active sections, ten representative full screens and four corrected renders. Intentional mobile scroll clipping is preserved.
- No presentation-mode click-through, application/API/unit/E2E, keyboard, screen-reader or axe tests were run. Existing colours were retained; contrast calculations from the preceding brand revision were not repeated.

Contract remains 0.2.0 Draft. Server-side per-step draft saving lacks a PATCH contract; these designs make no autosave promise. The proposed staff `allowed_actions` gap remains for J-4.1. Legal copy is provisional. FE-1.4 as a whole remains unfinished pending full inventory, implementation and accessibility acceptance; FE-3.5 and FE-4.10 are not marked implemented.

Next: frontend review of these design flows and FE-1.4 inventory; J-1.3/J-4.1 contract reconciliation before application integration.

Figma session: `ee772207-1546-4360-b0a6-53497131ab7c`. Temporary scripts, screenshots, flow maps and audit evidence: `/tmp/kofa-design/`. Durable section/component identifiers are recorded above.
