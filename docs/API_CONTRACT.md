# API Contract

**Contract version:** `0.15.0` · **Status:** Auth/property/inquiry/appointment/complaint sections integrated locally; remaining modules Draft · **Joint ownership**

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
| `complaint_action` | `listing_corrected`, `listing_unpublished`, `listing_rejected`, `landlord_warned`, `landlord_blocked`, `client_warned`, `no_action` |
| `complaint_dismiss_reason` | `duplicate`, `spam_or_abuse`, `out_of_scope`, `insufficient_information` |
| `handoff_reason` | `out_of_scope`, `low_confidence`, `user_requested`, `sensitive_topic`, `repeated_failure`, `service_unavailable` |
| `handoff_option_type` | `call`, `message_team`, `report_listing` |

Enumerations for inquiries, appointments and transactions are frozen in J-5.1, J-6.1, J-6.7. Complaint enumerations are frozen by CR-COMPLAINT-001 with refund actions deferred; assistant enumerations remain Draft until J-6.28.

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

The landlord receives only the minimal receipt above. Landlord PII is stored privately (BR-03).

**BE-4.4 implementation / CR-LANDLORD-001:** all four §4.4 endpoints are Implemented. Anonymous callers still bootstrap `/auth/csrf` and send the signed cookie/header plus the exact configured Origin on mutations. `X-Upload-Token` is property-scoped, expires after 24 hours, and authorizes file mutations/submit only, never read access. Upload, removal and submit attempts share the 60/hour/token mutation budget. No query parameters are accepted. Unknown JSON/form fields and duplicate multipart field names are rejected. One file plus kind and optional caption (≤200 characters) per multipart request; content is inspected, not trusted by MIME label.

Draft JSON is bounded to 64 KiB before parsing; multipart reception to 100 MiB plus 64 KiB overhead, with per-file limits enforced by the media service. Oversize returns 413. Multipart structural errors (including too many parts) return 400. No file data, storage keys, landlord contact, internal review flags or exact address appear in receipts/errors. All receipts are no-store.

Phone is normalized from Nigerian local form to E.164. `email` is optional. Active area and amenity values are required; duplicate amenity codes are rejected (max 50). Amounts must be integer kobo (not bool/float/string), fitting signed bigint; extra charge amounts are nonnegative NGN. Sale requires `one_time`; rent requires `month`/`year`. Address 5–500 characters, hint ≤160, payment terms ≤1000, landlord conditions ≤2000, charge label 1–100. Evidence means `ownership_proof` or `authorization_letter`; ID/other files alone do not prove ownership or authority.

Completed submissions **always enter `submitted`**, per owner decision 2026-11-02. Matching a blocked contact adds only a private staff-review note/audit flag, without auto-rejecting or auto-moving to `in_review`. The reference is persisted and unique. Retrying submit with a valid token returns the original submitted receipt without adding history or moving the workflow backward. File changes after submission are rejected with 409. Removing a cover photo picks another remaining photo as cover.

The CAPTCHA hook is disabled by default. When enabled it requires the server-configured verifier and `X-Captcha-Token`; missing/invalid challenge returns 403, missing/unavailable verifier 503. A provider adapter must be configured before enabling. Private object deletions are queued transactionally and retried by `cleanup-files`; 204 confirms removal from the submission, while unreachable storage may be purged asynchronously.

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

**BE-4.7 / CR-PUBLIC-BROWSE-001 (v0.8.0, additive):** public taxonomy, search/detail and `GET /property-media/{media_id}?thumbnail=false` implemented. BE-4.9 clarification: required identity/ownership/location/price/features checks must also exist, all checks must pass or carry a nonblank NA note, and referenced evidence must belong to the property. BR-01 is rechecked on every public read: published status, current passed verification with completion timestamp, and non-superseded description approval matching the current price/period with a non-future approval timestamp. Noneligible detail/media returns 404 even to staff; use admin endpoints for private review. Public schemas are independent of admin DTOs. Optional absent cover, thumbnail, alt, payment terms, approximate location and confirmation dates are null. Verification methods use desk_review/physical_inspection/both. Approximate coordinates round to two decimal places and declare radius_m=1000; raw coordinates are never returned.

Search defaults page=1/page_size=20, availability=available, sort=-published_at. Empty optional text is ignored; unknown/repeated query keys, unknown/duplicate enum/area/amenity/sort values and inverted ranges return 422. Maximum q=150, state/city=100, multi area/amenity strings=2000, price bounds 0..9007199254740991 kobo, bedroom/bathroom bounds 0..20. q is case-insensitive literal substring over title/description and neighbourhood (SQL wildcards escaped). State/city compare case-insensitively, area uses active slugs; amenity filters require every requested active code. Sorts accept multiple contract fields with stable ID tie-breaks and nulls last. Out-of-range page returns empty data/correct meta. Taxonomy returns active areas/amenities only; no private staff references.

Media URLs expose media IDs only, never evidence IDs or storage keys. The unauthenticated media route independently rechecks publication eligibility, accepts photos/videos only and returns 404 for document IDs or absent thumbnails. Local files are served inline with range support; S3 redirects use existing private grants capped at 60 seconds. Already-issued S3 bearer grants may remain usable until expiry after unpublication; no CDN or public bucket is provisioned. Search/detail/taxonomy/media responses are no-store, preventing stale public results after unpublication. The JSON response itself does not require storage availability. Private ownership documents never go through this route. Real Cloudflare R2/direct uploads and deployed-host verification remain separate pending work.

### 4.6 Staff property management (roles `staff`, `admin`)

`AdminPropertyDetail` = `PropertyDetail` fields (computed from stored data, regardless of status) plus: `status`, `landlord` (`id`, `full_name`, `phone`, `email`, `relationship`), `address_line`, `latitude`, `longitude`, `landlord_conditions`, `documents[]` (`id`, `kind`, `signed_url`, `expires_at`, `review_note`), `verification_history[]`, `landlord_approval` (current or `null`), `status_history[]`, `assigned_staff`, `submitted_at`, `version`.

