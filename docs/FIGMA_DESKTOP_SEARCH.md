# FE-4.11 — Desktop search from Figma 14:220

## Task brief

Owner: Developer 2, explicitly authorized to implement frontend while Developer 1 is unavailable. Branch: `joint/FE-4.11-desktop-search`, stacked on homepage commit b6c4407 (origin/main plus FE-4.13). Objective: reproduce desktop search and connect the homepage's supported URL preferences.

Required documentation: ORCHESTRATOR §4/§9; frontend guide; IMPLEMENTATION_PLAN FE-4.11; UI_DESIGN_SYSTEM §6/§8/§9; API_CONTRACT 0.2.0 Draft §2.6/§2.10/§4.5. Dependencies FE-2.5, FE-1.4 and J-4.1 are incomplete; this task implements the requested design slice using explicitly fictional source content, without mocking Draft endpoints. Assumes current Figma choices and draft query contract. No contract changes.

Files: search route, browse navigation/filter/results components, reusable select extensions, URL helper/tests, local Figma exports and token manifest, focused browser tests and handoff docs. Out of scope: mobile Figma implementation, property detail, backend integration, authentication or business rules.

Acceptance: source 1440×2786 desktop geometry; matching brown/cream colors, typography, photographs and footer; all menu choices from desktop overlay references; Other textbox; amenities multiselect; safe typed budget and ±₦100,000; URL apply/clear, reload/back navigation and homepage handoff; no bathroom filter. Keep actual bathroom counts on cards.

Tests: lint, strict TypeScript, unit URL tests, production build, mock audit, desktop Playwright geometry/assets, filter interactions, accessibility and homepage regression.

## Source and relationship

Node `14:219` is the homepage entry, node `14:220` the `/properties` search destination. Reuse the existing exact photograph exports, card styles, tokens and footer; use the brown header logo for the light navigation. Search has a 280px sidebar, 32px gutter and 888px results column (two 432×478 cards per row). Navigation is 116px high, heading 270px, workspace 1786px and footer surround 614px. Source preview is six cards with deliberate repeated illustrative properties. The source initially labels property type Apartment while showing a duplex; preserve the initial source composition rather than claiming these are authoritative filtered results. Applied filters are URL preferences; an explicit notice distinguishes unchanged sample cards from live results. Sorting the sample prices works locally; live filtering/counts/pagination remain pending API integration.

Menu references: City 169:20562; Area 169:18143; Listing 169:19583; Property type 169:20380; Bedrooms 169:20611; Furnishing 169:20861; Amenities 169:20927; Availability 169:20324; Sort 169:21357. Other values become text-search preferences via `q`, never invented enum values. Supported multi-value parameters are comma-separated; amounts are integer kobo.

## Verification

ESLint passed; strict TypeScript passed; Vitest: 42 passed across five files; production build passed; mock audit: no handlers. Chrome Playwright: 9 passed (homepage and search desktop geometry/assets/interactions, plus foundation accessibility/no-overflow checks at 360/768/1280px). The initial 8px sidebar mismatch was corrected to source 1276px; all inspected section bounds match. Visual comparison confirmed exact photo crops, navigation, cards and footer; a final currency-prefix spacing correction was checked separately.

The running development server retained obsolete generated route validators after the route-group move. It was restarted and generated types refreshed; strict typecheck then passed. The local server was restored on port 3000. Next.js generated `frontend/AGENTS.md` during restart; its standard framework guidance is included. The developer-generated `next-env.d.ts` path change is left unstaged.

Full FE-4.11 remains in progress until real API/mobile acceptance. Next: FE-4.12 desktop property detail, with live property integration gated by J-4.15.
