# Shared Figma UI/UX starter

2026-10-26 · Developer 2 lead at the developer's explicit request · Draft v0.1

**Historical first-pass record:** the subsequent [brand and mobile-flow revision](FIGMA_BRAND_REFRESH.md) supersedes the palette, typography, mobile dimensions and quota-blocked validation notes below. Current design tokens are in UI_DESIGN_SYSTEM.md.

[Open Kof’a](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=18-532)

## Task brief

- Task: FE-1.4, shared Figma starter slice; not completion of the full FE task.
- Objective: give both developers editable foundations and property-journey examples.
- Owner/branch: Developer 2, cross-area design authorized in session; `joint/FE-1.4-figma-foundations`.
- Sources: UI_DESIGN_SYSTEM §§1–9,11; PRD §§2–5.2; API_CONTRACT v0.2.0 §§4.4–4.6; ADR-018; OQ-01 placeholder-brand default.
- Dependencies: J-0.3 working assumptions usable under ADR-019. Property endpoints remain Draft; examples are fictional.
- Repository changes: this handoff, DECISIONS working assumptions, PROGRESS shared note. No frontend/backend source or contract changes.
- Acceptance: editable project tokens/styles and reusable controls; desktop/mobile property examples; privacy and verification copy; structural and visual checks; selected contrast calculations.
- Tests: Figma layer/font/overflow inspection, screenshots, WCAG contrast calculations. No application implementation to test.
- Out of scope: a complete application design, full FE-1.4 acceptance, backend implementation, live data, real fees, final legal content.

## File index

| Page | Contents |
|---|---|
| 01 — Start here | Scope, journeys, API mapping, assumptions, remaining modules |
| 02 — Foundations | Three variable collections; 39 local variables; nine Inter styles; SDS-based button/field wrappers, badges, property card and review sheet |
| 03 — Property experience | Five desktop screens, three mobile screens, mobile filter drawer, property feedback-state sheet |

| Frame | Node |
|---|---|
| Home / desktop | [14:219](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=14-219) |
| Search / desktop | 14:220 |
| Detail / desktop | 14:221 |
| List property / desktop — contact step only | 14:222 |
| Staff review / desktop | 14:223 |
| Home / mobile | 14:224 |
| Search / mobile | 14:225 |
| Detail / mobile | 14:226 |
| Filters / mobile | 14:227 |
| States / property — loading, empty, error, unavailable | 14:228 |
| Foundation review sheet | 13:35 |
| Shared guide | 18:532 |

Component IDs: Button 13:215 (20 variants), Field 13:393 (4), Badge 13:433 (5), PropertyCard 14:191. Button and field text are editable through the nested SDS instance properties. Library sources are kept linked.

Desktop frames are 1440 px with 1200 px public content. Mobile frames are 360 px with 16 px gutters. The draft palette, Inter, full prices, rent periods and dated verification follow the repository proposal.

Basic prototype links connect home to search, the Wuse 2 sample cards to detail, desktop listing entry to the contact template, and the mobile filter drawer to results. Other controls are design references. Prototype links were written successfully and structurally counted; an interactive presentation-mode click-through was not performed.

## Verification actually performed

- Structural read of all ten property frames: each contains editable text/frames/instances; only discrete property photos use image fills. All rendered text segments report Inter. Zero child overflow findings in the inspected auto-layout frames.
- Screenshots reviewed: all five desktop frames and mobile search. Foundation review initially exposed collapsed horizontal rows; those rows were repaired, but the final foundation sheet has not been visually rechecked.
- Desktop gutters were corrected and rechecked visually. The staff sidebar remains shorter than its workspace; a stretch adjustment was attempted but blocked before execution by the Figma quota.
- Mobile home/detail/filter drawer, feedback-state sheet and shared guide still need visual review.
- Figma Starter-plan MCP quota stopped further editing/screenshots. `whoami` confirmed Starter. Work is a partial draft, not accepted FE-1.4.
- No frontend, API, E2E, keyboard, axe, tablet or browser responsiveness tests were run: no application was built.

Selected WCAG relative-luminance contrast calculations (Python, 2026-10-26):

| Foreground / background | Ratio |
|---|---|
| White / primary | 7.69:1 |
| White / hover | 10.53:1 |
| White / danger | 6.54:1 |
| Ink / white | 17.75:1 |
| Muted / white | 7.69:1 |
| Muted / canvas | 7.36:1 |
| Primary / tint | 6.79:1 |
| Success / tint | 4.64:1 |
| Warning / canvas | 4.66:1 |
| Danger / canvas | 6.25:1 |
| Input boundary / white | 4.97:1 |

11/11 selected pairs exceed 4.5:1. This is not an exhaustive rendered accessibility audit; amber accent is decorative.

## Backend handoff and unresolved decisions

1. Keep the contract unchanged at 0.2.0. Public PropertySummary/PropertyDetail must exclude landlord contact, exact address, documents and internal data. Only the fictional staff frame shows a private example address.
2. J-4.1 must resolve the already documented `allowed_actions` gap; the UI must not recreate transition permission rules.
3. UI_DESIGN_SYSTEM describes server saving per submission step, but §4.4 currently defines draft creation with property data and no partial-update endpoint. This slice only designs the contact template; decide persistence before implementing later steps. No undocumented PATCH is assumed.
4. Full submission, authentication, inquiry, appointment, transaction, complaint, assistant and remaining admin screens are still to design. FE-1.4 stays unfinished.
5. Stock images do not depict the named Nigerian listings. Sources: Unsplash photos `1600607687939-ce8a6c25118c`, `1600585154340-be6161a56a0c`, `1600607687920-4e2a09cf159d`. Figma captions/footer and guide identify the design as illustrative. Mobile detail still needs its own stock-preview caption.

## Resume

Figma session: `a3871936-7099-409f-99e3-90997e185eec`. Local working scripts and evidence: `/tmp/kofa-design/`; state ledger: `/tmp/design-system-state-kofa-20261026.json`. Temporary files may expire; use the exact node IDs above to reconstruct state.

Next: finish the pending visual checks and sidebar/caption fixes, then Developer 1 reviews the starter and continues FE-1.4. BE-1.2 remains independently workable.