| Method | Path | Request / notes | Success |
|---|---|---|---|
| GET | `/admin/property-options` | Active area, amenity and staff/admin options for private forms; no query parameters | `200 {data:{areas,amenities,staff}}` |
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

**BE-4.5 implementation / CR-STAFF-PROPERTY-001:** queue/detail/property PATCH/assignment/availability/staff media and landlord directory are Implemented. Workflow transitions, verification writes/completion and landlord-approval recording are implemented in BE-4.6 (see CR-PROPERTY-WORKFLOW-001 below). All implemented routes require the current active staff/admin database role; clients get 403 and anonymous requests 401. Unsafe requests retain Origin/CSRF checks.

`AdminPropertySummary` adds status, landlord_id (no contact fields), assigned_staff `{id, full_name}` or null, submitted_at, updated_at, version and submission_reference to the PropertySummary fields. Detail includes the documented private contact/evidence/history fields; private schemas must never be reused by public browsing. Raw storage keys, auth/session data and password hashes are never serialized. Asset links expire within five minutes. Local-development media/document links are absolute protected URLs at `GET /admin/properties/{id}/files/{file_id}?token=…&thumbnail=false`; both the signature and a current staff/admin cookie session are required, and the signed key must match the referenced file/property. S3 uses native signed URLs (bearer grants until expiry). Local delivery returns attachment bytes, no-store and nosniff.

Queue status is comma-separated; q searches title/description/neighbourhood as literal text (SQL wildcard characters escaped). Area is a slug, assigned_to and landlord_id are UUIDs. Sort accepts submitted_at/updated_at in either direction, comma-separated, default -submitted_at; ties use property ID. Pagination follows §2.5 (`total_items`). Unknown/repeated query names, unsupported/duplicate sort or status values and invalid bounds return 422. stale_availability=true means never confirmed or confirmed **more than the configured AVAILABILITY_STALE_DAYS (default 14 days)** ago; false means confirmed at or after that cutoff.

PATCH requires version and accepts the PropertyInput fields except availability_status, plus relationship and optional exact latitude/longitude. IDs/slug/status/landlord_id/assignment/verification are not writable here. Required values cannot be cleared; optional hint/coordinates/payment terms/landlord conditions may be cleared. Merged input is validated for rent/sale period consistency, active area and unique active amenities. A real price amount/currency/period or description change supersedes the current approval; unrelated/identical values do not. Verification history is not recomputed. Published/archived/rejected detail edits and file additions/removal require an explicit unpublish/reopen workflow first (409).

Mutation responses are `200 {data:{id,status,version,approval_invalidated,assigned_staff_id,availability_status,last_availability_confirmed_at}}`, avoiding a post-commit dependency on storage link generation. Assignment accepts a current active staff/admin UUID or null to unassign. Availability confirmed_at defaults to now; supplied times must include a timezone and cannot be future. These routes support optional version (existing bodies omitted it) and always serialize via row locks; PATCH property's version is mandatory. Each accepted mutation increases the property version and writes audit.

Media metadata supports alt (clearable), nonnegative position, is_cover and optional property version. Only photos may be covers; selecting a cover clears the previous cover atomically. Removing a cover selects another remaining photo; physical deletion uses the durable private deletion outbox. Metadata-only media edits on published properties are allowed; archived/rejected media require reopening. Staff uploads follow §4.4 limits, retain a 60/hour/current-user attempt budget and increment the property version. Staff JSON bodies are receive-bounded to 64 KiB and multipart to 100 MiB plus 64 KiB overhead. Upload receipts retain §4.4 shape; refresh detail to obtain the new aggregate version.

Landlord directory supports q over name/phone/email and page/page_size; detail includes that landlord's property summaries. Private detail/document-link issuance and local downloads are audited. No final policy content or public property endpoint introduced by this task.

**FE-4.14 integration / CR-STAFF-PROPERTY-002:** the implemented staff queue, detail, edits, assignment, availability, media and landlord directory routes are Integrated with the protected `/staff/*` frontend. `GET /admin/property-options` is staff/admin-only and returns active `areas[]` (`id`, `slug`, `state`, `city`, `neighbourhood`), `amenities[]` (`code`, `label`) and `staff[]` (`id`, `full_name`, active staff/admin only). No email, password or other identity fields are returned. Unknown/repeated query parameters are rejected. This additive reference endpoint supplies valid IDs without a public taxonomy API. Forms send aggregate versions, multipart files preserve cookie/CSRF/session-refresh behavior, and successful writes refresh detail. The local real-stack test covers a 409 caused by another reviewer and signed-file denial for a client. Verification/publishing transitions are connected by the BE-4.6 follow-up below; connected views never simulate success.

**BE-4.6 / CR-PROPERTY-WORKFLOW-001:** transition, verification save/completion and landlord-approval endpoints are Integrated locally with the protected staff frontend (deployment and PR review pending). These return the existing mutation envelope `{data:{id,status,version,approval_invalidated,assigned_staff_id,availability_status,last_availability_confirmed_at}}`; landlord approval returns 201. Transition requires version; verification/complete/approval accept optional positive integer version for compatibility, and connected frontend always supplies it. All require active staff/admin, CSRF/Origin, strict bodies/query names and the existing 64 KiB JSON cap. Property row locks serialize every workflow write with detail/media edits.

Private detail additionally returns `allowed_actions[]` (legal transitions for current status/role, excluding approve/publish when publication blockers exist), `allowed_workflows[]` (`save_verification`, `complete_verification`, `record_landlord_approval`) and human-readable `publication_blockers[]`. Clients display these, never infer permissions. Reason-required actions remain listed; the confirmation form collects the reason. Only admins are offered reopen; server independently returns 403 for staff attempts.

