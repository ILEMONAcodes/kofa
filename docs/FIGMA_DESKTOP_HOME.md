# FE-4.13 — Desktop homepage from Figma 14:219

## Task brief

Owner: Developer 2 with explicit authorization from the developer in charge to implement the frontend while Developer 1 is unavailable. Branch: `joint/FE-4.13-desktop-home`, based on merged `origin/main`. Objective: implement the desktop homepage exactly from node `14:219`, with native editable UI, local assets, interactive search controls and token provenance.

Required docs: ORCHESTRATOR §4/§9; frontend specialist guide; IMPLEMENTATION_PLAN FE-4.13; UI_DESIGN_SYSTEM §2/§8; API_CONTRACT 0.2.0 §2.6/§2.10/§4.5. Assumes draft public search contract and current Figma content; no endpoint shapes changed. Dependencies FE-4.11 and live property API are incomplete; this is the explicitly requested desktop design implementation, not full FE-4.13 integration acceptance.

Files: homepage route/components, common Button/Input extensions and popover select, home search URL helper, exact Figma token/asset manifest, CSS/Tailwind, focused tests and handoff docs. Out of scope: mobile Figma implementation, search/detail page implementation, authentication, actual assistant/contact/policy modules, real listing API integration and legal publication.

Acceptance: seven sections match the 1440×4142 reference; exact extracted paints/fonts/spacing/radii; exact assets in all eight slots; menus open/close with pointer/keyboard, Other reveals a textbox, budget parses integer kobo and steps by ₦100,000; search passes supported query keys to `/properties`; no bathroom UI filter or invented property-type field.

Validation: lint, strict tsc, Vitest, production build, focused Playwright desktop geometry/assets/accessibility/interaction checks, visual comparison with reference. A local generated `next-env.d.ts` development-path change predates this task and is preserved.

## Extraction

[Source node](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=14-219). High-fidelity design context and full-resolution reference render obtained; paints and geometry additionally read from the Plugin API. Linked menu contexts: `169:20562` (City) and `169:19583` (Transaction type).

Machine-readable provenance: `frontend/src/design-tokens/home-desktop.json`. Implemented tokens: `frontend/tailwind.config.ts`, `frontend/src/app/globals.css`; desktop geometry: `frontend/src/app/home.css`.

| Paint | Exact value | Source example |
|---|---|---|
| Canvas | #F7F3EE | 14:219 |
| Surface/inverse | #FFFFFF | 28:625 |
| Brown | #643B29 | 28:623 |
| Dark brown | #40271D | 28:761 |
| Warm tint | #F0E7DE | 28:711 |
| Tan | #E8C8A8 | 28:599 nested Button |
| Body | #281C16 | 28:626 |
| Secondary | #6A584D | 28:624 |
| Input border | #8B7465 | 28:628 nested Input |
| Verified | #356344 | 28:677 nested Badge |
| Photo overlay | #1F110A at .55 / .18 / .9 | 28:582, stops 0 / 40 / 100% |
| Card overlay | #140A05 at .06 / .1 / .8 / .97 | card gradient, stops 0 / 48 / 62 / 100% |
| Navigation | #FFFFFF at .13 | 28:594 |
| Menu border | #DED3C9 | linked dropdowns only |

DM Sans: Regular 400 and Medium 500, optical size 14. Font-size/line-height pairs: 12/16, 14/20, 16/24, 20/28, 24/32, 48/54, 168/174 and 194/200; the hero wordmark tracks −8px. Instrument Serif Italic 400: 64/66. Spacing set: 0,4,8,12,16,20,24,32,48,64. Observed radii: 0,8,12,24,32,9999. No new paint was invented. Existing dark/error tokens remain out-of-scope infrastructure and are not applied to this homepage.

## Assets and component mapping

Three exact raster exports and two exact SVG exports are saved under `frontend/public/assets/home-*`. Raster URLs had PNG suffixes but returned JPEG payloads; bytes were retained unchanged and filenames corrected to `.jpg`. All photos use center-cover, as the source uses FILL with an identity image transform. SVG root dimensions remain unchanged: header 144.5×46.8333 and footer 192.667×62.4445. Hero, cards and closing use the architecture photograph in the same slots as Figma; living-room imagery repeats only where the source repeats it.

The generic Code Connect snippets point to `primitives`, which is absent from this repository and dependencies. Existing local Button/Input equivalents are reused and extended; no fake package or CodeConnectSnippet wrapper is added. The custom menu shares the existing field styling and mirrors linked menu option structure.

## Flow and boundaries

The `/` route moves to `(home)/page.tsx` so its hero can own navigation without the generic public header/padding. Other public route layouts/content remain intact. The page remains a server component, with search and popover state isolated to client components. The SVGs and photos are local; no expiring Figma URL is used at runtime and no screenshot is used as a UI asset.

Where offers Abuja/Other; Looking to offers Rent/Buy. Budget is a typed amount and stepper, not a fabricated preset menu. Other is an explicit text-search preference (`q`) rather than an invalid taxonomy enum; the UI explains that availability depends on inventory. Buy maps to `sale`; prices serialize in integer kobo. The destination search page remains the pre-existing foundation. Linked contact/policy/report destinations remain later modules; assistant-labelled actions lead to `/contact?topic=assistant` pending FE-6.32, without pretending an AI service exists.

Fictional listing labels, dates, prices and the source disclosures are retained. These are design content, not API mocks or real verified inventory. The mobile Figma view has not been implemented; small-screen fallback rules only keep the page usable until the next pass.

### Typography rendering discrepancy

The Plugin API reports `opsz: 14`, retained as extracted metadata in the manifest. Chrome actually uses the self-hosted DM Sans 9pt face; at 194px/500/−8px, opsz14 renders white-ink bounds x90/y184/488×140, whereas the Figma raster measures x85/y184/466×140. A scoped display-only opsz40 correction reproduces the Figma x85/466px glyph bounds without changing font family, size, weight, tracking, colors or layout. This is a documented rendering correction, not an extracted 40 token. Smaller UI text keeps 14. Both faces and the old upstream static face were compared; replacing the source family or inventing new type sizes was avoided. Both installed DM Sans subsets lack U+20A6 (verified from font glyph coverage). The naira character uses the existing Arial fallback; all other text uses the self-hosted source families.

## Actual verification

Production build and strict TypeScript passed. Focused Chrome Playwright: 3 passed, including all seven section bounds at 1440px, all eight loaded asset slots, keyboard/Other/budget interactions and axe. Full-page rendered comparison completed against the Figma reference. Vitest: 36 passed; ESLint and mock audit passed. No real API integration or mobile-design acceptance is claimed.
