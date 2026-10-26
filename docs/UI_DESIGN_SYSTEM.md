# UI Design System

**Owner:** Developer 1 (Frontend) · **Status:** Draft v0.2 — full FE-1.4 still pending. Product name is **Kof'a** ("the doorway to your home", ADR-018). On 2026-10-26 the developer selected a brown/cream logo reference and an editorial, photograph-led direction, and explicitly authorized Developer 2 to implement the shared Figma refresh. SVG logo recreations are in `docs/assets/`; see [brand handoff](FIGMA_BRAND_REFRESH.md). Domain remains open under OQ-01.

Backend reviews this file only to confirm that every field a screen needs exists in the API contract. Backend does not redesign screens (rule 2).

## 1. Principles

1. **Trust first.** The product's promise is verified, honest listings. The UI shows exactly what was verified, when, and never overclaims.
2. **Clarity over decoration.** Plain language, plain layouts, one primary action per screen.
3. **Mobile-first, low-bandwidth.** Most users are on phones and mobile data: responsive images, lazy loading, minimal client JavaScript on public pages.
4. **Honest money.** Prices and fees are always labelled with what they cover and the period (per year, one-time). Fee figures come from the API, never computed in the UI.
5. **Accessible by default.** WCAG 2.1 AA: contrast, focus states, labels, keyboard operation, no information by colour alone.
6. **Operational efficiency for staff.** Admin screens are dense, filterable, and keyboard-friendly.

## 2. Design tokens (CSS variables → Tailwind theme)

| Token | Value (selected direction) | Use |
|---|---|---|
| `--color-primary-600` | `#643B29` | Brown primary actions, links, logo |
| `--color-primary-700` | `#40271D` | Hover/pressed, dark footer |
| `--color-primary-50` | `#F0E7DE` | Warm tints, selected rows |
| `--color-accent-500` | `#E8C8A8` | Tan action background with dark text |
| `--color-success-600` | `#356344` | Verified, success |
| `--color-warning-600` | `#85551A` | Warnings, stale availability |
| `--color-danger-600` | `#A62E25` | Errors, destructive |
| `--color-neutral-900` | `#281C16` | Espresso body text |
| `--color-neutral-600` | `#6A584D` | Secondary text |
| `--color-neutral-200` | `#DED3C9` | Decorative borders |
| `--color-neutral-500` | `#8B7465` | Input boundaries; not body text |
| `--color-neutral-50` | `#F7F3EE` | Cream app background |
| `--color-white` | `#FFFFFF` | Surfaces and inverse text |

FE-1.4 must verify every text/background pair for AA contrast (≥ 4.5:1 body, ≥ 3:1 large text/UI) and record results here.

Selected pairs calculated on 2026-10-26: white/brown 9.55:1; white/hover 13.76:1; white/danger 6.91:1; espresso/white 16.56:1; espresso/cream 14.99:1; secondary/white 6.74:1; secondary/cream 6.10:1; brown/tint 7.82:1; success/tint 5.69:1; warning/cream 5.74:1; danger/cream 6.26:1; espresso/tan 10.46:1; brown/cream 8.64:1. Input boundary/white is 4.39:1, meeting the 3:1 UI threshold. These checks do not replace a rendered accessibility audit or cover every photograph-backed text pixel.

| Scale | Tokens |
|---|---|
| Spacing | 4-px base: 1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48, 16=64 |
| Radius | `sm` 4, `md` 8, `lg` 12, `xl` 24, `2xl` 32, `full` (pill actions) |
| Shadow | `sm` (cards), `md` (dropdowns/modals) |
| Breakpoints | `sm` 640, `md` 768, `lg` 1024, `xl` 1280 |
| Container | max 1376 px editorial homepage inside a 1440 px frame with 32 px gutters; 1200 px property workspace; fluid admin |
| Motion | 150 ms ease-out; respects `prefers-reduced-motion` |

