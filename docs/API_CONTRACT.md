# API Contract

**Contract version:** `0.3.0` · **Status:** Draft (conventions and auth/property sections become `Agreed` in J-1.3 and J-4.1) · **Joint ownership**

Neither developer may change this file alone. See §1.

## 1. Change protocol

1. Open a PR that touches only `docs/API_CONTRACT.md` (plus `docs/DATABASE_SCHEMA.md` if the data model is affected). CODEOWNERS requires **both** developers.
2. Bump the version (patch: clarification; minor: additive; major: breaking), add a line to the changelog (§12), and set the endpoint status.
3. Breaking changes (removed/renamed field, changed type or meaning, changed status code, tightened validation, changed permission) additionally need an ADR in `docs/DECISIONS.md`.
4. Implementation PRs reference the contract version they implement. A PR that changes request/response behaviour without a matching contract change is rejected in review.
5. Endpoint status values: `Draft` → `Agreed` → `Implemented` → `Integrated`. Frontend may mock only `Agreed` or later. A feature is accepted only when its endpoints are `Integrated`.

## 2. Conventions

### 2.1 Basics
- Base path: `/api/v1`. Content type: `application/json; charset=utf-8` (uploads: `multipart/form-data`).
- Property names: `snake_case`. Enum values: `snake_case` strings.
- IDs: UUID strings. Properties are also addressed publicly by `slug`.
- Timestamps: ISO 8601 UTC with `Z` (e.g. `2026-11-05T09:30:00Z`). Dates: `YYYY-MM-DD`. The UI formats in Africa/Lagos.
- Money: `{ "amount": 150000000, "currency": "NGN" }` — `amount` is an **integer in kobo** (₦1,500,000 → `150000000`). Rent prices add `"period": "year" | "month"`; sale prices use `"period": "one_time"`. Full currency and formatting rules, with test vectors: §2.10.
- Phone numbers: E.164 (`+2348012345678`); the server normalises Nigerian local formats. Emails are lower-cased.
- Single resource: `{ "data": { … } }`. Collection: `{ "data": [ … ], "meta": { … } }`. No bare arrays or bare objects.
- Every response carries `X-Request-ID`.
- Unknown request fields are rejected (`422`), never silently ignored.
- `PATCH` is partial update. Editable resources carry `version` (integer); the client sends it back, and a mismatch returns `409 CONFLICT`.

### 2.2 Authentication
- Bootstrap anonymous forms with `GET /auth/csrf` → `200 { data: { csrf_token } }` and the signed readable cookie. It requires no session. Login/register/reset still require the cookie/header pair and an exact configured `Origin`; there is no CSRF exemption for sign-in.
- Cookie sessions (ADR-003): `access_token` (httpOnly, `Secure`, `SameSite=Lax`, 15 min), `refresh_token` (httpOnly, path `/api/v1/auth`, 14 days), `csrf_token` (readable cookie).
- Unsafe methods require header `X-CSRF-Token: <csrf_token cookie value>`; otherwise `403 CSRF_FAILED`.
- Missing/invalid session → `401 UNAUTHENTICATED`; expired access token → `401 TOKEN_EXPIRED` (client refreshes once).
- The API is same-origin through the Next.js `/api` rewrite; CORS is disabled in production.

### 2.3 Authorization
Roles: `client`, `staff`, `admin` (+ anonymous). Default deny. The matrix in §5 is enforced by automated tests for every protected endpoint. Object-level rules (a client only sees their own inquiries) return `404 NOT_FOUND` rather than `403` when revealing existence would leak data.

### 2.4 Error envelope
All non-2xx responses (including framework-generated ones) use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "price.amount", "code": "min_value", "message": "Must be greater than 0." }
    ],
    "request_id": "01JABCDEF..."
  }
}
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request (bad JSON, bad query syntax) |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` | No/invalid/expired session |
| 403 | `FORBIDDEN`, `CSRF_FAILED` | Authenticated but not allowed |
| 404 | `NOT_FOUND` | Resource missing or hidden |
| 409 | `CONFLICT`, `INVALID_STATE_TRANSITION`, `VERSION_CONFLICT` | State or version conflict |
| 413 | `PAYLOAD_TOO_LARGE` | Upload over limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Disallowed file type |
| 422 | `VALIDATION_ERROR` | Field validation failed (`details` populated) |
| 429 | `RATE_LIMITED` | Includes `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Never includes internals; use `request_id` to trace |
| 503 | `SERVICE_UNAVAILABLE` | Dependency down or maintenance; may include `Retry-After` |

`details[].field` uses dot paths and array indexes (`amenities[2]`). `details[].code` is a stable machine code (`required`, `min_value`, `max_length`, `invalid_format`, `not_unique`, `invalid_choice`…). `message` is human-readable English and safe to show.

**Unknown and future codes (the code set is open).** The table above is the registry of codes the server may emit today. New codes may be added in a *minor* contract version and are **not** a breaking change, so clients must never assume the list is exhaustive and must never crash, blank the screen, or show a raw payload on an unrecognised code.

Client handling order:
1. **HTTP status class decides the base behaviour.** `400/409/422` show `error.message` inline (field errors at their fields); `401` → at most one refresh attempt when the code is `TOKEN_EXPIRED`, otherwise go to login with a return URL; `403` → Forbidden page or toast; `404` → Not-found state; `413/415` → upload message; `429` → show the message, disable the action and wait for `Retry-After`; `5xx` → generic "Something went wrong" with the `request_id` and a retry action.
2. **A known `code` may add special handling** (e.g. `TOKEN_EXPIRED` → refresh, `VERSION_CONFLICT` → "reload and re-apply" prompt).
3. **An unknown `code`** is handled exactly as its HTTP status in step 1 and shows `error.message`; the unknown code is logged to the console/monitoring with the `request_id`.
4. **An unknown `details[].code`** still shows `details[].message` at `details[].field`; if the field is not on the form, the message goes into the form summary.
5. If `message` is missing or empty (should not happen), fall back to a status-based generic message.

