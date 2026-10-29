# Kof’a frontend foundation

Next.js App Router, strict TypeScript and Tailwind CSS. Includes the FE-2.3 architecture foundation and FE-4.13 desktop homepage implementation; other route screens remain foundations. The original brown/cream identity, DM Sans UI font and Instrument Serif editorial font are retained. Fonts are self-hosted with `next/font/local`; builds do not contact Google Fonts.

## Run

Node 22.12+ (Node 24 recommended), npm:

```sh
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Backend defaults to http://127.0.0.1:8000; change the **server-only** `API_ORIGIN` if needed. `/api/v1/*` rewrites to that origin. No client secrets or CORS setup are required. The previews work without the backend and do not make data requests.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run mock-audit
npx playwright install chromium
npm run test:e2e
```

On macOS versions unsupported by bundled Chromium, use an installed compatible Chrome: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Tests use an isolated headless context, not a personal browser profile.

## Directory blueprint

```text
src/
  app/
    (home)/            # / — Figma desktop homepage with its own hero navigation
    (public)/          # /properties, /properties/[id], /landlord
    (auth)/            # /login foundation
    (client)/          # /account foundation
    (admin)/           # /admin foundation
    globals.css        # semantic theme variables; light default, dark surfaces
    layout.tsx         # local fonts, metadata, skip link
  assets/fonts/        # self-hosted OFL fonts and licenses
  components/
    common/            # Button, Modal, Input, Dropdown, Badge, shared shells/states
    browse/            # Hero, SearchFilters, PropertyGrid
  lib/
    api/               # envelope transport, ApiError, same-origin CSRF + one refresh
    formatters/        # integer-kobo display/parser
  types/               # manually mirrored public property/taxonomy contract types
  test/                # shared test setup
public/assets/         # existing Kof’a SVG logos, property placeholder
```

`/properties/[id]` preserves the requested folder name, but its URL parameter represents the public **slug**, as required by API_CONTRACT §4.5. `/list-your-property` redirects to `/landlord` to retain the established entry point. Landlords register contact details inside listing submission; no landlord login is introduced.

## Implementation boundaries

- Colors, radius and font utilities map to `globals.css` via `tailwind.config.ts`. Tailwind 3.4 is selected to support the explicitly requested TypeScript configuration without a v4 compatibility layer. Dark tokens are infrastructure only; approved screens default to light.
- Public property types intentionally exclude landlord contacts, exact address, documents and internal notes. `bathrooms_min` is retained only in the API filter type; it is not exposed by UI filters. Actual bathroom counts remain on property cards.
- Types mirror **contract 0.2.0 Draft**, not generated schemas. Replace with OpenAPI-generated types in FE-2.5 after BE-2.4; resolve nullability and verification enums at J-4.1. Transport validates the envelope, not resource payloads.
- Native select primitives include fixed chevrons. Live taxonomy, cascading options, conditional Other inputs, multi-select amenities, URL filters and ₦100,000 budget steps belong to FE-4.11. Search controls are explicitly disabled until taxonomy is supplied; no invented options or production mocks.
- Remote image domains must be approved/configured during media integration; PropertyGrid currently uses the local placeholder for remote URLs. No arbitrary image host allowlist.
- Routes are honest foundation previews. No authentication, access control, uploads, private data, operational admin controls, or fee calculations are implemented. Do not connect private data until backend authorization and FE auth integration are in place.
- Dialog uses native `showModal()` for focus trapping, Escape handling and focus restoration. Forms/stateful interactions will add React Hook Form, Zod and TanStack Query when the relevant modules are implemented.
- No endpoint mock handlers are installed. Transport unit tests stub `fetch` only inside tests.

See `../docs/FRONTEND_ARCHITECTURE_SETUP.md` for scope and verification evidence.

Desktop homepage implementation and token provenance: `../docs/FIGMA_DESKTOP_HOME.md`. It retains the source’s illustrative content disclosure; live search/results and mobile Figma implementation remain separate tasks.

Desktop search (`14:220`) owns `/properties` in `(search)` so its precise header/footer are independent of the generic public shell. It shares the homepage tokens and exact local image exports. Homepage URL preferences hydrate the sidebar; apply/clear, Other text preferences, multi-select amenities and sample-price sorting work. The six Figma cards remain disclosed design content, not a live filtered API result. See `docs/FIGMA_DESKTOP_SEARCH.md`.

Desktop detail (`14:221`) lives alongside search in `(search)/properties/[id]` (the URL value is a public slug). The three known illustrative cards open matching details; search return URLs are constrained to `/properties`. The gallery uses actual local photo exports and explicitly has no preview video. Express interest opens the existing login foundation with a return URL. Report/assistant dialogs disclose unavailable services and do not submit data. See `docs/FIGMA_DESKTOP_DETAIL.md`.

Mobile browse follows Figma section `43:979` below 768px, with app navigation and full-screen filters. A brown centered-logo launch transition appears once per mobile tab session and respects reduced motion. `/manifest.webmanifest` and local app icons provide the PWA presentation foundation; no service worker or private/offline data caching is enabled. See `docs/FIGMA_MOBILE_BROWSE.md`.

Mobile authentication (Figma 43:981): `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, and signed-out `/account`. Open `/auth-preview/login` and use “Preview all authentication screens” for the nine source views, including fictional verification/reset success and sample account. These noindex presentation routes send no credentials, record no policy acceptance, and do not create sessions or deliver email. See `../docs/FIGMA_MOBILE_AUTH.md` for the integration boundary.

Mobile landlord listing (Figma 43:983): `/landlord` starts six contact/property/pricing/features/uploads/review steps. `/landlord?preview=1&step=contact` and “Preview all listing screens” expose all eight source frames with labelled fictional content. Files are selected locally; no upload, draft persistence, legal consent or real submission occurs. Refresh discards in-memory entries. See `../docs/FIGMA_MOBILE_LANDLORD.md`.
