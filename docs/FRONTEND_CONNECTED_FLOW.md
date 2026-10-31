> Access setup superseded by [UNIFIED_REVIEW_SIGN_IN.md](UNIFIED_REVIEW_SIGN_IN.md): server-issued roles, no public staff links or role picker, private host configuration required. Historical results below describe the earlier browser-only flow.

# Connected frontend journey

Task: FE-3.6 — Connected navigation and temporary local access
Objective: Connect the existing frontend screens into clear client and staff journeys while retaining the original Figma theme.
Owner: Joint (Developer 2 explicitly authorized for frontend)
Branch: joint/FE-3.6-connected-frontend-flow
Required documentation: PRD §5.1, API_CONTRACT §4.2 and §5, frontend agent rules and local Next.js loading conventions.
Files expected to change: frontend UI, local access adapter/tests, this handoff, DECISIONS and PROGRESS.
Dependencies: presentation screens available; real authentication/backend not implemented.
Contract: v0.2.0 Draft unchanged. No endpoint emulation or real service calls.
Acceptance: whole-card navigation; three-second mobile entrance; branded loading fallbacks; navigable account and staff entry; role-specific local access and admin staff creation; no screen catalogues in product menus.
Tests: local access and URL unit tests; Playwright client/staff navigation, invalid passwords, role checks, sign-out, card clicks, loading and responsive accessibility; lint, typecheck, build, mock audit.
Out of scope: real authentication, backend authorization, real staff provisioning, real records, payments and legal consent.
Working assumptions: user approved six-character minimum for temporary local access only; existing admin role is the requested super administrator. Real password rules remain 10–128 characters. The original opt-in/local-only default is superseded by [deployed team review](DEPLOYED_REVIEW_ACCESS_FIX.md); keep review mode explicitly identified; never store entered passwords or treat browser roles as backend authorization. Build on preceding UI polish commit pending merge to preserve requested changes.

## Product route map

| Audience | Start | Next steps |
|---|---|---|
| Visitor | `/` → `/properties` | Tap anywhere on a card → `/properties/[slug]` → Express interest |
| Client | `/login` or `/register` | Return to selected property's `/account/inquiry?property=…`, or `/account/overview`; inquiries, inspections, transactions, complaints, notifications |
| Landlord | `/landlord` | Existing contact registration → property → pricing → features → photos/video and private evidence → review; no landlord account |
| Staff | PWA **Help → Staff & admin**, login **Staff & admin**, or footer **Staff sign in** → `/staff/login` | Staff role → `/staff/overview`; properties, landlords, inquiries, clients, inspections and calendar |
| Administrator | Same `/staff/login`, Administrator role | `/admin/administration`; **Users** → `/admin/users` to add/reactivate/deactivate local example team entries; staff operations remain accessible |
| Help | `/resources/help` | Verification, fees, help and policies; existing draft-policy limitations remain |

One staff sign-in on the same domain is recommended. Staff and administrators share entry and operational tools, while admin management uses `/admin/*`. A separate subdomain would add deployment complexity without replacing server authorization. The production role must ultimately come from `/auth/me`, never a role selector.

## Temporary access

For the current backend-free team review build, missing `NEXT_PUBLIC_LOCAL_ACCESS` enables review access on both localhost and deployed builds. `.env.example` shows true; set the flag explicitly to false and rebuild to disable it. Existing hosting settings of false must be changed to true (or removed) and redeployed. This supersedes the original local-only default; see [follow-up](DEPLOYED_REVIEW_ACCESS_FIX.md). Any example email and password of 6–128 characters can enter the sample frontend; registration checks confirmation. There is deliberately no credential matching or real identity assertion. No entered email, name, phone or password is stored or sent. Only the local role marker and explicit invented team labels are kept in sessionStorage, scoped to the tab. Sign-out clears both. Restricted storage falls back to in-memory navigation; persistence across reload is not promised there.

This does not implement FE-3.5/3.6/3.8 production authentication or provision real staff. No API tokens/cookies/requests, security boundary, emails, real account creation or legal consent are introduced. Recovery and service mutations stay unavailable. Existing real contract validation is retained when local access is disabled; the real password contract remains 10–128 characters. Do not enable local mode against private/live records.

## Presentation and compatibility

- Original brown/cream, typefaces and card content retained. Existing title links stretch over the card, with verification badges independently clickable and keyboard focus retained.
- First mobile entrance holds for 3 seconds, then fades for 350 ms. Reduced motion keeps the duration without movement. Subsequent navigation in the tab skips it.
- Shared logo/orbit loading indicator replaces route and Suspense text fallbacks, includes a screen-reader status and stops movement with reduced motion.
- Removed product screen catalogues and wizard skip links. Menus show relevant sections. Old client/staff/admin/media/review/verification URLs redirect to their canonical counterparts. Authentication and 360px reference routes remain isolated for design regression; no product directory links to them.
- Fixed app shells reserve 64px for the local-access status and sign-out controls. No source card images or backend files changed.

## Verification

- `npm --prefix frontend test`: **106/106**, 17 files, final run passed.
- Lint, standalone typecheck, production build (**373 static pages**, including legacy redirects), and mock-audit passed. No active TEMP-MOCK handlers; the opt-in local access adapter remains intentionally active in ignored local configuration.
- Full browser scan: **81/93 passed**, 12 failures investigated. Fixed the mobile sign-out overlap/race, selected-property back link, footer geometry and status landmark. Updated obsolete catalogue/URL assertions, scoped a status assertion, and treated workspace tests as an already-launched session.
- Affected browser rerun: **36/37 passed**; its only failure was a transient entrance test allowing real time to advance during page load. No product change for this test fix: pause the test clock before navigation and isolate entrance animation from wall time.
- Final new journey suite: **7/7 passed**, including all-card taps at mobile/desktop, 5-character rejection/6-character acceptance, no credential requests/persistence, saved property return paths, role-specific local navigation, admin add/deactivate/reload, sign-out, entrance timing, reduced-motion loader, and responsive axe checks.
- All **93 distinct browser cases** have passing results across the full and affected/final runs; this is not a claim of a fresh single-run 93/93 result.
- Screenshots inspected: `/tmp/kofa-connected-account-overview-360.png` and `/tmp/kofa-connected-admin-users-1280.png`; original brown/cream and mobile shell retained. Browser checks cover 360/768/1280 layouts, plus existing catalogue and source screens.
- Fresh diff review: no backend/contract/credential changes, no new dependencies or real mutations. Existing `frontend/next-env.d.ts` edit restored and excluded; `.env.local` is ignored and excluded.

Status: In review (frontend presentation/local walkthrough). Real auth, server authorization, staff provisioning and service integration remain separate FE-3.5/3.6/3.8 + J-3.7 work after BE-3.2/3.3/3.4 and contract readiness. No production feature acceptance is claimed.