**Typography:** DM Sans for product UI, Instrument Serif Italic for selected editorial phrases; use `next/font` with system fallbacks in implementation. Product scale: display 36/44, h1 30/38, h2 24/32, h3 20/28, body 16/24, small 14/20, caption 12/16. Editorial additions: section 48/54, serif 64/66, mobile serif 40/44; oversized wordmarks are decorative. Body never below 16 px on mobile forms (prevents iOS zoom).

**Visual flow:** Large architecture photography → search → image-led property cards → process/trust → closing action → dark brown footer. Keep factual verification and full price/period information. Use gradients behind photo-overlay copy; do not invent testimonials.

**Mobile app pattern:** Current Figma examples are 390 × 844 viewports with 20 px content gutters. Home/Explore/Inquiries/Account navigation stays outside a separate scrolling content viewport. Property detail adds a persistent price/interest bar. Horizontal discovery cards and a scrollable filter sheet support one-handed use. Inquiries/Account are gated by sign-in; the designs introduce no native-app requirement, favourites or new backend feature.

## 3. Component inventory

Each component ships with: default, hover, focus-visible, disabled, loading (where relevant), error (inputs), and documented props. Built on accessible primitives (Radix UI or equivalent).

| Group | Components |
|---|---|
| Foundations | Button (primary/secondary/ghost/danger; sizes), IconButton, Link, Badge, Tag, Avatar, Divider, Skeleton, Spinner |
| Forms | FormField (label + hint + error), TextInput, PasswordInput, PhoneInput (+234), MoneyInput (₦ display, kobo value), Textarea, Select, Combobox (areas), Checkbox, CheckboxGroup (amenities), RadioGroup, Switch, DatePicker, TimePicker, FileUploader (images/docs with progress, retry, remove), Stepper (multi-step form) |
| Feedback | Toast, InlineAlert (info/warn/error/success), WarningBanner (off-platform), EmptyState, ErrorState (shows `request_id`), ConfirmDialog, Modal, Drawer |
| Navigation | PublicNavbar, AdminSidebar, AccountTabs, Breadcrumbs, Pagination, Tabs, Footer |
| Data display | DataTable (sortable, filter bar, bulk-less, pagination), KpiCard, Timeline, StatusBadge, VerificationBadge, PriceDisplay, MetaList |
| Property | PropertyCard, PropertyGrid, FilterBar (+ mobile filter drawer), Gallery (swipe, lightbox, thumbnails), PropertyFacts, AmenityList, VerificationPanel, AvailabilityPill, ApproximateMap |
| Messaging | MessageThread, MessageBubble, MessageComposer, InternalNoteBox (staff, visually distinct) |
| Admin | QueueFilters, ReviewChecklist, TransitionActions (buttons derived from allowed actions returned by API), LedgerTable |
| Complaints | ReportForm (public), ComplaintForm (client), ComplaintStatusCard (own), InvestigationPanel (findings, evidence reviewed, outcome, actions), HoldBanner (precautionary hold with due date) |
| Assistant | AssistantLauncher, AssistantPanel, AssistantMessage (plain text / safe markdown), SourceChips, AssistantDisclosure, TypingIndicator, **HandoffCard** (CallButton `tel:` link, hours + open/closed pill, "Message our team", "Report a listing"), KnowledgeArticleEditor (admin) |

## 4. Patterns

**Forms.** Labels always visible; errors appear under the field and in a summary on submit; server `details[].field` maps to fields; submit button shows loading and disables double submit; unsaved-changes warning on long forms; multi-step landlord form saves each step server-side (draft).

**Lists.** Filters are URL-synced (shareable, back-button safe). Page size 20. Empty, loading (skeleton) and error states are mandatory for every list.

**Tables (admin).** Sticky header, sortable columns only where the API supports `sort`, row click opens detail, status shown by `StatusBadge`.

**Destructive actions.** `ConfirmDialog` with explicit consequence text; reason required where the API requires `reason`.

**Permission-aware UI.** Hide or disable actions the user's role cannot perform for clarity; the backend is the real control. A `403` renders the standard Forbidden page.

