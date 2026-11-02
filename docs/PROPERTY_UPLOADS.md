# BE-4.3 — private property uploads service

**Update:** BE-4.4 now exposes the landlord draft/file/removal/submit APIs; see [current endpoint handoff](LANDLORD_SUBMISSIONS.md). The no-HTTP statements below describe the original BE-4.3 scope.

Task brief: implement local/S3 storage and content validation for photos, optional video and private evidence documents, using BE-4.2 metadata. Owner: Developer 2. Branch: be/BE-4.3-property-uploads (stacked on property foundations).
Documentation: API_CONTRACT §4.4, ARCHITECTURE §10, PRD OQ-13. Assumes existing OQ-13 limits, S3-compatible production storage; no provider chosen/provisioned.
Files: storage/media services, repository, config/example, dependencies/container, tests/docs.
Acceptance: type/size/count checks; EXIF-free images/thumbnails; private writes; staff-only expiring read grants; scoped property keys; storage/DB failure cleanup; authenticated staff actor checked in service. No public storage routes.
Tests: malicious/truncated/oversized/mis-typed files; real Pillow processing; PostgreSQL media rows/counts; local path traversal/signature expiry; S3 SDK stubs. No paid cloud access.
Out of scope: landlord draft/token/HTTP API (BE-4.4), publication/media delivery (BE-4.6/4.7), real data, storage account provisioning, transcoding. No endpoint or API contract change in this task.
Local storage is development only. Production storage stays disabled until explicit private S3 configuration; existing auth must continue to start without upload credentials. All draft media and evidence are private.

## Implementation and deployment boundary

- `add_file` validates content and a signed property-scoped upload capability (24 hours) or current staff/admin database role. A locked property row serializes quotas (20 photos, 1 video, 10 documents); submission uploads stop after submission. Caption length is bounded. File keys are UUID-based, never the provided filename.
- Photo input JPEG/PNG/WebP ≤10 MiB; optional MP4/WebM ≤100 MiB; evidence PDF/JPEG/PNG ≤10 MiB. Corrupt or disallowed inputs produce contract 415 errors; oversize gives 413. Images have a 25-megapixel resource limit, are oriented/re-encoded without EXIF/XMP/ICC and get ≤480px thumbnails. PDF parser rejects encryption, malformed PDFs and detected root-level active/embedded content; this is not a malware scanner.
- Video is probed with a 15-second timeout and file-only protocol whitelist. No transcoding; video metadata is not stripped. ffprobe is supplied by ffmpeg in Docker.
- All originals/thumbnails/documents use private object keys. S3 writes set attachment/no-store, and staff document reads generate grants lasting at most five minutes. Bucket policies must be private; the app never creates buckets or makes them public. Local driver has no public HTTP mount and uses signed expiring tokens. The local read token is an internal driver capability, not a new HTTP route. Future download handlers must authorize before issuing it.
- Upload rows and audit commit together. Failed writes/commits attempt deletion of every attempted key. Failed compensating deletion logs a generic reconciliation warning, without file keys/PII; an operational reconciliation job remains future work because object storage and PostgreSQL cannot commit atomically.
- `STORAGE_DRIVER=disabled` default keeps existing authentication deployable without a storage provider. Configure `s3` plus the private endpoint/region/bucket/access credentials when ready; use `local` only in development. Do not use Render's ephemeral filesystem as production storage. Settings slots are in backend/.env.example; the user's private backend/.env was not changed.
- No upload HTTP endpoint is wired yet. BE-4.4 must add the documented draft/file/submit/delete routes, CSRF/Origin boundary, rate limits, body reception bounds and upload-token issuance after draft creation. Staff publication and public media delivery follow BE-4.5–4.7.

## Validation

`pytest -q`: **98 passed**, including 32 upload cases and 66 existing identity/property tests. `ruff check .`: passed; `mypy app`: passed (34 source modules). One initial PDF-library mypy mismatch was corrected with runtime dictionary type checks. PostgreSQL tests use isolated local data only; S3 uses SDK stubs and fake credentials. Video probe behavior is mocked, not validated against a local ffprobe executable. Docker not built (Docker unavailable). Upstream Starlette TestClient and a pypdf test-helper deprecation warning remain.

Implementation references: [Pillow image validation](https://pillow.readthedocs.io/en/stable/reference/Image.html), [Pillow metadata security](https://pillow.readthedocs.io/en/stable/handbook/security.html), [Boto3 presigned access](https://docs.aws.amazon.com/boto3/latest/reference/services/s3/client/generate_presigned_url.html).

Dependency audit: isolated temporary `pip-audit -r backend/requirements.lock --no-deps --disable-pip` found **no known vulnerabilities** in the pinned set. Audit warned that pins are not hash-locked; it did not audit operating-system ffmpeg packages. No private configuration supplied to the audit tool.
