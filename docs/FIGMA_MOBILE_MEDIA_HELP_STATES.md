# Mobile media, help and states

Task: FE-6.26 — Figma section 82:2309 presentation
Objective: Build all 39 source mobile states using existing components and original brown/cream tokens.
Owner: Joint (Developer 2, frontend work authorized). Branch: joint/FE-6.26-mobile-media-help-states.
Required documentation: implementation plan FE-4.10/4.12, FE-6.16/6.26/6.32; UI design system foundations and mobile pattern; API contract uploads §4.4, reporting §4.8 and assistant §4.9.
Files expected to change: frontend media-help feature, preview route, related listing/detail entry links, focused tests, this handoff and progress/decisions notes.
Dependencies: existing listing, property, client and staff presentation components. The preceding administration presentation branch is retained because it is not yet merged into main.
Contract: unchanged; no endpoint handlers or live integrations introduced.
Acceptance criteria: all 39 screens in source order; exact local source assets; working local file selection/validation and removal; gallery navigation; linked reporting/help/policy/state examples; labelled draft legal content and disconnected service actions; no horizontal overflow at 360/768/1280.
Tests required: model/unit coverage, focused Playwright route/form/media/navigation/a11y checks; lint, typecheck, build, mock audit.
Out of scope: real uploads, publication, authentication/authorization, real reports, AI calls, real support contact details and final legal content.
Working assumptions: OQ-13 source upload limits and OQ-18 draft legal copy apply. This is one presentation module and does not complete its constituent service integrations.

Implementation:

- All 39 Figma source states are available at `/media-help-preview/[screen]`, with source ordering in the numbered directory. Entry: `/media-help-preview/media`; help: `/media-help-preview/help`.
- Reuses common Button/Input/Dropdown/Modal, the existing landlord MediaPicker, original palette/DM Sans and mobile shell geometry. The source's 199 exported images/SVGs downloaded and matched existing assets by exact hash; no duplicates or temporary asset URLs are shipped.
- Local media and caption/order/cover edits persist between these preview routes in memory. Native file selection validates declared MIME, size and count using the existing helper. Public photo/video selection and private evidence stay distinct; report evidence has its own maximum of three PDF/JPEG/PNG files. Actual content sniffing/EXIF processing/private storage remain server integration work.
- The source supplies only a video poster. Local selected videos use native controls, no autoplay. Source upload progress, success, failure and retry states remain explicitly fictional examples; no fabricated uploads or requests occur.
- Gallery controls, help topics, assistant sources/handoffs and recovery actions link to existing pages or their numbered preview states. Mobile header Help, property detail and landlord uploads provide entry links. The empty-state Edit filters action opens the existing search sheet via a presentation-only `filters=open` flag; it is discarded when preferences are applied.
- Legal/disclosure pages retain their original prominent draft callout and noindex metadata. No legal approval/version, real support number, authentication, reporting service or AI integration is implied. The report/assistant forms use native validation and a separate unavailable-service dialog before an explicitly labelled example outcome.
- The source embeds an unrelated “Choose a neighbourhood” error in phone/email examples; rendered errors identify the actual fields. Fake OS status indicators are replaced with the established preview label. Added directory/service notices are outside source content. The conflict screen retains workspace navigation; other screens use consumer navigation.
- Cross-links to `/landlord` review are separate sample design routes; locally selected files are not submitted or transferred into a live landlord draft. In-memory selections reset when leaving this preview layout/reloading.

Validation:

- `npm --prefix frontend test`: 80 passed, 11 files.
- `npm --prefix frontend run lint`, `typecheck`, `build`, `mock-audit`: passed; no active TEMP-MOCK handlers.
- Initial media/help Chrome suite: 8/8 passed. Review then separated report evidence limits and corrected source-specific navigation, Help outline and fixed action-bar surface.
- Final combined Chrome run: 19/19 passed (10 media/help checks, 4 existing mobile browse, 5 existing mobile landlord). All 39 source headings/body text and image slot geometries checked; file validation/persistence/removal, private evidence cap, Other fields, explicit example outcomes, zero mutations, gallery/policy navigation, keyboard modal focus, fixed controls and representative axe checks passed. Responsive representative widths: 360/768/1280.
- Final complete media/help rerun after the filter-link correction and retaining the source draft callout: 11/11 passed, including the new empty-state-to-filter-sheet journey. Together with the existing browse/landlord regression run, 20 distinct browser checks passed across the runs.
- Source and rendered screenshots reviewed for media, gallery, assistant, draft terms, loading and accessibility. Existing desktop layouts/services remain outside this visual pass.

Next: FE-4.10/FE-4.12 upload/gallery integrations, FE-6.16 reports, FE-6.26 approved policy/version wiring and FE-6.32 assistant services, each as separate contract-backed tasks. This presentation does not mark those integrations Done.