**Failures that are not envelopes** (HTML 502/503/504 from a proxy, invalid JSON, network error, timeout, aborted request): the client synthesises `ApiError { status (0 if none), code: "UPSTREAM_ERROR" | "NETWORK_ERROR" | "TIMEOUT", message: <generic>, requestId: <X-Request-ID if present> }`. These three codes are **client-side only** and are never sent by the server.

**Server rules.** Every code the backend emits must be in the registry above (a test asserts this); codes are never removed or repurposed (that would be breaking); unhandled exceptions become `INTERNAL_ERROR` with no internals; `message` is always present; `details` is always an array (possibly empty).

### 2.5 Pagination
Query: `page` (1-based, default `1`), `page_size` (default `20`, max `100`).

```json
{
  "data": [ ],
  "meta": { "page": 1, "page_size": 20, "total_items": 134, "total_pages": 7 }
}
```
Out-of-range pages return an empty `data` with correct `meta` (not an error).

### 2.6 Filtering, search, sorting
- Flat query parameters. Multi-value filters are comma-separated (`property_type=apartment,duplex`). Range filters use `_min` / `_max` suffixes (`price_min`, `price_max`, in kobo).
- `q` is free-text search over allowed fields (documented per endpoint).
- `sort` takes a comma-separated list; prefix `-` for descending (`sort=-published_at,price`). Only fields listed per endpoint are accepted; others return `422`.
- Unknown filter names return `422` (typos must not silently return unfiltered data).

### 2.7 Validation conventions
- The server is authoritative; the frontend mirrors rules for UX.
- Strings are trimmed; empty strings on optional fields are treated as `null`.
- Enumerations are validated against the lists in §4. Limits are stated per field below and surfaced in `details`.
- Password: 8–128 characters, not in a common-password list.
- Rate-limited public endpoints may also require a CAPTCHA token header `X-Captcha-Token` (decision pending in BE-4.4; absence is allowed while disabled).

### 2.8 Idempotency and concurrency
- `POST` endpoints that create inquiries and transactions accept optional header `Idempotency-Key`; repeats within 24 h return the original response.
- Editable resources use `version` (§2.1).

### 2.9 Uploads
`multipart/form-data`; allowed types and limits in §4.4. Files are never served from the API origin by path guessing; URLs in responses are absolute and either public-media URLs or short-lived signed URLs.

### 2.10 Currency and formatting conventions

**Wire format (API)**
- `currency` is ISO 4217 `NGN`. Any other value → `422` (`invalid_choice`). API money fields never contain a symbol, a formatted string, or decimals.
- `amount` is a JSON **integer number of kobo** (1 naira = 100 kobo): never a float, never a string. Prices are > 0; fees and ledger amounts are ≥ 0. There are no negative amounts: a refund is a positive amount with `direction: "out"`.
- Percentages are integer **basis points** (`rate_bps`; 200 = 2%).
- Only the server calculates fees: `fee_kobo = (base_kobo * rate_bps + 5000) // 10000` (round half up, integer arithmetic), then `min_fee`/`max_fee` are applied.

**Input (frontend forms).** `MoneyInput` shows naira, accepts optional thousands separators (`1,500,000`) and at most two decimals; other input shows an inline error (`max_decimals`, `invalid_format`). Conversion to kobo is **string-based** — never `Number(x) * 100`: `"1,500,000.50"` → `150000050`. Empty input → `null`.

**Display (frontend, one shared module, locale `en-NG`)**
- `₦` (U+20A6) immediately before the digits, no space; comma thousands separators; **no decimals when the kobo part is 0**, exactly two decimals otherwise (never `.00`).
- Use the **full** amount on price cards, detail pages, fee breakdowns, ledgers, receipts, and anywhere a decision or payment is involved.
- **Compact** form (`₦850K`, `₦3.5M`, `₦1.2B`) is allowed only in dense UI (filter chips, chart axes, KPI tiles) and must expose the full amount in a tooltip and `aria-label`. It rounds half up to one decimal, trims `.0`, and is never used below ₦1,000.
- Rent shows a `/year` or `/month` suffix; sale shows none. Screen-reader text: "3,500,000 naira per year".
- Percentages: `2%`, `2.5%` (trailing zeros trimmed). Dates, times and phone numbers: §2.1 and `docs/UI_DESIGN_SYSTEM.md` §6.

**Test vectors** — both sides must pass them (frontend as formatter tests, backend as schema and fee tests).

| kobo | Full | Compact | Screen reader |
|---|---|---|---|
| 0 | ₦0 | ₦0 | 0 naira |
| 99 | ₦0.99 | ₦0.99 | 99 kobo |
| 85000000 | ₦850,000 | ₦850K | 850,000 naira |
| 150000000 | ₦1,500,000 | ₦1.5M | 1,500,000 naira |
| 150000050 | ₦1,500,000.50 | ₦1.5M | 1,500,000 naira and 50 kobo |
| 5000000000 | ₦50,000,000 | ₦50M | 50,000,000 naira |

| Input text | Result |
|---|---|
| `1,500,000.50` | `150000050` |
| `850000` | `85000000` |
| `0.5` | `50` |
| `12.345` | error `max_decimals` |
| `1.5M` | error `invalid_format` |
| (blank) | `null` |

| Fee base (kobo) | rate_bps | Fee (kobo) | Note |
|---|---|---|---|
| 5000000000 | 200 | 100000000 | ₦50,000,000 × 2% = ₦1,000,000 |
| 12345 | 200 | 247 | 246.9 rounds up |
| 125 | 200 | 3 | 2.5 rounds half up |
| 124 | 200 | 2 | 2.48 rounds down |

## 3. Shared enumerations

