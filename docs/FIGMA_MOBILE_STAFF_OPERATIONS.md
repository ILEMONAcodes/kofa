# Mobile staff operations — Figma 79:2309

Task: FE-4.14 — staff operations presentation shell
Objective: Implement all 37 supplied mobile source views as a connected, explicitly labelled design preview using the original theme and existing common controls.
Owner: Joint, Developer 2 continuing explicitly authorized frontend work.
Branch: joint/FE-4.14-mobile-staff-operations
Required documentation: IMPLEMENTATION_PLAN FE-4.14, FE-5.8/5.9 and appointment UI tasks; API_CONTRACT §4.7 and property review intent; UI_DESIGN_SYSTEM tokens/mobile/accessibility; ARCHITECTURE frontend/mock policy; PRD property privacy, staff inquiry and appointment flows.
Files expected: frontend staff preview route, registry, scoped feature components/styles, admin foundation preview link, tests, this handoff and PROGRESS/DECISIONS notes.
Dependencies: existing frontend foundation and common controls; branch retains pushed client preview commit 1564bba on top of current origin/main. Property, staff authentication and appointment integrations remain separate tasks.
Contract: unchanged 0.2.0 Draft. No API handlers, endpoint mocks, session handling, permission decisions, publication rules, signed URLs, private evidence fetching or real mutations will be implemented.
Acceptance: all 37 source states and contents reachable in source order, original typography/spacing/cards/images/nav, dropdowns/Other and editable forms, local media validation, distinct staff notes/client reply, explicit unavailable-service outcomes and complete mobile scroll areas. Public previews contain fictional design samples only.
Tests: lint/typecheck/unit/build/mock audit; Chrome all-route heading/overflow checks, source asset geometry, menu/record links, filters/Other, file validation, unavailable actions and representative axe checks. Visual comparison against source screenshots.
Out of scope: real staff services, role gates, automatic publishing/fee/calendar decisions, real document access, legal text, backend and unrelated designs.
Working assumption: continue the established labelled UI preview approach while the service contracts and authentication are pending. Forms use native presentation validation; API forms and server validation remain integration tasks. No mock handlers added.

Implementation

- Entry `/staff-preview/overview`, also linked from `/admin` as **Open staff design preview**. Menu lists all 37 source screens in Figma order, plus direct links to Properties, Landlords, Inquiries, Clients, Inspections and Calendar.
- Shared Button, Input, Dropdown, Modal and SearchBudget components are reused. Dropdown accepts an optional exported chevron without changing its default rendering. Source State/City/Area chevrons use the existing exact `search-chevron.svg` asset at 20×20.
- The semantic registry retains source IDs, visible text, typography, spacing, card geometry, photo slots and local asset references. All 196 exports were downloaded and hashed against existing assets; every export matched an existing local file. No temporary Figma URLs are used at runtime.
- Original brown/cream tokens and DM Sans are retained. Source phone clock/status symbols are replaced with an explicit fictional-preview label. Header is 124px, body gutters/gaps 20px, bottom navigation 84px plus device safe area; content scrolls independently. Desktop widths show a bounded mobile preview.
- Forms support editing, native dates, dropdowns with Other, budget steps and sample-record filtering. Photo selection accepts JPEG/PNG/WebP up to 10 MB, with a 20-photo limit including the three illustrated media slots; video selection accepts one MP4/WebM up to 100 MB. Files remain in memory and are never uploaded. These are presentation checks; content sniffing, actual stored counts and all authoritative validation remain backend work.
- Source media has a walkthrough poster but no playable video file. Play displays a clear unavailable-media explanation. Document preview intentionally omits document contents as in the source; refresh never fetches private documents or fabricates a signed URL.
- Operational buttons show an unavailable-service dialog; example result states are separate, explicitly labelled preview links. No real message, publication, assignment, client, inspection, deletion or fee state changes occur.
- Verify/approve, reports, concerns and transaction creation link outside this supplied section's 37 designs, so they display unavailable-service feedback rather than invented screens. Related module designs/integration are follow-up tasks.

Validation — 2026-10-30

- `npm run test -- --run`: 69 tests passed across 9 files, including media boundary/type/count checks, record destinations, unique control IDs and visible-content-only search.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. The final build also passed Next's TypeScript checks and generated all 37 new static routes.
- Chrome: the nine initial staff checks passed together; the additional source-header/chevron check passed, then menu/filter/Other and geometry checks passed again after final review changes. Coverage includes all 37 headings/scroll widths, local photo presence/loading/heights, logo/nav geometry, connected menu/records, unavailable actions, local file validation and widths 360/768/1280. Ten staff checks passed across these runs.
- Existing client preview regression: all 23 client routes and inquiry dropdown/outcome checks passed.
- Axe: no serious/critical violations in Properties, Media, Qualification, Schedule Inspection and Calendar. This is representative coverage, not a whole-site accessibility certification.
- Overview, listing editor, evidence, media and calendar screenshots were visually inspected against their source views. The source body paragraphs match the registry, with the two budget-step captions supplied by the existing shared component. A complete pixel-by-pixel comparison of every screen remains a design-review follow-up.
- Mock audit: no active TEMP-MOCK handlers. No endpoints, contracts, backend files or real services changed.
