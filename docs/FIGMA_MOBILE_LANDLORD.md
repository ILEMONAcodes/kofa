# Mobile landlord listing — Figma 43:983

Task: FE-4.10 — mobile landlord listing presentation
Objective: Implement eight source frames as a coherent six-step contact/property/pricing/features/media/review flow, plus illustrative receipt and verification explanation.
Owner: Joint (Developer 2, explicitly authorized frontend work)
Branch: joint/FE-4.10-mobile-landlord
Required docs: IMPLEMENTATION_PLAN FE-4.10; PRD FR-PROP-01/02/06/12/15; API_CONTRACT 4.4 and validation conventions; UI_DESIGN_SYSTEM original tokens/accessibility; ARCHITECTURE frontend/mock policy.
Files expected: frontend landlord route, submission components/styles/tokens/tests; small UI/progress/assumption/handoff documentation.
Dependencies: foundation and mobile shared shell implemented; BE-4.3/4.4 and generated API types unavailable.
Contract: 0.2.0 Draft landlord create/upload/delete/submit; unchanged, no endpoint mocks.
Acceptance: all eight source views reviewable; original theme, exact assets and fixed mobile actions retained; every step validates relevant UI inputs; dropdowns/Other; local photo selection/reorder/cover/removal, evidence selection, optional video selection; review/edit retains in-memory values; service unavailable is explicit, never fake submission/publication.
Tests: unit validation/file limits, browser source geometry/assets/axe, step journey/Other/return/edit, local media management/privacy, short/wide viewports; lint/typecheck/build/mock audit.
Out of scope: backend, live upload/storage, server draft persistence/progress/retry, real consent/policies, publication decisions, other Figma modules.
Working assumptions: OQ-13 file limits; approved contact registration with no landlord account; source optional email shown only in UI (Draft serialization is not implemented). Native UI validation and in-memory local file selection match the existing presentation-only work; RHF/Zod and full API integration remain FE-4.10 work. Source success/sample data lives only behind explicit preview mode.

## Implemented screens

| Step query | Figma node | View |
|---|---|---|
| contact | 51:1580 | Tell us about you |
| property | 51:1785 | Introduce your property |
| pricing | 51:2002 | Make every cost clear |
| features | 51:2203 | The details that matter |
| uploads | 51:2380 | Show the space. Share the proof |
| review | 51:2567 | A final look before you submit |
| receipt | 51:2730 | Your property is with our team (preview only) |
| verification | 51:2848 | Verification, step by step |

Open `/landlord` for an empty local form or `/landlord?preview=1&step=contact` for source example data. “Preview all listing screens” exposes the eight numbered states. The existing `/list-your-property` alias, home and account listing links still lead here. Changing the step uses browser history; draft fields and selected media stay in component memory. No contact information, exact address, filename or file contents is put in route parameters, storage or requests. Refresh clears entries. A non-preview receipt URL renders review instead of claiming a successful submission.

Contact registration needs no landlord account. Dropdowns cover relationship, property type/use/location, rent/sale, terms, charges, rooms, furnishing and availability. Relevant selectors include Other with a required preference field; amenities allow multiple choices. Bedroom/bathroom counts here describe the actual landlord-owned property and do not add bathroom search filtering. Pricing permits precise naira amounts and ±₦100,000 adjustments using shared integer-kobo helpers; review uses full shared money formatting. Required description and optional landlord conditions follow the source location fields to cover FR-PROP-01 without moving the initial source viewport.

## Media and privacy

File pickers accept the OQ-13 defaults: 20 JPEG/PNG/WebP photos at 10 MB each; 10 PDF/JPEG/PNG evidence documents at 10 MB each; one optional MP4/WebM at 100 MB. Client checks metadata/count/size and rejects unsupported/empty files; real content sniffing/EXIF removal belongs to BE-4.3. These checks do not claim uploaded/verified status. Main flow says selected locally; only labelled source preview uses illustrative Ready labels.

Photos have local thumbnails and a manager to move earlier/later, choose cover by moving first, and remove. Evidence is represented by filename/status without a public URL or document preview. Video can be selected, replaced, previewed locally and removed. Errors show retry-selection/remove controls; there is no fictitious network progress. Photo/video object URLs are released on removal/replacement/unmount and remain alive through review/edit navigation. The manager stays mounted while its step is hidden. Live uploads, progress and network retry need BE-4.3/4.4.