| Name | Values |
|---|---|
| `role` | `client`, `staff`, `admin` |
| `listing_type` | `rent`, `sale` |
| `property_type` | `apartment`, `house`, `duplex`, `bungalow`, `terrace`, `studio`, `room` |
| `furnishing` | `furnished`, `semi_furnished`, `unfurnished` |
| `price_period` | `year`, `month`, `one_time` |
| `availability_status` | `available`, `under_offer`, `unavailable` |
| `property_status` | `draft`, `submitted`, `in_review`, `changes_requested`, `approved`, `published`, `unpublished`, `rejected`, `archived` |
| `landlord_relationship` | `owner`, `authorized_agent`, `developer`, `property_manager` |
| `media_kind` | `photo`, `video` |
| `document_kind` | `ownership_proof`, `authorization_letter`, `id_document`, `other` |
| `verification_method` | `desk_review`, `physical_inspection`, `both` |
| `check_code` | `identity`, `ownership_docs`, `location`, `price`, `features`, `availability` |
| `check_result` | `pass`, `fail`, `na` |
| `approval_method` | `phone`, `whatsapp`, `email`, `in_person` |
| `complaint_kind` | `suspicious_listing`, `dispute`, `service_complaint`, `other` |
| `complaint_reason` (reports) | `fake_listing`, `wrong_price`, `misleading_description`, `already_let_or_sold`, `unauthorised_agent`, `asked_to_pay_outside`, `other` |
| `complaint_status` | `new`, `triage`, `investigating`, `resolved`, `dismissed` |
| `complaint_outcome` | `substantiated`, `partially_substantiated`, `unsubstantiated`, `inconclusive` |
| `complaint_action` | `listing_corrected`, `listing_unpublished`, `listing_rejected`, `landlord_warned`, `landlord_blocked`, `client_warned`, `refund_recorded`, `no_action` |
| `complaint_dismiss_reason` | `duplicate`, `spam_or_abuse`, `out_of_scope`, `insufficient_information` |
| `handoff_reason` | `out_of_scope`, `low_confidence`, `user_requested`, `sensitive_topic`, `repeated_failure`, `service_unavailable` |
| `handoff_option_type` | `call`, `message_team`, `report_listing` |

Enumerations for inquiries, appointments and transactions are frozen in J-5.1, J-6.1, J-6.7. The complaint and assistant enumerations above are `Draft` and frozen in J-6.14 and J-6.28.

## 4. Endpoint specifications

### 4.1 Health
| Method | Path | Auth | Status |
|---|---|---|---|
| GET | `/health` | none | Draft→Agreed in J-1.3 |

`200 { "data": { "status": "ok", "version": "0.1.0", "database": "ok" } }` (`503` with envelope code `INTERNAL_ERROR` if the DB is unreachable).

### 4.2 Authentication
User object (`UserOut`):
```json
{ "id": "uuid", "email": "a@b.com", "full_name": "Ada Obi", "phone": "+2348012345678",
  "role": "client", "is_email_verified": false, "created_at": "2026-11-05T09:30:00Z" }
```

| Method | Path | Auth | Request | Success | Notes |
|---|---|---|---|---|---|
| POST | `/auth/register` | none | `{ full_name (2–150), email, phone, password, accepted_policies: [{ type: "terms"\|"privacy", version }] }` | `201 { data: UserOut }` + cookies | Creates a `client`; both policies required; `409 CONFLICT` if email exists (code `not_unique` on `email`) |
| POST | `/auth/login` | none | `{ email, password }` | `200 { data: UserOut }` + cookies | Generic failure: `401 UNAUTHENTICATED` "Invalid email or password." Rate-limited |
| POST | `/auth/refresh` | refresh cookie | — | `200 { data: UserOut }` + rotated cookies | Reuse of an old token → `401` and family revoked |
| POST | `/auth/logout` | any | — | `204` | Revokes the refresh family; clears cookies |
| GET | `/auth/me` | session | — | `200 { data: UserOut }` | |
| POST | `/auth/password-reset/request` | none | `{ email }` | `202 { data: { accepted: true } }` | Same response whether or not the email exists |
| POST | `/auth/password-reset/confirm` | none | `{ token, new_password }` | `204` | Token single-use, ≤ 1 h; revokes all sessions |
| POST | `/auth/email-verification/request` | session | — | `202` | Should (FR-AUTH-04) |
| POST | `/auth/email-verification/confirm` | none | `{ token }` | `204` | Should |

`GET /policies/current` → `{ data: { approved: boolean, policies: [{ type: "terms"|"privacy", version, url }] } }`. Registration accepts exactly the returned versions. Draft policy versions are usable for internal development; production registration is disabled until policies are approved. No final legal text is supplied by this endpoint.

`/auth/password-reset/confirm` also consumes an admin-created single-use invitation link (same ≤1-hour lifetime) to set the invited account's password. Tokens are hashed in the identity token table; the private email outbox contains only the delivery link. Verification tokens have purpose `verification` and cannot reset passwords. Logout is idempotent for absent/expired sessions but always CSRF-protected, revokes the refresh family when identifiable, and clears all three cookies. Deactivation and password reset revoke existing sessions. Every protected request uses the current database role/activity, not a role supplied by the browser or a stale JWT claim.

