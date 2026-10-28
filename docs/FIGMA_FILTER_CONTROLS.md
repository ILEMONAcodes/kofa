# Filter and choice-control correction

Task brief · 2026-10-28 · FE-1.4 design reconciliation · Developer 2 explicitly authorized shared frontend design corrections. Branch: `joint/FE-1.4-filter-controls`. Remove public bathroom filter, retain bathroom facts, add selectable dropdown menus and conditional Other preference entry, add independent ₦100,000 budget steps. Reuse existing components/tokens and visual hierarchy. Sources: developer request, PRD FR-PROP-09 override, draft taxonomy contract v0.2.0. No API schema or application changes. Tests: design geometry, menu/Other targets, step-state examples and rendered desktop/mobile review. Custom preference handling is a contract reconciliation item; no arbitrary enums are invented.

## Changes

- Removed bathroom controls from desktop search and mobile filters. Actual bathroom facts on cards/detail and landlord entry remain. No bedroom-to-bathroom ratio is invented.
- Reused existing field styling for dropdowns across 279 selectable fields, including property/search choices, landlord forms and staff/admin choices. Combined fields were separated into clear controls where necessary. Roles, results and lifecycle actions keep valid finite choices; Other is reserved for preferences.
- Other reveals a labelled preference textbox only after selection. The menu keeps Other in its footer, so it remains visible even when the option list scrolls. Choice menus use a shared 44 px SelectOption component with Default/Selected/Focus/Disabled variants and existing colour/type/radius/spacing tokens.
- Amenities use multi-select checkbox options inside a dropdown with Apply choices. Existing landlord selections (Parking, Generator, Fitted kitchen) remain represented in the closed selector. Exact landlord bedroom/bathroom entry uses numeric counts; Any choices are available for filters, not exact property facts.
- Added 23 typed budget controls with plus/minus steps of ₦100,000, including search min/max, homepage budget and inquiry budgets. Min/max fields are independent; the prototype prevents negative values and crossing the paired bound. Budget ranges are split into minimum and maximum rather than moving both bounds together.
- Existing brand, photographs, typography, brown section backing, mobile shells and primary flow actions are retained. Auto-layout grows forms where the added controls need space; sections were repacked to prevent overlap.

## Figma links

[Desktop search](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=14-220) · [Mobile filters](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=14-227).

[26 Desktop control states](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=168-17849) · [27 Mobile control states](https://www.figma.com/design/TJtiCYvGNkGKJ6ibOIjGCd/Kof-a?node-id=168-17850). These chapters contain dropdown overlays and control examples, not new product routes. There are 115 overlay panels and four Other/budget illustrations; the original 428 product/reference frames remain.

SelectOption component: `166:346`. Mobile Other-visible example: `174:18862`; mobile budget before/after example: `174:18879`. Current index: `105:17085`.

## Validation actually run

- 547 frames including dropdown overlays/control examples across 27 Sections: zero overlaps, unexpected auto-layout overflow or missing navigation targets.
- Evaluated the actual stored Figma interaction data: all 279 fields open a menu; 101 applicable Other transitions show the correct source textbox and normal choices hide it; 20 amenity select/deselect checks passed; 91 budget checks passed across 23 controls, covering +₦100,000, reverse step, zero floor and paired min/max guards. Both bathroom search controls are absent.
- The interaction audit caught Figma's two-branch conditional normalization; handlers were corrected to use separate guarded if/else actions before the passing rerun. No failing branch behavior is left in the checked cases.
- Desktop search, mobile filters and a menu visually reviewed during composition; final review covered mobile filters, homepage, property/amenity menus, Other entry, budget examples and landlord features.
- Whitespace validation: `git diff --check`.

These checks inspect/simulate native reaction data; presentation-mode clicks, real typing, browser/API/E2E, accessibility and persistence tests were not run. Budget prototypes use finite illustrative cases (zero to the example's initial amount plus ₦5,000,000); that is not an application budget ceiling. Implementation must support valid typed amounts with integer arithmetic and the same step/range rules.

## Contract and handoff

The developer override updates PRD FR-PROP-09 and UI_DESIGN_SYSTEM to omit bathroom filtering. The optional `bathrooms_min` API parameter remains unchanged for compatibility; no API version/shape changed. Existing taxonomy supplies property types, furnishing, availability and locations/amenities; sample options are illustrative and must come from the live taxonomy/allowed-actions data. Do not publish free-text Other as an invalid enum or show unsupported preferences as guaranteed search matches. Its persistence/mapping to free-text inquiry or staff review needs reconciliation in J-4.1/J-5.1. Consent remains a checkbox, personal text stays text, dates remain date inputs, and amounts remain numeric inputs.

Next: frontend review and implementation of these controls, with keyboard/combobox behavior, integer budget tests and server validation. Existing backend and application tasks are unchanged.

Role option refinement: staff invitation/editing offers Staff/Admin; user filtering can include Client and All roles. The context-specific rows are hidden outside filtering so the design does not suggest creating a client through the staff-invitation endpoint. Final geometry/target audit rerun after this refinement: zero issues.
