# Kof’a brand and flow refresh

2026-10-26 · FE-1.4 design revision v0.2 · Developer 2 lead, explicitly authorized by the developer.

[Open the refreshed homepage](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=14-219)

## Task brief

Restyle the existing property frames using the supplied brown/cream logo reference and Dribbble inspiration. Recreate a similar outlined SVG logo, as requested, and make mobile feel like an application. Reuse existing tokens/components and retain the draft property contract and privacy/copy rules.

Branch: `joint/FE-1.4-brand-refresh`. Sources: developer's five image references, existing Figma file, UI_DESIGN_SYSTEM, PRD property journeys, API_CONTRACT v0.2.0 §§4.4–4.6. The new brand overrides OQ-01's provisional teal/text-wordmark default. No API or backend code changes.

Acceptance: refreshed existing frames; editable vector identity; desktop/mobile sign-in gates for interest/navigation; persistent mobile controls; visual/structural/contrast checks. Full authentication, submission and later feature modules remain outside this visual revision.

## What changed

- Brown #643B29, cream #F7F3EE, tan #E8C8A8, espresso #281C16; DM Sans and Instrument Serif Italic.
- Cinematic architectural hero, oversized wordmark, rounded photographic property tiles, process/trust sections, closing invitation and dark branded footer.
- Related styling across search, detail, submission contact step, staff review and feedback states.
- 390 × 844 mobile app viewports with persistent navigation, a horizontally scrolling discovery rail, scrollable filters and a persistent detail action bar. The scrollable content and bottom controls are sibling layers.
- Desktop/mobile sign-in gates. Inquiries and Account lead to the signed-out gate; no logged-in data or unimplemented native feature is invented.
- Original homepage/mobile layout clones are retained to the right of current work. They preserve prior layout structure, not an exact snapshot of old theme tokens.

SVGs are outlined paths without fonts or bitmap dependencies:

- [Brown logo](assets/kofa-logo.svg)
- [White logo](assets/kofa-logo-white.svg)
- [Doorway mark](assets/kofa-mark.svg)

These recreate the supplied concept; they are not represented as the original source artwork.

## Figma identifiers

Existing frame IDs from FIGMA_STARTER.md are preserved. New frames/components:

| Asset | Node |
|---|---|
| Account / desktop | 34:950 |
| Account / mobile | 29:1187 |
| Logo component | 26:725 |
| App navigation, four active-tab variants | 28:1260 |
| Property card, restyled in place | 14:191 |

Session: `5dd4a105-c7d3-40a4-8bca-1c42a9d35906`. Temporary scripts/renders/evidence are in `/tmp/kofa-design/`; durable resumption IDs are recorded here. The Figma guide and foundation sheet were refreshed.

## Validation observed

- Structural inspection of all twelve current screen frames: zero unexpected auto-layout overflow; only DM Sans and Instrument Serif reported. Screens use editable layers, components and vector paths; photos are discrete content assets.
- Visually reviewed homepage, search, detail, submission, staff review, feedback states, five mobile viewports, desktop sign-in, foundation sheet, shared guide and logo. Rechecked search after correcting its fallback paint and image overrides; rechecked photo cards after moving text into the lower gradient.
- Verified mobile vertical content viewports, horizontal discovery rail, and navigation/action controls outside scrolling content. Prototype reactions connect discovery → search → Wuse 2 detail → sign-in, navigation and filters. Presentation-mode click-through was not performed.
- Selected WCAG calculations: 13/13 text pairs meet 4.5:1; input-border pair is 4.39:1 and meets the 3:1 UI requirement. Exact ratios are recorded in UI_DESIGN_SYSTEM. No exhaustive photograph-pixel, keyboard, screen-reader or browser audit was performed.
- Three SVG files parsed as valid XML with outlined paths and no text/font dependency. CairoSVG was unavailable locally; logo rendering was verified in Figma.
- No frontend/backend code was built. Login, pagination, filter values and staff buttons are prototype references, not live operations.

The visual revision is ready for developer review. Full FE-1.4 remains unfinished: complete the remaining auth/submission templates and actual responsive/accessibility validation before marking that task Done. Contract follow-ups from FIGMA_STARTER.md still apply. Next work: FE-1.4 continuation; BE-1.2 can proceed independently.