Verification saves are allowed in_review; each save creates a new current in_progress snapshot and preserves prior checklist records. `method` is desk_review/physical_inspection/both; nonblank scope_summary max 2000. Up to six unique check codes: identity/ownership_docs/location/price/features/availability. Result pass/fail/na; NA needs a nonblank note; notes max 2000. Evidence IDs must refer to this property's documents. Completing requires a current in_progress record. Passing requires the first five codes, no failed check (including optional availability), and notes for NA. Failure may record an incomplete review. Completion stores server actor/time; a later revision needs another save. Verification scope confirms checks only and never guarantees legal title.

Landlord approval may be recorded in_review, approved or unpublished, so price/description edits can be reconfirmed without an admin reopen. The approved NGN amount and period must exactly match the current property; description_approved must be true. Method phone/whatsapp/email/in_person; note max 2000; approved_at must be timezone-aware and not future. Renewing approval supersedes the previous row. Existing detail edits invalidate current approval on price/description changes. No approval-expiry interval is inferred.

Approve and publish independently recheck the current passed verification, completion timestamp, required checks and scoped evidence, plus a current exact-price/description approval. Guards apply again when republishing. Invalid state/failed publish guard returns 409 INVALID_STATE_TRANSITION; stale supplied version returns 409 VERSION_CONFLICT. Missing required reason returns 422. Every accepted transition atomically writes append-only status history and audit, increments version, and publication sets published_at and verified_at. Reopen preserves evidence and approvals, but later approve/publish rechecks guards. No public browsing/CDN promotion or notification side effect is included here; these remain subsequent integrations.

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
| Fees & transactions | `GET/PUT /admin/fee-rules`, `POST/GET /admin/transactions`, `GET /admin/transactions/{id}`, `POST …/events`, `POST …/ledger-entries`, `POST …/transitions`; `GET /transactions` (client summary) | staff/admin; admin for rules; client | J-6.7 |
| Complaints | Shapes proposed in §4.8 (still `Draft`) | public; client; staff/admin | J-6.14 |
| AI assistant, public config, knowledge base, settings | Shapes proposed in §4.9 (still `Draft`) | public; client; staff/admin | J-6.28 |
| Notifications | `GET /notifications`, `POST /notifications/{id}/read` | any authenticated | J-6.18 |
| Reports (four operational counts; implemented) | `GET /admin/reports/kpis?from&to` | staff, admin | J-6.22 / CR-REPORT-001 |
| Policies | Static pages; `GET /policies/current` returns current policy versions for consent | public | J-1.3 |

### 4.7A Inquiries and client directory (J-5.1 / CR-INQUIRY-001)

Additive contract implemented and connected locally; cross-developer review and deployment pending. Authenticated clients only for `/inquiries`; active staff/admin only for `/admin/inquiries` and `/admin/clients`. CSRF/Origin on writes; JSON cap 64 KiB; strict bodies and unknown/repeated query rejection. Text is plain text rendered escaped; no attachments. Every response is no-store. OQ-08 and OQ-14 defaults apply.