Admin user management (role `admin`):

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/admin/users` | filters `role`, `is_active`, `q`; sort `created_at`,`full_name`; paginated | `200` list of `UserOut` + `is_active` |
| POST | `/admin/users` | `{ full_name, email, phone?, role: "staff"\|"admin", temporary_password? }` | `201` (sends set-password email when no password) |
| PATCH | `/admin/users/{id}` | `{ full_name?, phone?, role?, is_active?, version }` | `200` (an admin cannot demote or deactivate themselves) |

Admin list/create/update responses use `UserOut` plus `is_active` and optimistic `version`. Temporary passwords follow the same 8–128/common-password rules; when omitted, an invitation is queued through the email abstraction. No live email is sent in development/outbox mode. Administrators cannot demote/deactivate themselves, and at least one active administrator must remain.

### 4.3 Taxonomy (public, cacheable)
`GET /taxonomy` → `200`
```json
{ "data": {
  "listing_types": ["rent","sale"],
  "property_types": ["apartment","house","duplex","bungalow","terrace","studio","room"],
  "furnishing": ["furnished","semi_furnished","unfurnished"],
  "availability_statuses": ["available","under_offer","unavailable"],
  "amenities": [ { "code": "generator", "label": "Generator", "category": "power" } ],
  "areas": [ { "id": "uuid", "state": "FCT", "city": "Abuja", "neighbourhood": "Wuse 2", "slug": "wuse-2" } ]
} }
```
Amenity codes and areas are data (seeded), final lists agreed in J-4.1.

### 4.4 Landlord submission (public)

Flow: create draft → upload files → submit. A property row exists from the draft step with status `draft`.

**Create:** `POST /landlord-submissions` (anonymous, rate-limited, CAPTCHA-ready)
```json
{
  "landlord": { "full_name": "Chief A. Okoro", "phone": "+2348012345678", "email": "a@b.com",
                "relationship": "owner" },
  "property": {
    "title": "3-bedroom flat, Wuse 2", "listing_type": "rent", "property_type": "apartment",
    "intended_use": "residential", "area_id": "uuid",
    "address_line": "12 Example Street, Wuse 2", "address_hint": "Off Example Crescent",
    "price": { "amount": 350000000, "currency": "NGN", "period": "year" },
    "price_negotiable": false,
    "payment_terms": "1 year upfront",
    "extra_charges": [ { "label": "Caution fee", "amount": 35000000, "currency": "NGN" } ],
    "bedrooms": 3, "bathrooms": 3, "furnishing": "unfurnished",
    "amenity_codes": ["generator","parking"],
    "availability_status": "available",
    "description": "…", "landlord_conditions": "No pets."
  },
  "accepted_policies": [ { "type": "terms", "version": "2026-11-01" }, { "type": "privacy", "version": "2026-11-01" } ]
}
```
`201 { "data": { "id": "uuid", "status": "draft", "upload_token": "…", "upload_token_expires_at": "…" } }`

Field limits: `title` 5–120; `description` 20–5000; `bedrooms` 0–20; `bathrooms` 0–20; `price.amount` ≥ 100000 (₦1,000); `extra_charges` ≤ 10 items.

**Upload file:** `POST /landlord-submissions/{id}/files` — header `X-Upload-Token`, multipart fields `file`, `kind` (`photo`, `video`, `ownership_proof`, `authorization_letter`, `id_document`, `other`), optional `caption`. `201 { data: { file_id, kind, size_bytes, status: "uploaded" } }`.
**Delete file:** `DELETE /landlord-submissions/{id}/files/{file_id}` (same token) → `204`.
Limits (OQ-13 defaults): photos JPEG/PNG/WebP ≤ 10 MB each (max 20); video MP4/WebM ≤ 100 MB (max 1); documents PDF/JPEG/PNG ≤ 10 MB each (max 10).

**Submit:** `POST /landlord-submissions/{id}/submit` (same token) → `200 { data: { id, status: "submitted", reference: "SUB-2026-000123" } }`. Fails `422` unless ≥ 5 photos and ≥ 1 evidence document.

The landlord receives the `reference` only. Landlord PII is stored privately (BR-03).

### 4.5 Public properties
Only properties with status `published` are returned (BR-01). The public schema contains **no** landlord data, exact address, coordinates beyond approximate, documents, or internal fields.

`PropertySummary`:
```json
{
  "id": "uuid", "slug": "3-bedroom-flat-wuse-2-7f3a",
  "title": "3-bedroom flat, Wuse 2",
  "listing_type": "rent", "property_type": "apartment",
  "price": { "amount": 350000000, "currency": "NGN", "period": "year" },
  "location": { "state": "FCT", "city": "Abuja", "neighbourhood": "Wuse 2", "address_hint": "Off Example Crescent" },
  "bedrooms": 3, "bathrooms": 3, "furnishing": "unfurnished",
  "availability_status": "available",
  "is_verified": true, "verified_at": "2026-10-20T10:00:00Z",
  "cover_image": { "url": "https://…", "thumb_url": "https://…", "alt": "Living room" },
  "published_at": "2026-10-21T08:00:00Z"
}
```

`PropertyDetail` = `PropertySummary` plus:
```json
{
  "description": "…", "payment_terms": "1 year upfront", "price_negotiable": false,
  "extra_charges": [ { "label": "Caution fee", "amount": 35000000, "currency": "NGN" } ],
  "amenities": [ { "code": "generator", "label": "Generator" } ],
  "media": [ { "id": "uuid", "kind": "photo", "url": "…", "thumb_url": "…", "alt": "…", "position": 0 } ],
  "approximate_location": { "lat": 9.07, "lng": 7.47, "radius_m": 500 },
  "verification": {
    "status": "passed", "verified_at": "2026-10-20T10:00:00Z",
    "method": "both",
    "scope": ["identity", "ownership_docs", "location", "price", "features"],
    "disclaimer": "Verification confirms the checks listed. It is not a guarantee of legal title."
  },
  "last_availability_confirmed_at": "2026-10-20T10:00:00Z"
}
```

| Method | Path | Notes |
|---|---|---|
| GET | `/properties` | Filters: `q` (title, description, neighbourhood), `listing_type`, `property_type` (multi), `state`, `city`, `area` (slug, multi), `price_min`, `price_max`, `bedrooms_min`, `bedrooms_max`, `bathrooms_min`, `furnishing` (multi), `amenities` (multi, **all** must match), `availability` (multi, default `available`). Sort: `published_at` (default `-published_at`), `price`, `verified_at`. Paginated `PropertySummary` |
| GET | `/properties/{slug}` | `200 { data: PropertyDetail }`; `404` for non-published |

### 4.6 Staff property management (roles `staff`, `admin`)

`AdminPropertyDetail` = `PropertyDetail` fields (computed from stored data, regardless of status) plus: `status`, `landlord` (`id`, `full_name`, `phone`, `email`, `relationship`), `address_line`, `latitude`, `longitude`, `landlord_conditions`, `documents[]` (`id`, `kind`, `signed_url`, `expires_at`, `review_note`), `verification_history[]`, `landlord_approval` (current or `null`), `status_history[]`, `assigned_staff`, `submitted_at`, `version`.

| Method | Path | Request / notes | Success |
|---|---|---|---|
| GET | `/admin/properties` | Filters: `status` (multi), `q`, `area`, `assigned_to`, `listing_type`, `stale_availability` (bool), `landlord_id`; sort `submitted_at`, `-updated_at`; paginated `AdminPropertySummary` | `200` |
| GET | `/admin/properties/{id}` | | `200 { data: AdminPropertyDetail }` |
| PATCH | `/admin/properties/{id}` | Any editable property field + `version`; recomputes nothing about verification but **invalidates the landlord approval if price or description changed** (response flags `approval_invalidated: true`) | `200` |
| POST | `/admin/properties/{id}/assign` | `{ staff_id }` | `200` |
| POST | `/admin/properties/{id}/transitions` | `{ action, reason?, version }`; actions: `start_review`, `request_changes` (reason required), `approve`, `publish`, `unpublish` (reason required), `reject` (reason required), `archive`, `reopen` (admin only) | `200 { data: { status } }`, `409 INVALID_STATE_TRANSITION` |
| PUT | `/admin/properties/{id}/verification` | `{ method, checks: [{ code, result, note?, evidence_document_id? }], scope_summary }` — saves a working record | `200` |
| POST | `/admin/properties/{id}/verification/complete` | `{ outcome: "passed"\|"failed" }` — `passed` requires `identity`, `ownership_docs`, `location`, `price`, `features` all `pass` (or `na` with a note) | `200` |
| POST | `/admin/properties/{id}/landlord-approval` | `{ approved_price: Money+period, description_approved: true, method, note?, approved_at }` — supersedes the previous approval | `201` |
| PATCH | `/admin/properties/{id}/availability` | `{ availability_status, confirmed_at? }` (defaults to now) | `200` |
| POST | `/admin/properties/{id}/media` | multipart as §4.4 (staff-uploaded) | `201` |
| PATCH | `/admin/properties/{id}/media/{media_id}` | `{ alt?, position?, is_cover? }` | `200` |
| DELETE | `/admin/properties/{id}/media/{media_id}` | | `204` |
| GET | `/admin/landlords` / `/admin/landlords/{id}` | Directory of landlord records and their properties | `200` |

**Listing transition table**

| From | Action | To | Guard |
|---|---|---|---|
| `draft` | (public submit) | `submitted` | ≥ 5 photos, ≥ 1 evidence document |
| `submitted` | `start_review` | `in_review` | |
| `in_review` | `request_changes` | `changes_requested` | reason |
| `changes_requested` | (landlord response recorded by staff) → `start_review` | `in_review` | |
| `in_review` | `approve` | `approved` | verification `passed` and current landlord approval |
| `in_review` / `submitted` / `changes_requested` | `reject` | `rejected` | reason |
| `approved` | `publish` | `published` | guards re-checked at publish time |
| `published` | `unpublish` | `unpublished` | reason |
| `unpublished` | `publish` | `published` | guards re-checked |
| any non-archived | `archive` | `archived` | |
| `archived` / `rejected` | `reopen` (admin) | `in_review` | reason |

Publishing also sets `published_at` and `verified_at` (from the latest passed verification).

### 4.7 Modules whose shapes are not yet frozen

These appear in the index so both developers can plan; **request/response shapes are `Draft` and must not be mocked or implemented** until the named freeze task is complete.

| Group | Endpoints (intent) | Roles | Freeze task |
|---|---|---|---|
| Inquiries (client) | `POST /inquiries`, `GET /inquiries`, `GET /inquiries/{id}`, `GET/POST /inquiries/{id}/messages` | client | J-5.1 |
| Inquiries (staff) | `GET /admin/inquiries`, `GET /admin/inquiries/{id}`, `POST …/assign`, `POST …/transitions`, `PUT …/qualification`, `GET/POST …/notes`, `POST …/messages` | staff, admin | J-5.1 |
| Clients (staff) | `GET /admin/clients`, `GET /admin/clients/{id}`, `PATCH /admin/clients/{id}` | staff, admin | J-5.1 |
| Appointments | `POST /admin/appointments`, `GET /admin/appointments`, `PATCH …/{id}`, `POST …/{id}/outcome`; `GET /appointments`, `POST /appointments/{id}/confirm\|cancel\|request-reschedule` | staff/admin; client | J-6.1 |
| Fees & transactions | `GET/PUT /admin/fee-rules`, `POST/GET /admin/transactions`, `GET /admin/transactions/{id}`, `POST …/events`, `POST …/ledger-entries`, `POST …/transitions`; `GET /transactions` (client summary) | staff/admin; admin for rules; client | J-6.7 |
| Complaints | Shapes proposed in §4.8 (still `Draft`) | public; client; staff/admin | J-6.14 |
| AI assistant, public config, knowledge base, settings | Shapes proposed in §4.9 (still `Draft`) | public; client; staff/admin | J-6.28 |
| Notifications | `GET /notifications`, `POST /notifications/{id}/read` | any authenticated | J-6.18 |
| Reports | `GET /admin/reports/kpis?from&to` | staff, admin | J-6.22 |
| Policies | Static pages; `GET /policies/current` returns current policy versions for consent | public | J-1.3 |

### 4.8 Complaints and suspicious-listing reports (proposal; `Draft` until J-6.14)

**Principles.** A report or complaint is an *unverified allegation* until staff conclude an investigation (BR-16). The reporter's identity is confidential (BR-17). Nothing permanent happens on an unverified report.

**Public report** — `POST /reports` (anonymous or signed-in; rate-limited; CAPTCHA-ready)
```json
{ "property_slug": "3-bedroom-flat-wuse-2-7f3a",
  "reason": "asked_to_pay_outside",
  "description": "The agent asked me to send the deposit to a personal account.",
  "reporter": { "name": "Ada", "email": "ada@example.com", "phone": "+2348012345678" },
  "website": "" }