**Error handling (unknown codes included; contract §2.4).** One `ApiError { status, code, message, details, requestId }` type; `code` is a plain `string`, never a closed union. Decide by HTTP status first, then add special handling for codes the UI knows. Unknown code → status default + `error.message`.

| Situation | UI |
|---|---|
| `422`/`400`/`409` | Field errors under fields; others in the form summary; known `VERSION_CONFLICT` → "This was changed by someone else — reload" |
| `401` | One silent refresh if `TOKEN_EXPIRED`; otherwise login with return URL |
| `403` | Forbidden page (route) or toast (action) |
| `404` | Not-found state |
| `413`/`415` | Message on the uploader |
| `429` | Message, disabled action, countdown from `Retry-After` |
| `5xx`, `UPSTREAM_ERROR`, `NETWORK_ERROR`, `TIMEOUT`, or an unrecognised code | "Something went wrong. Try again." + `Ref: {requestId}` + retry button; never raw JSON or stack text |
| Assistant failure | Never an error screen — shows the handoff card with the call line |

## 5. Trust and compliance copy rules

- **Verification badge** text: `Verified on {date}` with a link/popover listing the verified scope (from API `verification.scope`). Popover must show: *"Verification confirms the checks listed. It is not a guarantee of legal title."*
- Never use the words *guaranteed*, *legally cleared*, or *100% safe*.
- **Off-platform warning** (inquiry thread, appointment, transaction screens): *"Keep all conversations and payments on {Platform}. We will never ask you to pay into a personal account."*
- **Fee display:** *"Service fee: ₦X (2% of annual rent). Paid by you. Covers …"* — the sentence parts come from API fields; if the API cannot supply the explanation, the screen does not show the amount.
- **Inspection fee:** must show refundable/credit rules before any action that implies payment (BR-04).
- Landlord contact details never appear on any page a client can open; UI copy says "our team will arrange this for you".
- **Assistant disclosure** (shown at the start of every conversation): *"I'm an AI assistant. I can answer common questions, but I can make mistakes. For payments, legal questions or complaints, please call us."*
- **Handoff copy:** *"I can't help with this one, but our team can. Call {display_phone} ({hours_text})."* The call button is always visible and is a real `tel:` link; when the line is closed show *"We're closed right now — opens {next opening}. You can message our team and we'll reply."*
- The assistant never uses words that imply authority it lacks: no "guaranteed", "legally cleared", "your refund is approved", "I have booked".
- **Report form:** *"Reports are reviewed by our team before any action is taken. We keep your details private and never share them with the landlord. Don't include ID, card or bank details."*
- **Report confirmation:** *"Thanks — reference {reference}. We'll review it. We can only follow up if you gave contact details."* Never say a listing is "scam" or "fraudulent" on any public page.

## 6. Formatting

| Item | Rule |
|---|---|
| Money | Shared `formatMoney()`, `formatMoneyCompact()`, `parseMoneyInput()`; rules and test vectors in §6.1 and `docs/API_CONTRACT.md` §2.10 |
| Dates | Convert UTC → `Africa/Lagos`; `5 Nov 2026`, `5 Nov 2026, 10:30` ; relative times only in message threads |
| Phone | Display local `0801 234 5678`, send E.164 |
| Counts | "3 bed · 3 bath" |

### 6.1 Money display conventions (binding; vectors in `docs/API_CONTRACT.md` §2.10)