- `POST /inquiries`: `{kind:property_interest|inspection_request|general, property_id?:UUID|null, body:1..4000 nonblank, budget_min?:integer kobo|null, budget_max?:integer kobo|null, desired_move_in?:YYYY-MM-DD|null}`. General requires null property; other kinds require currently publicly eligible property (404 otherwise). Nonnegative budgets up to 9e15, min ≤ max. Source server-owned web_form. 201 `{data:{id,reference:"INQ-<UUID>",status:"new"}}`. One open inquiry/client/property across property kinds; duplicate returns 409 CONFLICT. 20 creates/day/client. Optional Idempotency-Key 1..128 chars, client-scoped SHA256 storage; same normalized payload/key within 24h returns original minimal receipt (201), changed payload returns 409 CONFLICT. Actor row locks serialize duplicate/idempotency checks. Expired keys may be reused. Unknown network outcomes should retry with same key.
- `GET /inquiries` and `GET /admin/inquiries`: page/page_size (1..100, default20), optional status enum, q max150 literal search over reference/title; staff additionally assigned_to UUID. Ordered updated_at desc then id, `{data:Summary[],meta:{page,page_size,total_items,total_pages}}`.
- Summary: id, reference, kind, status, unread_count (incoming messages not yet acknowledged by the client/team), property `{id,slug,title}`|null (unpublished target has null slug), budget_min/max, desired_move_in, created_at/updated_at, last_client_message_at/last_staff_message_at. Client never gets landlord/contact/address, staff IDs, closed_reason, notes, audit or qualification internals. `GET /inquiries/{id}` returns own Summary only (other owner's ID =404); staff detail adds client `{id,full_name,email,phone,is_active}`, assigned_staff `{id,full_name}`|null, version, closed_reason, allowed_actions and status history `{from_status,to_status,reason,created_at}`.
- `GET /inquiries/{id}/messages`: own only, paginated ascending created_at/id. Staff same route under /admin. Message `{id,body,sender_role:client|staff,created_at}`; no sender identity/contact. Reads do not mutate read markers. `POST …/messages` `{body}` returns 201 message, updates last-message time/version. 60 messages/hour/actor across threads. Terminal threads reject writes 409. Admin messages serialize as staff. Notes are never joined into these endpoints.
- `POST /inquiries/{id}/read` and staff `/admin/inquiries/{id}/read`: `{through_message_id:UUID}` acknowledges incoming messages through that visible message by `(created_at,id)`, never future messages or other threads. Object-level 404 and normal role guards; 240/hour/actor. Returns `{data:{unread_count}}`. Updates message read_at only; no aggregate version bump. Staff share team read state. Connected open threads acknowledge only loaded incoming messages while visible.
- `POST /admin/inquiries/{id}/assign` `{version,assigned_staff_id:UUID|null}` checks active staff/admin, supports unassign.
- `PUT …/qualification` `{version,budget_min,budget_max,desired_move_in}` uses same budget rules; null clears values. Qualification does not advance status automatically.
- `POST …/transitions` `{version,action,reason?:0..2000}`. Actions: start (`new`→`in_progress`), qualify (`in_progress`→`qualified`), negotiate (`qualified` or `inspection_scheduled`→`negotiating`), close_won (`negotiating`→`closed_won`), close_lost or mark_spam (any open→`closed_lost`/`spam`, reason required). Inspection scheduling transition is reserved for BE-6.2, absent from API actions. Terminal threads cannot reopen in MVP. Transition adds history/audit atomically, updates qualified/closed timestamps. Invalid transition409 INVALID_STATE_TRANSITION; stale version409 VERSION_CONFLICT. Staff mutations return `{data:{id,version,status}}`; row locks serialize with messages.
- `GET/POST …/notes`: staff only, paginated ascending; POST `{body}` 1..4000, returns201 `{id,body,created_at}`. Private notes separate from client reply and absent from staff detail too; only notes endpoint exposes them. 60 notes/hour/actor.
- `GET /admin/clients`: page/page_size, optional q (name/email/phone literal), returns id/full_name/email/phone/is_active/version/created_at. `GET /admin/clients/{id}` adds paginated `inquiries` (first20) and inquiry_count; clients only, no password/session data. `PATCH …/{id}` `{version,is_active}` only; staff/admin can change client activity, revoke sessions on deactivation and audit. Cannot affect staff/admin via this route.

### 4.7B Inspection appointments (J-6.1 / CR-APPOINTMENT-001)

Working contract v0.10.0, owner-authorized implementation; peer review pending. Client endpoints require active client session and own-object access (404 for other clients); staff endpoints require active staff/admin. All writes require Origin/CSRF, strict bodies, 64 KiB receive cap and 120 attempts/hour/actor. Unknown/repeated query parameters return422; every appointment response is no-store. Money always NGN integer kobo. OQ-04 default: inspection fee disabled, amount0/statusnone, with server disclosure; no fee charging/payment endpoint introduced.

`POST /admin/appointments` →201 `{data:DetailStaff}`: `{inquiry_id,version,staff_id,scheduled_at,duration_minutes?:45,meeting_instructions?:null,landlord_rep_name?:null,landlord_rep_phone?:null}`. Version is current inquiry version. Require qualified, property-linked inquiry; active client/staff; currently eligible published available property. scheduled_at timezone-aware and future, duration whole minutes15..240. Parties client/property derive from inquiry and cannot be supplied. Representative defaults to stored landlord contact; explicit phone E.164, name2..150; private instructions≤2000. Creates proposed appointment, append-only history/audit; moves inquiry to inspection_scheduled with history/audit/version. Does not send an email or create an appointment from a general inquiry.

Active statuses proposed/confirmed/reschedule_requested reserve half-open `[scheduled_at,ends_at)` slots. Database GiST exclusion constraints (btree_gist) independently prevent overlapping staff or property slots, including concurrent writers. One active appointment per inquiry via partial unique index. Adjacent times allowed; cancelled/completed/no_show release reservations. Conflicts →409 CONFLICT; stale version409 VERSION_CONFLICT; illegal action409 INVALID_STATE_TRANSITION.

- `GET /admin/appointment-options`: active staff/admin only, no query parameters; `{data:{staff:[{id,full_name}],fee}}` supplies valid hosts and the server fee disclosure before scheduling. No email, phone or credentials.
- `GET /appointments` and `/admin/appointments`: page/page_size (default1/20, max100), status enum, timezone-aware date_from inclusive/date_to exclusive. Staff additionally staff_id and inquiry_id UUID filters. Ordered scheduled_at/id; `{data:SummaryClient[],meta:{page,page_size,total_items,total_pages}}`. Client list restricted server-side. Staff list deliberately omits contact/private fields; open staff detail for those.
- `GET /appointments/{id}` →DetailClient; staff `/admin/appointments/{id}` →DetailStaff. SummaryClient: id, reference `APT-<UUID>`, inquiry_id, property `{id,slug,title}` (slugnull when unpublished), staff_name, scheduled_at, ends_at, duration_minutes, status, version, allowed_actions, requested_scheduled_at|null, outcome|null, created_at/updated_at, fee `{amount:0,currency:NGN,status:none,disclosure}`. DetailClient adds meeting_address/meeting_instructions nullable. DetailStaff adds client (existing safe staff client DTO), staff_id, current property address_line, confirmed_meeting_address snapshot|null, landlord_rep_name/phone, private instructions, address_disclosed_at, reschedule_reason/cancellation_reason, outcome_notes, history `{from_status,to_status,reason,created_at}`.
- `POST /appointments/{id}/confirm` `{version}`: proposed future appointment only, property still publicly eligible/available. Status confirmed; snapshot exact address in private appointment and set address_disclosed_at. **Owner explicitly approved 5 November 2026:** only own confirmed/completed DetailClient discloses this property address and meeting instructions. Lists, unrelated clients and public endpoints never disclose. Cancel/no_show/request-reschedule withdraw disclosure; staff reschedule clears snapshot and confirmation, requiring fresh confirmation. Already-seen addresses cannot be recalled from a person's memory. Landlord contact/email/docs, coordinates, private notes/history never appear in client schemas.
- `POST /appointments/{id}/cancel` `{version,reason:1..2000}`: any active status→cancelled_by_client.
- `POST /appointments/{id}/request-reschedule` `{version,reason,preferred_at?:timezone-aware future|null}`: any active→reschedule_requested; original slot remains reserved pending staff action. Preferred time is a request, not a confirmed booking.
- `PATCH /admin/appointments/{id}`: full new slot body (`staff_id,scheduled_at,duration_minutes,meeting_instructions,landlord_rep_name/phone`) plus appointment version/reason. Active only; validates eligibility and conflicts; returns proposed, clears confirmation/address snapshot and preferred request. No editing completed/cancelled records.
- `POST /admin/appointments/{id}/cancel` `{version,reason,cancelled_by:staff|landlord}` → respective cancellation status; staff cannot forge a client cancellation.
- `POST /admin/appointments/{id}/outcome` `{version,outcome:interested|not_interested|needs_follow_up|null,no_show?:false,notes?:null≤4000}`. Confirmed and scheduled end passed only. no_showtrue requires nonblank private notes, ends no_show with outcome null; otherwise outcome required and statuscompleted. Notes private, categorical outcome visible to client. Cannot complete a future/unconfirmed visit.

Each mutation returns appropriate role-specific Detail envelope and increments appointment version/history/audit atomically. Cancellation/no_show returns inquiry inspection_scheduled→qualified (unless inquiry subsequently closed/moved), with history/audit; completion leaves inquiry ready for manual negotiate action. One consistent inquiry→appointment→property lock order prevents racing schedule/reschedule actions; database exclusion guards are authoritative. Client actions come from server; frontend formats Nigeria/WAT times and fee values, never decides permissions or arithmetic. Address exception amends general BR-03 only for own confirmed inspection DetailClient.

### 4.8 Complaints and suspicious-listing reports (CR-COMPLAINT-001; v0.11.0)

**Principles.** A report or complaint is an *unverified allegation* until staff conclude an investigation (BR-16). The reporter's identity is confidential (BR-17). Nothing permanent happens on an unverified report.

**Current implementation:** The additive CR-COMPLAINT-001 below supersedes draft examples where noted (UUID references, deferred transaction/refund scope and explicit hold transitions).

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
`subject.type` ∈ `property`, `appointment`, `general` (transaction subjects are deferred) (`id` null for `general`). An appointment that does not belong to the caller → `404`. `description` 20–4000; `desired_outcome` ≤ 500. `201` returns `id`, `reference`, `status`, `upload_token`.
`GET /complaints` and `GET /complaints/{id}` return the caller's own: `reference`, `kind`, `status`, `created_at`, `public_note` (a staff-written message; never investigation notes).

**Staff investigation** (roles `staff`, `admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/complaints` | Filters `status`, `kind`, `reason`, `assigned_to`, `property_id`, `outcome`, `overdue_first_response` (bool), `q`; sort `created_at`, `-created_at`; paginated |
| GET | `/admin/complaints/{id}` | Full record: reporter details, subject links, evidence metadata (separate staff-only five-minute grants), event history, count of other open reports on the same property or landlord |
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

Action permissions: staff may record `listing_corrected`, `landlord_warned`, `client_warned`, `no_action`, and `listing_unpublished` as a **precautionary hold** (only for `fake_listing` or `asked_to_pay_outside`; sets `hold_review_due_at` = 2 business days; the unpublish is written to the property's status history with the complaint id). `listing_rejected` and `landlord_blocked` are **admin-only** and require outcome `substantiated` or `partially_substantiated`. The number of reports never triggers an action automatically.

**Reporter notification.** When a case is `resolved` or `dismissed` and a contact exists, an email via the outbox says only that the report was reviewed (and the `public_note`, if staff wrote one). It never names the landlord, quotes evidence, or states the outcome category.

**Privacy rules (enforced by tests)**
1. Reporter name, email, phone, user id and IP hash are returned only by `/admin/complaints*`.
2. No public or client endpoint exposes report counts, "reported" flags, or other people's reports.
3. Landlord-facing communication never includes reporter identity or paraphrased identifying detail.
4. Evidence is private; signed URLs expire in ≤ 15 minutes.
5. Raw IP addresses are never stored (salted SHA-256 only); descriptions are never logged.

### 4.9 AI assistant, public config, knowledge base, settings (proposal; `Draft` until J-6.28)

**Purpose.** Answer common questions from approved content, and hand off to humans — **always showing the call line** — when it cannot help. The assistant is read-only: it cannot create, change or approve anything except the explicit "message the team" handoff.

**Public config** — `GET /public-config` (anonymous, no-store; CR-SUPPORT-001 supersedes proposed caching)
```json
{ "data": {
  "support": { "phone": "+2348000000000", "display_phone": "0800 000 0000",
    "hours_text": "Mon–Sat, 8:00–18:00 (WAT)", "timezone": "Africa/Lagos", "is_open_now": true },
  "assistant": { "enabled": true,
    "disclosure": "I'm an AI assistant. I can answer common questions, but I can make mistakes. For payments, legal questions or complaints, please call us." } } }
```

**CR-SUPPORT-001 — implemented support/editorial subset (v0.15.0).** The conversation endpoints below remain Draft. `GET /public-config` is `no-store`, not cached for 60 seconds: support changes and opening status are current on each request. Its `support` object includes nullable `phone`, nullable `display_phone` (E.164), nullable `email`, `hours_text`, `timezone: Africa/Lagos`, and `is_open_now`. Assistant enabled is always false until BE-6.30; disclosure is informational only. Initial owner-provided defaults: +2348145935403, Mon–Fri 09:00–16:00 WAT, email null. Saving null explicitly removes a contact rather than restoring its default.

- `GET /knowledge-articles`: anonymous, published only; `page` ≥1, `page_size` 1–100 (default20), `q` ≤150 chars, optional category. Literal case-insensitive title/body search; `%` and `_` are escaped. Summaries contain only slug/title/category/language/published_at; paginated envelope. `GET /knowledge-articles/{slug}` adds body; draft/absent →404.
- `GET /admin/knowledge-articles`: staff/admin; same filters plus status draft/published; summaries add id/status/version/created_at/updated_at. `GET /admin/knowledge-articles/{id}` adds body. No creator identity is returned.
- `POST /admin/knowledge-articles`: staff/admin, title3–160 chars, body20–30000, category from the declared enum, language en. Trims text, rejects active script/iframe/object/style markup; creates draft, returns201 detail. Slug remains stable. Public rendering is escaped plain text, preserving newlines; no HTML execution or markdown interpretation.
- `PATCH /admin/knowledge-articles/{id}` uses a **full editorial document** (title, body, category, language, version), an explicit exception to partial PATCH. Only drafts can be edited. `POST .../publish` and `.../unpublish` require admin and `{version}`; repeated state→409 INVALID_STATE_TRANSITION. Published articles must be unpublished before edits. Stale version→409 VERSION_CONFLICT. Every successful mutation increments version and audits status/version without body text.
- `GET /admin/settings`: staff/admin. `PUT /admin/settings`: admin only; full support settings with version≥0, nullable support_phone/support_email, support_hours, assistant_enabled:false, assistant_daily_token_budget integer0–10000000. Known keys only; extra fields rejected. Version starts0 and changes atomically under an advisory lock; stale→409 VERSION_CONFLICT. Secret/provider settings are never exposed. The token budget is stored only for later integration; no provider calls occur.
- `support_hours`: `{timezone:"Africa/Lagos",days:[{day:0..6,open:"HH:MM",close:"HH:MM"}]}`; Monday0. At most one interval/day, no overlaps including week wrap. Closing≤opening crosses midnight; equal means24 hours. Opening inclusive, closing exclusive; empty schedule is closed. No contact means is_open_now:false.
- All routes reject unknown/repeated query parameters. Editorial/settings writes share120/hour per actor; public article reads120/minute/IP. JSON bodies bounded at256KiB articles/16KiB settings. Standard auth, CSRF and error envelopes apply. Public DTOs never include drafts, internal settings, creator IDs or audit records.

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
| GET/PUT | `GET /knowledge-articles`, `GET /knowledge-articles/{slug}` (published only) | ✓ | ✓ | ✓ | ✓ |
| `/admin/settings` | Read: staff/admin. Write (admin only): `support_phone` (E.164), `support_hours`, `assistant_enabled`, `assistant_daily_token_budget` |

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
| `POST /complaints`, `GET /complaints*`, own complaint files (account + scoped token) | — | own | — | — |
| `GET /admin/complaint-options` | — | — | ✓ | ✓ |
| `/admin/complaints*` | — | — | ✓ (`listing_rejected`, `landlord_blocked`, `reopen`: admin only) | ✓ |
| `GET /admin/reports/kpis` | — | — | ✓ (team aggregates) | ✓ |
| `/notifications*` | — | own | own | own |
| `GET /public-config`, `POST /assistant/conversations`, `…/messages`, `GET …/{id}` | ✓ (token) | ✓ | ✓ | ✓ |
| `POST /assistant/conversations/{id}/handoff/message-team` | — | ✓ | — | — |
| `/admin/knowledge-articles*`, `/admin/assistant/*` | — | — | ✓ (publish: admin only) | ✓ |
| `GET /knowledge-articles`, `GET /knowledge-articles/{slug}` (published only) | ✓ | ✓ | ✓ | ✓ |
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
| Inquiry message and note POSTs | 60 / hour per actor per kind (messages/notes separately) |
| Inquiry read acknowledgement POSTs | 240 / hour per actor |
| Appointment mutations | 120 / hour per actor across appointment write routes |

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
| POST /landlord-submissions, POST /landlord-submissions/{id}/files, DELETE /landlord-submissions/{id}/files/{file_id}, POST /landlord-submissions/{id}/submit | Integrated locally (BE-4.4 / FE-4.10; live draft, upload/removal and receipt journey) |
| GET /properties, GET /properties/{slug}, GET /taxonomy, GET /property-media/{media_id} | Integrated locally (BE-4.7 + FE-4.11/12/13; PR/deployment pending) |
| GET /admin/properties, GET /admin/properties/{id}, PATCH /admin/properties/{id}, POST …/assign, PATCH …/availability, POST/PATCH/DELETE …/media | Integrated (BE-4.5 / FE-4.14 local real-stack evidence) |
| GET /admin/property-options | Integrated (FE-4.14) |
| GET /admin/properties/{id}/files/{file_id} (protected local-development delivery) | Implemented (BE-4.5) |
| POST /admin/properties/{id}/transitions, PUT …/verification, POST …/verification/complete, POST …/landlord-approval | Draft (BE-4.6) |
| GET /admin/landlords, GET /admin/landlords/{id} | Integrated (FE-4.14) |
| POST /reports, POST /reports/{id}/files, POST/GET /complaints, GET /complaints/{id}, GET /admin/complaints, GET /admin/complaints/{id}, POST …/assign, POST …/transitions, PUT …/investigation | Integrated locally (CR-COMPLAINT-001; deployment/peer review pending) |
| POST/GET /inquiries, GET /inquiries/{id}, GET/POST /inquiries/{id}/messages, POST /inquiries/{id}/read; /admin/inquiries assignment/transitions/qualification/messages/notes; GET/PATCH /admin/clients | Integrated locally (J-5.10; see §4.7A and LIVE_INQUIRIES.md) |
| GET /public-config, GET /knowledge-articles, GET /knowledge-articles/{slug}, GET/POST /admin/knowledge-articles, GET/PATCH …/{id}, POST …/publish/unpublish, GET/PUT /admin/settings | Implemented locally (CR-SUPPORT-001; browser integration validation tracked in SUPPORT_KNOWLEDGE.md) |
| POST /assistant/conversations, GET /assistant/conversations/{id}, POST …/messages, POST …/handoff/message-team, POST /assistant/messages/{id}/feedback | Draft (shapes proposed, §4.9) |
| GET /admin/assistant/conversations, GET/PATCH …/{id} | Draft (assistant review not implemented, §4.9) |
| Appointments client/staff list/detail, schedule/reschedule/cancel/confirm/request-reschedule/outcome and staff appointment-options | Integrated locally (J-6.6, §4.7B; deployment/review pending) |
| Fees/transactions, notifications | Draft (intent only, §4.7; notification implementation pending on a separate branch) |
| GET /admin/reports/kpis | Integrated locally (CR-REPORT-001; peer review/deployment pending) |

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
| 0.15.0 | 2026-11-11 | CR-SUPPORT-001: editable support contacts/hours, versioned staff drafts/admin publication, published-only public Help; assistant remains disabled | Backend + authorized frontend; peer review pending |
| 0.14.0 | 2026-11-11 | CR-AVAILABILITY-001: configurable stale queue/scanner, confirmation history and mapped staff outcomes; public availability values unchanged; email deferred | Backend + authorized frontend; peer review pending |
| 0.13.0 | 2026-11-05 | CR-REPORT-001: private four-count operational dashboard, strict WAT date filters and current-state cohort definitions; financial KPIs deferred. v0.12.0 reserved on pending notification branch. | Backend + authorized frontend; peer review pending |
| 0.11.0 | 2026-11-05 | CR-COMPLAINT-001: scoped reports/complaints/evidence, confidential investigation, explicit holds, guarded admin actions; transaction/refund scope deferred | Backend + authorized frontend; peer review pending |
| 0.10.0 | 2026-11-05 | CR-APPOINTMENT-001: inspection lifecycle, slot conflicts, scoped address exception approved by owner, zero fee default and integrated scheduling shapes | Backend + authorized frontend; peer review pending |
| 0.9.0 | 2026-11-04 | CR-INQUIRY-001: freeze client/staff inquiries, text messages, private notes and client directory; OQ-08/14 defaults | Backend + authorized frontend; review pending |
| 0.8.1 | 2026-11-04 | BE-4.9: clarify defence-in-depth checklist integrity on every public read; response shapes unchanged | Backend; review pending |
| 0.8.0 | 2026-11-04 | CR-PUBLIC-BROWSE-001: public taxonomy/search/detail, visibility-gated media, explicit query/null/privacy semantics; frontend connection | Backend + authorized frontend; review pending |
| 0.7.0 | 2026-11-02 | CR-PROPERTY-WORKFLOW-001: implement verification/approval/transitions, explicit version semantics and private server-owned capabilities/blockers; connect staff workflow forms | Developer 2 authorized cross-area implementation; frontend review pending |
| 0.6.0 | 2026-11-02 | CR-STAFF-PROPERTY-002: private active dropdown options; staff property/landlord frontend integration with multipart/CSRF, optimistic versions and real-stack coverage; workflow transitions remain Draft | Developer 2 authorized cross-area implementation; frontend review pending |
| 0.5.0 | 2026-11-02 | CR-STAFF-PROPERTY-001: staff queue/detail/edit/assignment/media/availability, landlord directory, protected local file delivery; explicit private DTOs and version/approval semantics | Developer 2 implementation; frontend review pending |
| 0.4.0 | 2026-11-02 | CR-LANDLORD-001: implement landlord draft/upload/removal/submit; clarify scoped tokens, consent, input/body limits, ownership evidence, stable receipts/deletion retries; owner selects submitted for every completed submission | Developer 2 implementation; owner status override; frontend review pending |
| 0.3.0 | 2026-10-31 | User-directed authentication integration: password minimum 8 (formerly 10), CSRF bootstrap, identity lifecycle and admin version clarification (CR-AUTH-001) | Developer 2 session; user override, frontend review pending |
| 0.2.0 | 2026-10-24 | Team review: currency/formatting conventions §2.10; unknown error codes and non-envelope failures §2.4; code 503; complaint minimum fields, rate limits, privacy and investigation workflow §4.8; AI assistant, public config, knowledge base, settings §4.9; new enums, rate limits, matrix rows | pending (J-1.3) |

## CR-COMPLAINT-001 — 5 November 2026

Additive complaint/report integration v0.11.0. Transactions, transaction subjects and refund actions remain deferred by owner. Existing listing/general/owned-appointment subjects are supported. Client property subjects require a published property or an existing own inquiry/appointment link. Public receipts return an opaque reference `CMP-<UUID>`, ID/status, follow-up message and scoped 24-hour upload token; no read access is conferred. Client complaint endpoints are client-role only; team members investigate through the staff endpoints and can use public listing reporting. Client complaints have separate `/complaints/{id}/files` upload/removal endpoints (own account plus scoped token); public `/reports/{id}/files` also supports DELETE `/{file_id}`. Max three JPEG/PNG/PDF files, 5 MiB each, before case closure; file contents validated. Staff-authenticated `/admin/complaints/{id}/files/{file_id}` returns a private five-minute read grant; local grants use `/admin/complaints/{id}/files/{file_id}/content?token=…`, still staff-authenticated. No client read endpoint returns evidence or investigation fields.

Strict JSON/query validation; all cookie mutations require existing CSRF/Origin checks. Assignment requires version and active staff/admin. Investigation saves proposed actions only, and resolution executes them atomically. Add explicit transitions `place_hold` (fake_listing/asked_to_pay_outside only, reason required, active investigation/triage), `release_hold` (reason required; never automatically republishes). Blocking a landlord immediately removes their listings from public visibility and prevents further publication. An active hold blocks all publication paths until explicitly released; case closure does not silently release a hold. Deadline: two weekdays in Africa/Lagos, holiday calendar pending. Permanent rejection/blocking occurs only on resolve, by admin, with substantiated/partially_substantiated outcome. Permanent actions require linked property/landlord. `no_action` cannot combine with another action. `refund_recorded` is not available. Completed cases are immutable except admin reopen with reason. Reopen clears working findings/outcome/actions to require fresh investigation; retains immutable events. A hold never changes listings automatically based on report counts.

Recording listing corrections or warnings attests to staff work performed separately; only holds, rejection and blocking change restrictions through this module. Staff detail alone includes description, contact/user ID (no raw IP), subject IDs, findings/evidence/outcome/actions, assignment, hold deadline, event history and other-open-case count. Client list/detail returns only own ID/reference/kind/status/created_at/public_note. Staff detail includes server-owned, role/subject-aware `allowed_actions` and `allowed_case_actions`, plus active staff options from `/admin/complaint-options`. Lists use existing page/page_size envelopes; staff accepts §4.8 filters plus `sort`; client accepts status. Receipts/tokens/private responses are no-store. Writes max 64 KiB; files max 5 MiB plus multipart overhead. Staff writes 120/hour/actor; reads require authorization; case mutation version conflicts return 409. Duplicate reports use per-identity advisory locking, salted HMAC IP key and a 24-hour window. Public follow-up emails contain only a generic reviewed notice and the public note. Private text is never logged. CAPTCHA-ready reports accept `X-Captcha-Token` through the existing server verifier interface. Required installations fail closed when the verifier is unavailable; provider/widget provisioning is pending.

Public browsing keeps the same response/filter/pagination contract: visibility checks are grouped and property-scoped, and window counting shares eligibility with returned rows (out-of-range empty pages use a count fallback). This fixes the search-plan regression introduced while enforcing blocked-landlord visibility; it does not relax verification or privacy.


### CR-REPORT-001 — operational dashboard (J-6.22, v0.13.0)

`GET /admin/reports/kpis` — staff/admin only; implemented with frontend integration. Optional `from` and `to` must both be present as `YYYY-MM-DD` calendar dates, with `from <= to`. Unknown/repeated keys, empty dates, invalid dates, timestamps or unrepresentable following-day bounds return `422 VALIDATION_ERROR`. Default is all dates. Date windows are inclusive calendar days in Africa/Lagos, translated to UTC `[from midnight, midnight after to)`. Response is private (`Cache-Control: no-store`), with no entities, contacts, documents or narrative.

```json
{"data":{"as_of":"2030-05-10T12:00:00Z","period":{"from_date":"2030-05-10","to_date":"2030-05-10","timezone":"Africa/Lagos"},"counts":{"listings_awaiting_review":2,"open_inquiries":5,"upcoming_inspections":3,"active_complaints":3}}}
```

Metric definitions/date columns: [live dashboard](LIVE_DASHBOARD.md#metric-definitions). These are **current** status counts within the selected date cohort, not historical snapshots or totals of all events in that period. Upcoming inspections must also start at or after response `as_of`, even when the date filter is in the past. Query uses one database statement/snapshot for all four aggregates. Anonymous → 401; clients → 403; inactive users use the existing revoked-session behavior. No financial KPIs, export endpoint or additional PRD metrics are implemented in this scope. Version 0.12.0 is reserved for the independent notification work and is not a dashboard dependency.


### CR-AVAILABILITY-001 — availability maintenance (BE-6.27, v0.14.0)

- `GET /admin/availability-queue`: active staff/admin only; page (default 1), page_size (default 20, max 100), optional q (literal title substring, max 150), assigned_to UUID. Unknown/repeated filters reject with 422. Returns `data[]` with id/title/listing_type/availability_status/last_confirmed_at/version/assigned_staff (name or null), and pagination meta plus threshold_days/as_of. Only published available/under_offer properties that have never been confirmed or are strictly older than the threshold appear. Exact cutoff is fresh. Oldest/never-confirmed first, stable ID ties. Out-of-range pages have empty data and correct totals. No media/storage dependency or private owner contacts.
- `GET /admin/properties/{id}/availability-history`: staff/admin only, existing property or 404; latest 50 confirmation records with id/recorded_at/confirmed_at (ISO string or null for legacy records)/actor_name/availability_status/outcome/note. Recorded time and actual confirmation time remain distinct. Notes and outcomes are staff-only; no public/client history endpoint. Legacy records do not acquire an invented confirmation date. Unknown/repeated query keys reject.
- Existing `PATCH /admin/properties/{id}/availability` additionally accepts optional outcome (`available`, `under_offer`, `unavailable`, `let`, `sold`, `withdrawn`) and note (max 1000). Supply availability_status or outcome, or both consistently. Existing bodies remain supported. Backend maps let/sold/withdrawn to unavailable; let requires rent and sold requires sale. Public enums remain available/under_offer/unavailable. Existing optional version, row lock, future/timezone checks and mutation envelope remain. Each successful confirmation increments version and writes actor/time, previous/current availability, actual confirmed_at, outcome and note to append-only audit. A backdated confirmation can remain stale; no publication or verification change is implied.
- AVAILABILITY_STALE_DAYS is deployment configuration, integer 1..365, default 14, shared by old generic stale filters, the dedicated queue and scanner. Generic property stale filters retain their old all-status scope; the dedicated queue narrows to actionable published available/under_offer listings. Changing configuration changes queue truth immediately.
- Bounded scanner records property.availability_stale audit entries once per confirmation cycle using property row locks and skip-locked. No property-version bump, automatic unpublish or email. Queue truth is computed from current data, so it does not depend on a job completing and fresh reconfirmation clears staleness immediately. Existing unavailable/let/sold/withdrawn listings are excluded from recurring scans. Confirmation history and queue responses are no-store and never expose documents, private addresses or owner contacts.

Staff UI: /staff/availability-queue, linked from the live overview; existing property confirmation view supports outcomes/notes and history. Scanner invocation: python -m app.workers.availability --limit 100. No migration or production scheduler configuration is included.