```
| Field | Rule |
|---|---|
| `property_slug` | Required; must be a published listing (else `404`) |
| `reason` | Required; `complaint_reason` enum |
| `description` | Required; 20–2000 characters; plain text (HTML stripped); card-like numbers rejected (`sensitive_data`) |
| `reporter.name/email/phone` | Optional. If none is given the response says no follow-up is possible |
| `website` | Honeypot — must be empty, otherwise the request is silently discarded with a normal-looking `201` |

`201 { "data": { "id": "uuid", "reference": "CMP-2026-000123", "status": "new", "upload_token": "…", "upload_token_expires_at": "…" } }`. Duplicate (same user-or-IP-hash + property + reason within 24 h) → `409 CONFLICT`, detail code `duplicate_report`.

**Evidence (Should)** — `POST /reports/{id}/files` (header `X-Upload-Token`; multipart `file`) — up to 3 files, JPEG/PNG/PDF ≤ 5 MB each, private storage.

**Client complaint** — `POST /complaints` (signed-in)
```json
{ "kind": "dispute",
  "subject": { "type": "appointment", "id": "uuid" },
  "description": "…", "occurred_on": "2026-10-20", "desired_outcome": "Refund of the inspection fee" }
```
`subject.type` ∈ `property`, `appointment`, `transaction`, `general` (`id` null for `general`). An appointment or transaction that does not belong to the caller → `404`. `description` 20–4000; `desired_outcome` ≤ 500. `201` returns `id`, `reference`, `status`, `upload_token`.
`GET /complaints` and `GET /complaints/{id}` return the caller's own: `reference`, `kind`, `status`, `created_at`, `public_note` (a staff-written message; never investigation notes).

**Staff investigation** (roles `staff`, `admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/complaints` | Filters `status`, `kind`, `reason`, `assigned_to`, `property_id`, `outcome`, `overdue_first_response` (bool), `q`; sort `created_at`, `-created_at`; paginated |
| GET | `/admin/complaints/{id}` | Full record: reporter details, subject links, evidence (signed URLs), event history, count of other open reports on the same property or landlord |
| POST | `/admin/complaints/{id}/assign` | `{ staff_id }` |
| POST | `/admin/complaints/{id}/transitions` | `{ action, … , version }` — see table |
| PUT | `/admin/complaints/{id}/investigation` | `{ findings, evidence_reviewed, outcome, actions: [complaint_action], public_note?, version }` — saves a working record |

| From | Action | To | Guard |
|---|---|---|---|
| `new` | `start_triage` | `triage` | — |
| `new` / `triage` | `start_investigation` | `investigating` | assigned staff |
| `investigating` | `resolve` | `resolved` | `findings`, `evidence_reviewed`, `outcome` and ≥ 1 `action` present (`no_action` allowed) |
| `new` / `triage` / `investigating` | `dismiss` | `dismissed` | `dismiss_reason` |
| `resolved` / `dismissed` | `reopen` (admin) | `investigating` | reason |

Action permissions: staff may record `listing_corrected`, `landlord_warned`, `client_warned`, `refund_recorded`, `no_action`, and `listing_unpublished` as a **precautionary hold** (only for `fake_listing` or `asked_to_pay_outside`; sets `hold_review_due_at` = 2 business days; the unpublish is written to the property's status history with the complaint id). `listing_rejected` and `landlord_blocked` are **admin-only** and require outcome `substantiated` or `partially_substantiated`. The number of reports never triggers an action automatically.

**Reporter notification.** When a case is `resolved` or `dismissed` and a contact exists, an email via the outbox says only that the report was reviewed (and the `public_note`, if staff wrote one). It never names the landlord, quotes evidence, or states the outcome category.

**Privacy rules (enforced by tests)**
1. Reporter name, email, phone, user id and IP hash are returned only by `/admin/complaints*`.
2. No public or client endpoint exposes report counts, "reported" flags, or other people's reports.
3. Landlord-facing communication never includes reporter identity or paraphrased identifying detail.
4. Evidence is private; signed URLs expire in ≤ 15 minutes.
5. Raw IP addresses are never stored (salted SHA-256 only); descriptions are never logged.

### 4.9 AI assistant, public config, knowledge base, settings (proposal; `Draft` until J-6.28)

**Purpose.** Answer common questions from approved content, and hand off to humans — **always showing the call line** — when it cannot help. The assistant is read-only: it cannot create, change or approve anything except the explicit "message the team" handoff.

**Public config** — `GET /public-config` (anonymous, cacheable 60 s)
```json
{ "data": {
  "support": { "phone": "+2348000000000", "display_phone": "0800 000 0000",
    "hours_text": "Mon–Sat, 8:00–18:00 (WAT)", "timezone": "Africa/Lagos", "is_open_now": true },
  "assistant": { "enabled": true,
    "disclosure": "I'm an AI assistant. I can answer common questions, but I can make mistakes. For payments, legal questions or complaints, please call us." } } }