| Rule | Detail |
|---|---|
| Source of truth | API sends integer kobo + `currency: "NGN"`; the UI never receives or builds formatted strings from the server |
| Symbol and grouping | `₦` directly before digits, comma thousands, locale `en-NG`: `₦1,500,000` |
| Decimals | Hidden when kobo = 0; exactly two when kobo ≠ 0 (`₦1,500,000.50`); never `.00` |
| Full vs compact | **Full** on price cards, detail pages, fee breakdowns, ledgers, anything involving a decision or payment. **Compact** (`₦850K`, `₦3.5M`) only in filter chips, chart axes and KPI tiles, with full amount in tooltip + `aria-label` |
| Rent period | `₦3,500,000 /year` or `/month` (muted, same line); sale has no suffix; "negotiable" is a separate badge |
| Input | `MoneyInput`: naira with optional commas, max 2 decimals, string-based conversion to kobo, inline errors `max_decimals` / `invalid_format`; no spinner arrows; numeric keyboard on mobile (`inputmode="decimal"`) |
| Ranges | `₦2,000,000 – ₦5,000,000` (en dash, spaces); open-ended `from ₦2,000,000` / `up to ₦5,000,000` |
| Fees | Always show payer, basis and period beside the amount ("Service fee ₦1,000,000 — 2% of the sale price, paid by you") using API text fields, never client arithmetic |
| Refund/credit | Positive amount plus a text label ("Refunded", "Credited") — no minus signs or red-only signalling |
| Percentages | `2%`, `2.5%` |
| Accessibility | Screen-reader text spells out naira: "3,500,000 naira per year" |
| Tests | A formatter test file reproduces every vector in the contract; adding a vector there requires adding it here |

## 7. Status → visual mapping

| Domain | Status → badge tone |
|---|---|
| Property | `draft` neutral · `submitted` info · `in_review` info · `changes_requested` warning · `approved` primary · `published` success · `unpublished` neutral · `rejected` danger · `archived` neutral |
| Availability | `available` success · `under_offer` warning · `unavailable` neutral |
| Inquiry | `new` info · `in_progress` primary · `qualified` primary · `inspection_scheduled` primary · `negotiating` warning · `closed_won` success · `closed_lost` neutral · `spam` danger |
| Appointment | `proposed` info · `confirmed` success · `reschedule_requested` warning · `completed` neutral · `cancelled_*` danger · `no_show` danger |
| Transaction | `open` info · `offer_made` primary · `terms_agreed` primary · `fees_invoiced` warning · `completed` success · `cancelled` neutral |
| Complaint | `new` danger · `triage` warning · `investigating` primary · `resolved` success · `dismissed` neutral |

Every badge has a text label; colour is never the only signal.

## 8. Page templates and route map

| Group | Route | Page | Phase |
|---|---|---|---|
| Public | `/` | Homepage | FE-4.13 |
| Public | `/properties` | Search | FE-4.11 |
| Public | `/properties/[slug]` | Detail | FE-4.12 |
| Public | `/list-your-property` | Landlord submission (multi-step) | FE-4.10 |
| Public | `/contact` | Speak to our team (login required to send) | FE-5.6 |
| Public | `/report` | Report a suspicious listing | FE-6.16 |
| Public | `/policies/terms`, `/privacy`, `/fees`, `/verification`, `/refunds` | Policy pages | FE-6.26 |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth | FE-3.5 |
| Client | `/account/inquiries`, `/account/inquiries/[id]` | Inquiries + thread | FE-5.7 |
| Client | `/account/appointments` | Inspections | FE-6.5 |
| Client | `/account/transactions` | Transaction summary | FE-6.11 |
| Client | `/account/notifications` | Notification centre (Could) | FE-6.20 |
| Admin | `/admin` | Dashboard | FE-6.24 |
| Admin | `/admin/properties`, `/admin/properties/[id]` | Review queue and verification | FE-4.14 |
| Admin | `/admin/landlords` | Landlord directory | FE-4.14 (list) |
| Admin | `/admin/inquiries`, `/admin/inquiries/[id]` | Pipeline | FE-5.8 |
| Admin | `/admin/clients`, `/admin/clients/[id]` | Client directory | FE-5.9 |
| Admin | `/admin/appointments` | Appointments | FE-6.4 |
| Admin | `/admin/transactions`, `/admin/transactions/[id]` | Transactions and fees | FE-6.10 |
| Admin | `/admin/complaints`, `/admin/complaints/[id]` | Complaints and investigation | FE-6.16 |
| Client | `/account/complaints`, `/account/complaints/new` | My complaints, file a complaint | FE-6.16 |
| Admin | `/admin/knowledge`, `/admin/assistant`, `/admin/settings` | Knowledge articles, conversation review, call line and hours | FE-6.33 |
| Global | Assistant launcher (all public and client pages) | Chat widget | FE-6.32 |
| Admin | `/admin/users` | Staff management (admin only) | FE-3.8 |

