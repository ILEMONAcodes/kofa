> Superseded by database-backed authentication. Do not configure review accounts or the review secret. Use [BACKEND_AUTHENTICATION.md](BACKEND_AUTHENTICATION.md) and [backend/README.md](../backend/README.md); private database URL slots are in `backend/.env`. The old endpoint has been removed. Historical review setup below is retained for context only.

# Unified sign-in and assigned accounts

Task: FE-3.6 — Unified sign-in and private workspace access
Objective: Remove public staff/admin discovery and role self-selection; sign-in resolves the account's assigned role and routes to the correct workspace.
Owner: Joint (Developer 2 explicitly authorized frontend work)
Branch: joint/FE-3.6-assigned-review-accounts; retains preceding deployed-review/budget fix pending merge.
Read: PRD AUTH requirements; API_CONTRACT §4.2/§5; ARCHITECTURE §5/§6/§8; Next local route-handler/cookie documentation.
Files: access/auth/navigation components, route guards, review account adapter, tests and docs.
Contract: real /api/v1/auth remains Draft and unchanged. Review-specific server access must not impersonate real auth or provision live users.
Acceptance: one /login; no public staff/admin links or role picker; registration grants client only; trusted assigned role selects landing page; staff/admin pages reject unauthorized access; old browser role strings do not grant access; clear private setup for team accounts.
Tests: role routing/return path boundaries, registration escalation, forged browser role/cookie, bad credentials, wrong-role server page access, sign-out; existing browse/budget and responsive accessibility regressions; lint/typecheck/unit/build/mock audit.
Scope approved: privately configured server-protected review accounts now; real backend authentication and staff email invitations later. No real user data or email sends.


## Deployment setup

Deploy as a Next.js server (Node.js runtime or a host such as Vercel), not a static export. FastAPI is not required for this review. Everyone uses `/login`, including the installed PWA.

Set these environment variables privately for the hosting environment you will share (production and/or preview), then redeploy:

- `NEXT_PUBLIC_LOCAL_ACCESS=true` (build-time switch for sample review flows).
- `REVIEW_SESSION_SECRET`: a random value of at least 32 characters (`openssl rand -base64 48`).
- `REVIEW_ACCOUNTS_JSON`: a JSON array with an administrator and optional staff accounts, each containing `email`, `password` (12–128 characters), and `role` (`admin` or `staff`). At least one administrator is required. Use invented review email addresses and unique temporary passwords. For example, replace every placeholder in `[{"email":"admin@kofa.test","password":"<replace>","role":"admin"},{"email":"staff@kofa.test","password":"<replace>","role":"staff"}]`.

The example password placeholders deliberately fail the 12-character validation until replaced. The final two names must never use `NEXT_PUBLIC_`. Paste the JSON itself into the hosting value, without shell quotes. Share each team member's review credentials privately. Local random credentials have been generated in the ignored `frontend/.env.local`; view that file locally and copy its values privately if using the same accounts on the host. No credentials are committed. The committed E2E values are fake isolated test fixtures, not deployed defaults.

Landing pages: client `/account/overview`, staff `/staff/overview`, admin `/admin/administration`. `/account` resolves to the signed-in role's workspace. No public role selector, staff link or registration escalation. `/staff/login` only redirects to the common login.

To add/remove/change review staff, update the private JSON and redeploy. Changing a privileged account's password/role or removing it invalidates its existing session. Rotate the signing secret to invalidate all sessions. Admin `/admin/users` displays configured account emails and roles only; no passwords or pretend invitation form. Real account provisioning, invitations and email delivery are deferred.

## Server boundary

The internal `/api/review-auth` endpoint creates an eight-hour, signed, HttpOnly, SameSite=Lax session cookie (Secure over HTTPS). Server-side page checks validate the signature, expiry and current configured role before rendering each private screen. Private screens render dynamically; browser storage cannot grant roles. Wrong-role requests render the not-found screen; signed-out requests redirect to login before any private screen is constructed. With Next.js streaming, the initial HTTP status can be 200 and carry a framework redirect/not-found instruction; private content is still withheld. Sign-out clears the cookie and fully navigates home to clear the client router's private-page cache.

POST/DELETE require same-origin requests. POST rejects client-supplied role fields and bounds the body to 2 KiB. There is a best-effort in-process limit of 100 attempts per forwarded client IP per ten minutes, not a distributed production rate limiter. The host must supply/sanitize forwarded-IP headers. Configuration missing or invalid fails closed with a setup message; public browsing still works.

Example client email plus a six-character password grants only a sample client walkthrough. No real client account/password is stored. Credentials are sent to the same-origin review endpoint, never to FastAPI. Staff/admin credentials are checked on the server. All property/inquiry operations still use sample records. This temporary review mechanism must be replaced by contract-backed authentication before live users/data; switch review off and rotate its secret at that transition. Cookies require the app and its review endpoint on the same origin.

## Verification

- 118 unit tests in 20 files passed, including signing, expiry, tampering, config/credential rotation, reserved registration and safe role routing.
- Production build passed with 243 generated pages; private routes are dynamic. Lint, standalone typecheck, mock audit and diff whitespace checks passed. No production auth/operational integration claimed.
- Focused flow/access suite: 10/10 passed. Full Chrome regression: 91/98 passed; three obsolete access fixtures and four shared-client rate-limit failures were investigated. Updated fixtures authenticate protected screens, assert the configured team list, and simulate independent reviewer IPs on the local test server. Final affected rerun: 10/10 passed, including all seven failures, the fresh browser-role forgery case and a new 100-attempt/429 rate-limit boundary check. All 99 distinct browser cases have passing results across runs. Production rate limiting was retained.
- Browser checks cover all assigned-role landings at common login, reload, HttpOnly/SameSite cookies, Secure on HTTPS, sign-out, forbidden role injection, invalid credentials, reserved privileged registration, forged browser/cookie roles, direct private URLs, bounded requests, accessibility, 360/768/1280 layouts, original budget prefix spacing and existing public/property/listing/media flows.
- A separate production-server check with empty private configuration verified public browse 200, sign-in 503, and no private team content in the server redirect stream.
- Existing personal `frontend/next-env.d.ts` changes preserved and excluded. Ignored private `.env.local` is not committed. No hosting settings were changed and no real email was sent.