```

**Start conversation** — `POST /assistant/conversations` (anonymous or signed-in)
`201 { "data": { "id": "uuid", "token": "…" (anonymous only), "greeting": "…", "disclosure": "…", "support": { …as above } } }`
Anonymous callers send `X-Assistant-Token: <token>` on later calls; signed-in callers are identified by the session.

**Send message** — `POST /assistant/conversations/{id}/messages` `{ "content": "…" }` (1–1000 characters, one request in flight per conversation)
```json
{ "data": {
  "message": { "id": "uuid", "role": "assistant", "content": "…", "created_at": "…",
    "sources": [
      { "type": "article", "id": "uuid", "title": "How verification works", "url": "/policies/verification" },
      { "type": "property", "id": "uuid", "title": "3-bedroom flat, Wuse 2", "url": "/properties/3-bedroom-flat-wuse-2-7f3a" } ] },
  "handoff": null } }
```
When the assistant cannot or must not answer, `handoff` is present and the message content is the handoff text:
```json
"handoff": { "required": true, "reason": "out_of_scope",
  "message": "I can't help with this one, but our team can. Please call us.",
  "options": [
    { "type": "call", "phone": "+2348000000000", "display_phone": "0800 000 0000",
      "hours_text": "Mon–Sat, 8:00–18:00 (WAT)", "is_open_now": true },
    { "type": "message_team", "requires_login": true },
    { "type": "report_listing", "url": "/report" } ] }
