# J-4.15 — landlord submission recovery

Owner: Developer 2, explicitly authorized frontend/backend correction.
Branch: joint/J-4.15-submission-recovery.
Objective: recover listing configuration loads, require supported locations early,
expand Abuja reference options, and verify staff/admin approval/publication.
Scope: submission UI/transport/validation, taxonomy seed, tests and policy assumptions.
Dependencies: existing submission, upload, taxonomy, policy and workflow APIs implemented.
Contract: existing schemas; no invented area IDs, no bypass of policy acceptance or publish guards.
Acceptance: failed config load recoverable without losing form/files; invalid area rejected
at property step; dependent selections reset; current terms/privacy required; seeded
locations idempotent; staff/admin can verify, record owner confirmation, approve and publish.
Tests: frontend submission units and browser journey, backend taxonomy/submission/workflow regressions.
No real listing approval, production database writes or final legal publication in this task.

## Temporary policy assumptions

The existing owner-approved MVP policy drafts remain `draft-v1`. Deployed public policy
configuration returned approved=true on 20 November 2026. This means owner authorization
for MVP use, not legal review. Existing Terms/Privacy draft text and unresolved placeholders
remain unchanged. See docs/DECISIONS.md entry 2 November 2026 and frontend/src/content/policies/.
The UI must load both current versions and record consent; never invent a version or silently
accept changed terms. Staff approval still requires completed verification and recorded
landlord confirmation of the current price/description; neither is automatically fabricated.

## Location sources and boundaries

FCTA Engineering Design and Evaluation lists districts by phase:
https://fcta.gov.ng/ova_dep/engineering-design-and-evaluation/ .
AGIS supplies authoritative cadastral mapping: https://agis.fcta.gov.ng/fctlands/ .
Use district names as listing options, not surveyed boundaries or coordinates. Preserve the
existing 12 IDs and spellings; add researched city districts. FCT/Abuja is the existing catalogue
hierarchy, not an assertion that all satellite communities are separate city districts.
Existing Kubwa/Lugbe/Apo/Life Camp entries remain unchanged. Wuse 2 is the UI spelling of Wuse II.
No invented map pins or exhaustive coverage claim. Unsupported neighbourhoods need staff
catalogue maintenance before submission; exact address remains private.

## Deployment status and remaining upload prerequisite

The owner approved the production reference-data seed on 20 November 2026.
`python -m app.cli seed-taxonomy` completed successfully against the configured Neon
connection. Both Render and the Vercel proxy now return 38 areas and 16 amenities.
No existing listing was approved, published or deleted. Existing reference records
were preserved. The UI corrections still require a frontend deployment.

Initial prerequisite: the owner had only Neon configured. The R2 connection has since
been configured and verified locally; see the verification update below.
Neon stores listing metadata, not the photo/video/document objects. Private storage
is a required deployment prerequisite, not a missing policy. The existing private
`.env` and example already have the slots; do not enable an unconfigured driver.
Configure the following privately on Render after creating a private R2/S3 bucket:

```dotenv
STORAGE_DRIVER=s3
S3_ENDPOINT_URL=<private provider endpoint>
S3_REGION=auto
S3_BUCKET=<private bucket name>
S3_ACCESS_KEY_ID=<bucket-scoped credential>
S3_SECRET_ACCESS_KEY=<bucket-scoped secret>
```

Keep the bucket private. Do not use Render's ephemeral filesystem for production
uploads. These are placeholders, not working credentials. No bucket was provisioned
and no storage credentials were changed. See PROPERTY_UPLOADS.md for validation,
private document access and signed-download behaviour. After configuring storage,
redeploy Render and submit a test property through the real deployed form.

## Staff/admin approval flow

1. Sign in with an existing staff/admin account and open the listing review queue.
2. Open the submitted listing and start review.
3. Review private ownership/authority evidence and complete the verification checks.
4. Record the landlord's confirmation of the current price and description.
5. Approve, then publish the listing. Approval and publication are separate actions.
6. Confirm the published listing appears in public browsing with private evidence
   and exact address withheld under the existing privacy rules.

Editing material details invalidates the relevant confirmation; the backend requires
reconfirmation before publishing. Neither role can bypass these checks. No new
landlord account is required: contact registration remains in the submission flow.

## Validation

- Isolated local PostgreSQL: 183 property-model, landlord-submission and workflow
  tests passed, including staff/admin approval/publication and idempotent seeding.
  One existing Starlette/httpx deprecation warning.
- Frontend: typecheck and ESLint passed; 24 submission unit tests passed.
- Production-build Playwright journey: 1 passed. Exercised one configuration outage
  and retry, preserved contact details, partial uploads/removal/retry, submission,
  staff verification/approval/publication, public browsing and unpublication.
- Ruff passed; mypy passed across 95 app files; OpenAPI export unchanged;
  git diff whitespace check passed.
- Real production verification was limited to the owner-approved reference seed and
  public taxonomy/policy reads. No live upload or live property approval was claimed.

## R2 verification update — 20 November 2026

Owner configured the ignored backend/.env with STORAGE_DRIVER=s3, S3_BUCKET=kofa,
region auto and private R2 credentials. The configured application adapter successfully
uploaded fictional diagnostic bytes and read them using a short-lived signed URL.
Unsigned S3 access was rejected (HTTP 400); deleted-object access returned 404.
Both temporary diagnostic objects were removed. No customer files or database records
were used. The first privacy assertion expected 401/403/404 and was corrected to
recognize R2's unsigned-request 400 response; it was not an upload failure.

The adapter and public media route explicitly use Cache-Control: private, no-store.
No CDN cache, public custom domain or r2.dev access was enabled. Dashboard public
access settings were not inspected. Private documents must remain protected.
Local .env changes do not configure Render: the same six storage variables must be
saved privately on Render and deployed before claiming deployed upload success.
The previous frontend code changes still require push/deployment. R2 credentials
were never printed or written to tracked documentation.