## 9. Key screen requirements

**Search (`/properties`).** Filter bar (location combobox, budget range, type, beds, baths, furnishing, amenities, rent/buy, availability) in a left column on desktop and a drawer on mobile; sort control; result count; PropertyCard grid; pagination; empty state with "clear filters"; every filter reflected in the URL.

**Detail (`/properties/[slug]`).** Gallery; title; price with period and terms; extra charges list; neighbourhood + approximate map; facts; amenities; verification panel (date + scope + disclaimer); availability pill with *"Availability last confirmed {date}"*; sticky CTA "Express interest / Request inspection" (login gate).

**Landlord form.** Steps: Contact → Property → Pricing → Features → Photos & documents → Review & consent. Clear explanation that contact details stay private. Draft saved server-side.

**Admin property review.** Left: submitted data and documents (signed URLs); right: verification checklist, landlord approval form, and transition actions. Actions shown are those the API allows for the current status.

**Inquiry thread.** Chronological bubbles, composer, off-platform warning banner, staff view has an internal-notes panel that is visibly different and cannot be confused with a reply.

**Assistant widget.** Floating launcher bottom-right (above mobile browser chrome), opens a panel (full-screen sheet at 360 px). Starts with the AI disclosure. Messages are plain text or safe markdown — **never raw HTML**; sources appear as chips linking to the article or listing. A persistent "Call us" link sits in the panel header at all times (not only after a handoff). The **HandoffCard** replaces the input when a handoff is returned: primary action Call (`tel:`), secondary "Message our team" (login if needed; creates an inquiry), tertiary "Report a listing" when relevant. Rate-limit (`429`), offline and provider-failure states all show the same card. Focus moves to new assistant messages (`aria-live="polite"`); Esc closes; launcher and panel work by keyboard.

**Report / complaint forms.** Single-column forms with the minimum fields only (PRD §5.6), a visible privacy sentence, character counters for description, optional contact with the "we can't follow up without it" hint, evidence uploader (max 3), a hidden honeypot field, and a confirmation screen with the reference number. The admin investigation screen shows the allegation, subject, evidence, history, an investigation panel (findings, evidence reviewed, outcome, actions), and a hold banner with the review deadline.

## 10. Accessibility checklist (applies to every UI task)

- Keyboard reachable and operable; visible focus ring.
- Form fields have programmatic labels, errors linked with `aria-describedby`.
- Images have alt text from the API or empty alt when decorative.
- Contrast verified; no colour-only status.
- Modals trap focus and restore it on close.
- Page `<title>` and one `<h1>` per page; landmarks used.
- axe check passes in Playwright for the page.

## 11. Data the UI needs from the API (for backend review)

| Screen | Needed fields | Contract reference |
|---|---|---|
| PropertyCard | title, slug, price+period, location (neighbourhood, hint), beds, baths, furnishing, availability, is_verified, verified_at, cover_image | §4.5 `PropertySummary` |
| Detail | + description, payment_terms, extra_charges, amenities, media, approximate_location, verification (scope, disclaimer), last_availability_confirmed_at | §4.5 |
| Admin transition buttons | allowed actions for current status — **gap:** add `allowed_actions: string[]` to `AdminPropertyDetail` (proposed contract change, J-4.1) | §4.6 |
| Forms | validation limits (lengths, counts) | §4.4 limits; GET `/taxonomy` |
| Assistant | `support` block (phone, hours, `is_open_now`), disclosure, message `sources`, `handoff.options` | §4.9 |
| Complaints | reference, status, `public_note`, investigation fields, allowed actions per role | §4.8 |

## 12. Definition of done for a UI task

Matches this document; responsive at 360, 768 and 1280 px; loading/empty/error states; a11y checklist; unit/component tests; no TEMP-MOCK for accepted features; uses shared formatters; no business rules in components.
