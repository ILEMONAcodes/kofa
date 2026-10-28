# FE-4.12 — Desktop property detail from Figma 14:221

## Task brief

Owner: Developer 2 with existing explicit frontend authorization. Branch: `joint/FE-4.12-desktop-detail`, stacked on home/search commits. Objective: reproduce 14:221, connect all existing illustrative cards to their matching detail and preserve search preferences on return.

Docs: ORCHESTRATOR §4/§9; frontend specialist; IMPLEMENTATION_PLAN FE-4.12; UI_DESIGN_SYSTEM §5/§8/§9; API_CONTRACT 0.2.0 Draft §4.5; Next bundled dynamic-route/page guides. Dependency FE-4.11 has desktop design/URL support; live API remains pending. Assumes current Figma public content and draft PropertyDetail contract. No contract change or endpoint mock.

Files: detail route and browse components, gallery/actions, shared navigation configuration, source manifest/CSS, navigation helper/tests, scoped browser tests and docs. Acceptance: 1440×2523 reference, exact three-photo slots, public facts/verification/fees/availability, source actions, matching links from home/search and safe return URL, keyboard-operable gallery/relevant report-reason dropdown. Unknown preview slugs return 404 through generateStaticParams/dynamicParams=false (the root loading boundary otherwise streams a 200 before notFound). This allowlist is limited to design-preview records, not real publication gating. Metadata marks fictional preview noindex. Validation: lint/tsc/Vitest/build/mock audit, focused Playwright geometry/assets/a11y/gallery/navigation checks.

Out of scope: actual authentication, report submission/evidence upload, AI service, real inventory, legal publication and mobile Figma implementation. Express interest follows the source login target and retains a local return URL; it does not create an inquiry. Related gallery/support actions are contextual dialogs within this detail slice, not completed FE-6 modules. Report submission and assistant calls remain explicitly unavailable; no real data collected/sent/persisted. Full FE-4.12 acceptance, structured data and publication guards require the real backend.

## Source relationships

Main node 14:221 → gallery 82:3590, report 82:4046, assistant 82:4650, login 34:950. Main detail has no filter dropdown. Source gallery uses Photos/Video walkthrough buttons; report uses Reason dropdown (desktop options 169:18757). Reuse local Button, Modal and PopoverSelect instead of absent `primitives` Code Connect imports. Dialogs adapt source content while preserving the exact closed detail screen; no fabricated walkthrough video or submission success.

All five main-node exports independently downloaded and SHA256 matched existing assets: brown logo, white footer logo and the three home/search photographs. No additional image binaries or temporary Figma URLs are needed at runtime. The Wuse 2 detail exactly follows the source. The other existing illustrative cards reuse the detail template with their own known titles/prices/facts/images; unspecified charges are labelled as not supplied, never inferred from a percentage.

## Verification

ESLint passed; strict TypeScript passed; Vitest: 45 passed across six files; production build passed; mock audit: no handlers. The first browser pass confirmed all seven inspected section bounds exactly, plus photo slots and closed-screen accessibility. A dialog-unmount focus-return defect was corrected in the shared Modal. Full-page rendered comparison completed against the 1440×2523 Figma target. Final Chrome Playwright: 4 passed, covering exact geometry/all five static asset slots, gallery and report-reason/Other interaction, focus restoration, assistant/login destinations, home/search links and preference-preserving return, unknown-slug HTTP 404, plus scoped 360/768/1280px accessibility/no-overflow checks. No real report, inquiry, assistant or inventory integration is claimed.

The initial request-time query read made unknown-slug notFound responses stream HTTP 200 through the root loading boundary. The final design preview pre-renders its three known slugs with dynamicParams=false; only return/login links read query state inside small client Suspense boundaries with matching server fallbacks. This leaves the global loading behavior unchanged. Full live publication gating/structured data remains pending the public API.

Existing shared footer contact/policy destinations remain later modules, as in home/search; this task implements the primary detail actions and browse links. Mobile viewport checks cover usability only, not a mobile Figma implementation. Next: live property integration when BE-4.7 is ready, or the next explicitly selected desktop node.