```
Rules: the `call` option is **present in every handoff**; `report_listing` appears only for scam or fraud topics; `reason` is a `handoff_reason`. A provider failure, timeout or exhausted token budget returns `200` with `reason: "service_unavailable"` — the user never sees a server error from the assistant. Only a rate-limit breach returns `429` (the UI then shows the call line from `/public-config`).

**Other endpoints**
| Method | Path | Notes |
|---|---|---|
| GET | `/assistant/conversations/{id}` | History for the same token or user |
| POST | `/assistant/conversations/{id}/handoff/message-team` | Signed-in clients only. `{ summary? }` → creates a `general` inquiry (`source: "assistant"`) with the transcript attached as a staff-visible note → `201 { data: { inquiry_id } }`; anonymous → `401` |
| POST | `/assistant/messages/{id}/feedback` | Could. `{ helpful: bool, comment? }` |
| GET/POST | `/admin/knowledge-articles` | Staff: list/create (`title`, `body`, `category`, `language`) |
| PATCH | `/admin/knowledge-articles/{id}` | Staff edit with `version` |
| POST | `/admin/knowledge-articles/{id}/publish` / `unpublish` | **Admin** publishes |
| GET | `/admin/assistant/conversations` | Filters `handoff_reason`, `flagged`, `from`, `to`; transcript detail at `/{id}` |
| PATCH | `/admin/assistant/conversations/{id}` | `{ flagged, review_note }` |
| GET/PUT | `/admin/settings` | Read: staff/admin. Write (admin only): `support_phone` (E.164), `support_hours`, `assistant_enabled`, `assistant_daily_token_budget` |

**Safety policy (full text frozen in J-6.28; these rules are binding now)**
1. **Sources only.** Answers come only from published knowledge articles and public property data returned by the search tool. No match above the confidence threshold → handoff `low_confidence`.
2. **Never**: reveal landlord contacts, exact addresses or internal notes; give legal advice or title guarantees; confirm availability beyond the API value and its "last confirmed" date; negotiate prices or fees; state fees except from approved content; tell anyone to pay or give account details; judge or comment on a complaint; ask for or accept card, bank or ID numbers.
3. **Always hand off** (`out_of_scope`) for payments, refunds and disputes; legal questions; complaints and fraud claims (also offer `report_listing`); the status of a specific transaction, appointment or account; fee or price negotiation. `sensitive_topic` for distress or safety. `user_requested` when the user asks for a person. `repeated_failure` after two consecutive unhelpful turns.
4. **Output filter.** Any phone number or email in a draft answer other than the configured support contact causes the answer to be discarded and replaced by a handoff.
5. **Untrusted text.** User messages and retrieved article text are data, never instructions; attempts to change these rules are treated as `out_of_scope`.
6. **Disclosure.** Every conversation begins with the AI disclosure (BR-13).
7. **Logging.** Transcripts are stored for staff review with card-like numbers redacted; the LLM API key, prompts and model configuration exist only on the server.

## 5. Permission matrix (enforced by tests)

`A` = anonymous, `C` = client, `S` = staff, `Ad` = admin. ✓ = allowed, `own` = only own records, — = denied (`401` if unauthenticated, `403`/`404` otherwise).

| Endpoint group | A | C | S | Ad |
|---|---|---|---|---|
| `/health`, `/auth/csrf`, `/taxonomy`, `GET /properties*`, `/policies/current` | ✓ | ✓ | ✓ | ✓ |
| `/auth/register`, `/auth/login`, password reset | ✓ | ✓ | ✓ | ✓ |
| `/auth/me`, `/auth/refresh` | — | ✓ | ✓ | ✓ |
| `/auth/logout` (idempotent clear, CSRF required) | ✓ | ✓ | ✓ | ✓ |
| `/landlord-submissions*` | ✓ (token) | ✓ (token) | ✓ | ✓ |
| `/admin/properties*`, `/admin/landlords*` | — | — | ✓ | ✓ (`reopen` admin only) |
| `/admin/users*` | — | — | — | ✓ |
| `/inquiries*` (client) | — | own | — | — |
| `/admin/inquiries*`, `/admin/clients*` | — | — | ✓ | ✓ |
| `/admin/appointments*`, `/admin/transactions*` | — | — | ✓ | ✓ |
| `/admin/fee-rules` (write) | — | — | read | ✓ |
| `/appointments*`, `/transactions` (client) | — | own | — | — |
| `POST /reports`, `POST /reports/{id}/files` (token) | ✓ | ✓ | ✓ | ✓ |
| `POST /complaints`, `GET /complaints*` (own) | — | own | ✓ | ✓ |
| `/admin/complaints*`, `/admin/reports*` | — | — | ✓ (`listing_rejected`, `landlord_blocked`, `reopen`: admin only) | ✓ |
| `/notifications*` | — | own | own | own |
| `GET /public-config`, `POST /assistant/conversations`, `…/messages`, `GET …/{id}` | ✓ (token) | ✓ | ✓ | ✓ |
| `POST /assistant/conversations/{id}/handoff/message-team` | — | ✓ | — | — |
| `/admin/knowledge-articles*`, `/admin/assistant/*` | — | — | ✓ (publish: admin only) | ✓ |
| `/admin/settings` | — | — | read | ✓ (write) |

Field-level privacy matrix (BR-03, BR-11):

| Data | Visitor | Client | Staff/Admin |
|---|---|---|---|
| Landlord name/phone/email | No | No | Yes |
| Exact address, coordinates | No | After appointment confirmed (exact address only) | Yes |
| Ownership/ID documents | No | No | Yes (signed URL) |
| Verification scope + date | Yes | Yes | Yes |
| Internal inquiry notes | No | No | Yes |
| Client phone/email | No | Own | Yes |
| Reporter identity and IP hash | No | No | Yes |
| Investigation findings, outcome, evidence | No | No (own complaint: `status` + `public_note` only) | Yes |
| Assistant transcripts | Own conversation (token) | Own | Yes |

## 6. Rate limits (initial values, tunable)

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 10 / 15 min per IP + 5 / 15 min per account |
| `POST /auth/register` | 5 / hour per IP |
| `POST /auth/password-reset/request` | 5 / hour per IP and per email |
| `POST /landlord-submissions` and file uploads | 5 submissions / day per IP; 60 uploads / hour per token |
| `POST /reports` | 10 / day per IP and 3 / day per IP per property |
| `POST /complaints` | 5 / day per user |
| `POST /reports/{id}/files`, complaint files | 10 / hour per token; max 3 files per case |
| `POST /assistant/conversations` | 5 / day per IP (anonymous); 20 / day per user |
| `POST /assistant/conversations/{id}/messages` | 20 / hour per IP (anonymous); 60 / hour per user; ≤ 1000 characters; 1 in flight per conversation |
| Assistant daily token budget | Set by admin; exhaustion → handoff `service_unavailable` (not an error) |
| `POST /inquiries` | 20 / day per client |

## 7. OpenAPI

The backend exports `backend/openapi.json` (BE-2.4). Its method + path set must equal the **Endpoint index** below; CI fails on drift. The frontend generates TypeScript types from it (FE-2.5).

## 8. Endpoint index and status

| Endpoint | Status |
|---|---|
| GET /health | Implemented (local PostgreSQL verification) |
| GET /auth/csrf, POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/me | Integrated (real FastAPI/PostgreSQL browser tests; PR review pending) |
| POST /auth/password-reset/request, POST /auth/password-reset/confirm | Integrated (private outbox; SMTP configurable) |
| POST /auth/email-verification/request, POST /auth/email-verification/confirm | Integrated (private outbox; SMTP configurable) |
| GET/POST /admin/users, PATCH /admin/users/{id} | Integrated for list/create/activation; role updates API-tested |
| GET /taxonomy | Draft |
| GET /policies/current | Integrated metadata (no final legal content) |
| POST /landlord-submissions, POST /landlord-submissions/{id}/files, DELETE /landlord-submissions/{id}/files/{file_id}, POST /landlord-submissions/{id}/submit | Draft |
| GET /properties, GET /properties/{slug} | Draft |
| GET /admin/properties, GET /admin/properties/{id}, PATCH /admin/properties/{id}, POST …/assign, POST …/transitions, PUT …/verification, POST …/verification/complete, POST …/landlord-approval, PATCH …/availability, POST/PATCH/DELETE …/media | Draft |
| GET /admin/landlords, GET /admin/landlords/{id} | Draft |
| POST /reports, POST /reports/{id}/files, POST/GET /complaints, GET /complaints/{id}, GET /admin/complaints, GET /admin/complaints/{id}, POST …/assign, POST …/transitions, PUT …/investigation | Draft (shapes proposed, §4.8) |
| GET /public-config, POST /assistant/conversations, GET /assistant/conversations/{id}, POST …/messages, POST …/handoff/message-team, POST /assistant/messages/{id}/feedback | Draft (shapes proposed, §4.9) |
| GET/POST/PATCH /admin/knowledge-articles, POST …/publish, POST …/unpublish, GET /admin/assistant/conversations, GET/PATCH …/{id}, GET/PUT /admin/settings | Draft (shapes proposed, §4.9) |
| Inquiries, clients, appointments, fees/transactions, notifications, reports (KPIs) | Draft (intent only, §4.7) |

## 9. Examples

**Validation error (422)**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "One or more fields are invalid.",
  "details": [ { "field": "landlord.phone", "code": "invalid_format", "message": "Enter a valid Nigerian phone number." } ],
  "request_id": "01JABCDEF" } }
```

**Paginated list**
```json
{ "data": [ { "id": "uuid", "slug": "…", "title": "…" } ],
  "meta": { "page": 2, "page_size": 20, "total_items": 41, "total_pages": 3 } }
```

**Illegal transition (409)**
```json
{ "error": { "code": "INVALID_STATE_TRANSITION", "message": "Cannot publish a property that is not approved.",
  "details": [ { "field": "action", "code": "invalid_choice", "message": "publish is not allowed from status in_review." } ],
  "request_id": "01JABCDEF" } }
```

## 10. Frontend integration notes

- Show `error.message` for general errors and map `details[].field` to form fields.
- Do not compute prices, fees, visibility or permissions; display API values.
- Format kobo → ₦ and UTC → Africa/Lagos in one shared formatter (see `docs/UI_DESIGN_SYSTEM.md`).

## 11. Backend integration notes

- Public schemas and admin schemas are separate Pydantic models; add a privacy-leak test for every public endpoint.
- Return `version` on every editable resource.
- Return `X-Request-ID` and include it in every error.

## 12. Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1.0 | 2026-10-23 | Initial draft from PRD v0.1 | pending (J-1.3) |
| 0.3.0 | 2026-10-31 | User-directed authentication integration: password minimum 8 (formerly 10), CSRF bootstrap, identity lifecycle and admin version clarification (CR-AUTH-001) | Developer 2 session; user override, frontend review pending |
| 0.2.0 | 2026-10-24 | Team review: currency/formatting conventions §2.10; unknown error codes and non-envelope failures §2.4; code 503; complaint minimum fields, rate limits, privacy and investigation workflow §4.8; AI assistant, public config, knowledge base, settings §4.9; new enums, rate limits, matrix rows | pending (J-1.3) |
