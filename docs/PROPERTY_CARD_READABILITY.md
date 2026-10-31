# Property card readability and sample catalogue

Task: FE-4.11 / FE-4.13 — readable cards and twelve varied sample listings.
Objective: Fix invisible property captions across mobile/desktop browsing and expand the illustrative catalogue to twelve distinct properties with local images and working detail links.
Owner: Joint (Developer 2, authorized frontend work). Branch: joint/FE-4.11-property-card-readability.
Required docs: implementation plan FE-4.11–4.13; UI design system original theme, mobile cards and AA contrast; API contract public PropertySummary and money conventions; architecture presentation/mock boundary.
Expected files: browse/mobile cards and content, related presentation copy and tests, local sample photo assets/credits, this handoff and progress/assumptions.
Dependencies: existing browse/search/detail presentation retained from preceding pushed branches. Contract unchanged; no endpoint mocks or live listing integration.
Acceptance: light readable captions on existing brown gradients, original card geometry and layout preserved, twelve unique sample records and cover images, rent/sale periods and furnishing presented correctly, no repeated search records, mobile load-more reveals twelve, every detail link resolves, source featured section remains three cards, local images with provenance, 360/390/768/1280 checks and representative axe.
Tests: catalogue/asset/price unit coverage, focused Playwright visibility/contrast/content/load-more/detail routes and existing browse regressions; unit suite, lint, typecheck, build, mock audit.
Out of scope: backend/API filtering, real listings/verification claims, service integration, changes to Figma, configuration files or existing uncommitted next-env.d.ts.
Working assumptions: user explicitly authorizes caption correction and twelve illustrative properties; stock images do not depict the named Abuja listings. Existing presentation-only filter behaviour remains clearly disclosed.
Validation: complete; results below.

## Implementation notes

The mobile card lacked an inverse text colour; it inherited the page's dark ink while the desktop cards already used light text. The shared caption now explicitly uses the original inverse token, keeping the original gradient, brown/cream theme and rounded photo cards. Tablet grids give cards enough width for full captions. No title clamping or ellipses were added.

The catalogue contains twelve distinct slugs covering all seven existing property-type values, nine rent samples and three sale samples. Each has a distinct local image, appropriate alternative text and a working detail route. Desktop featured cards remain the original three. The mobile discovery carousel uses all twelve and no longer overrides every cover with the first property's image. Explore shows twelve distinct cards on desktop; mobile starts with six and loads the remaining six without duplicates. Sorting covers the full catalogue.

Full prices use the existing integer-kobo formatter. Sale prices have no annual suffix; monthly/yearly rent and semi-furnished labels are supported consistently in cards and details. Original three detail galleries are retained; each new sample uses only its own cover photo, with a full-width single-image gallery. Sample content and stock-photo disclosures remain visible; filters retain their existing URL-only presentation behavior until API integration.

Nine additional photos were downloaded from free Unsplash photo pages, converted by the image CDN to 960 px WebP files, and inspected visually. Original three cover assets remain unchanged. Exact source/photographer/license/download information is checked in at `frontend/public/assets/properties/credits.json`. New photos total about 1 MB and load locally; no runtime external image requests or new dependencies. License reference: https://unsplash.com/license. Stock images do not depict the fictional named properties.

## Validation

- 93 unit tests passed in 15 files. Lint, typecheck, production build (205 static pages) and mock audit passed; no active endpoint mocks.
- 17 distinct Chrome checks passed across runs, including all 12 detail routes, loaded/distinct images, six-to-twelve mobile load-more, price sorting, correct sale/rent labels and existing browse flows.
- Initial combined run: 16 passed, one older navigation test failed because its first-sorted-card assumption no longer matched the expanded catalogue. The test now selects Jabi by name while separate catalogue tests verify the new cheapest/most-expensive ordering.
- Final combined run: 15 passed, two tests timed out during Chrome page setup before application assertions. A fresh serial desktop-detail run passed all four checks, including both setup-timeout cases and the corrected navigation test. No failing application assertion remains.
- Captions checked at 360/390/768/1280 px: every title, price, fact, location and link stays within its card, explicitly uses inverse text and meets at least 4.5:1 contrast even assuming a pure-white photograph beneath the original gradient. Representative axe checks passed at 390/1280; existing mobile/desktop accessibility regressions passed.
- Source-style screenshots and a contact sheet of all nine new photos reviewed. Original card geometry and desktop home section geometry remain covered; search grows to six rows for twelve distinct records.
- The pre-existing local next-env.d.ts development imports were restored after Next regenerated them during the build; excluded from this task's commit.

Next: FE-4.11 live search/filter integration when the public API is ready; these samples do not mark that integration complete.