Review displays contact privacy, property, price/terms, features, media counts and optional video, with edit actions for every group. Both ownership/accuracy and policy checkboxes are required in the UI; approved policy versions are not available, so no legal acceptance is recorded. Submit revalidates all steps and opens an unavailable-service notice. Sample receipt is a separate explicit preview link; no property is submitted, verified or published. Verification explains staff checks, landlord approval and the legal-title disclaimer.

## Source fidelity

Exact exports are recorded in `frontend/src/design-tokens/mobile-landlord.json`: all 23 source exports downloaded and hashed. Existing back/logo/location chevrons and three photographs match byte-for-byte; only the native 20×20 checkbox check vector is new. Photo slots follow source order interior/architecture/Jabi/interior/architecture. SVG root dimensions remain unchanged. No temporary Figma asset URLs ship in runtime code.

Shared brown/cream tokens, DM Sans typography, 108px header, 20px insets/gaps, heading y164, first contact input y322 and action bar y690/h154 match the 390×844 source. Photo thumbnails are 110×84 at x41/y473. The verification heading uses automatic optical sizing at the same source 30px to reproduce its single 38px line; forced opsz14 produced an extra line. Native dropdowns reuse accessible project controls; three exact source location chevrons stay at 20×20. Preview labels replace simulated OS status indicators; device corner clipping is not drawn on the website. Short screens scroll above persistent actions and real safe-area padding. Wider layouts are bounded cards, not a claim of matching an unrequested desktop node.

## Remaining integration / next work

FE-4.10 remains In progress as an integration task: generated API types, RHF/Zod, typed service adapter, server drafts/upload tokens, upload progress/retry, live policy versions, structured server field errors and real receipt values remain pending. Source optional email/Other preferences must be reconciled with the Draft API before payload serialization; none is silently serialized now. No endpoint mocks or dependency changes. Backend and contract untouched. Next: BE-4.3/4.4, then FE-4.10 integration and J-4.15 real-stack acceptance.

## Actual validation

- `npm run test`: **64 passed / 8 files**.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed, including the final source-matching typography/video-panel build.
- `npm run mock-audit`: no active TEMP-MOCK handlers.
- First focused browser pass: 3/5 passed; two error assertions matched both the listing error and Next.js route-announcement alert. Scoped them to listing error alerts, preserving the assertions.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: **26/26 passed** (2.0m), covering all previous desktop/mobile browse/auth flows and the new listing cases.
- After final listing-only typography/review-panel corrections and rebuild, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- e2e/mobile-landlord.spec.ts`: **5/5 passed** (44.2s). All eight source screens pass geometry and axe checks; verification heading is one 38px line with first explanation row y314.
- Browser journeys cover required contact fields, Other text, optional email, state retention/back history, integer-kobo price steps, upload minimums, photo add/reorder/cover/remove, private evidence selection, optional video selection, image object-URL retention after review/edit, unsupported-file rejection and retry selection, explicit consent and unavailable-service behavior. No POST requests occurred in local form/media journeys.
- 360×640, 390×500, 768×1024 and 1280×900 checks pass without horizontal overflow and with reachable video controls. Source screenshots under ignored `frontend/test-results/listing-*-390.png` reviewed visually. All 23 exported assets have local non-empty matches with recorded hashes.
- `git diff --check`: passed. No backend, API-contract, dependency or secret/config changes.

Review correction: restored the visual ₦ prefix inside price inputs while retaining numeric input values and integer-kobo parsing/steps; added wrapping for long locally selected filenames. Generic Figma Code Connect `primitives` snippets are represented by the installed project’s matching common Input/Button controls; no `primitives` package exists here. Review found no backend/publication behavior added and no credential/private-file transmission.

Post-review verification: lint/typecheck/final production build passed. Final focused geometry/asset/axe and short/wide layout tests (`--grep 'eight listing|short and wide'`) passed **2/2** (26.0s), including the visible ₦ prefix. Review complete for the presentation scope; live-service requirements above remain open.
