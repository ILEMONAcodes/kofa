# CI automation — BE-2.6 / FE-2.7

Task Brief: Joint, Backend lead; branch `joint/J-2.6-ci-automation`, based on current `origin/main` (`df2c583`). Objective: repeatable GitHub checks for backend and frontend before merge. Required documentation: implementation plan Phase 2, architecture testing/deployment guidance and existing test isolation rules. Files: `.github/workflows/{backend,frontend}.yml`, this handoff and progress tracker. Dependencies: existing locked dependencies, pytest/migration/OpenAPI tests and frontend scripts are available. Acceptance: pull requests and main pushes run checks; failures stop the job; disposable PostgreSQL; migration upgrade/downgrade; OpenAPI drift; dependency audits. Validation: actionlint, existing local lint/type/unit/build checks and migration/API tests where infrastructure is available. No API/schema change. No production credentials, database access, deployments or application feature changes. User explicitly requested both frontend and backend CI.

## Checks

Both workflows run on every pull request, pushes to main and manual dispatch. They deliberately have no path filter, so a required check is never left pending because only docs or shared files changed. They use read-only repository permissions, do not persist checkout credentials, and cancel superseded runs on the same ref. They do not use `pull_request_target` or repository/environment secrets.

Backend: Python 3.12, PostgreSQL 16 service with health checks, ffmpeg/ffprobe, locked pip dependencies, pip consistency, Ruff, mypy, regenerated OpenAPI compared against the tracked snapshot, empty-database migration round trip, full API/privacy/migration tests, separate 5,000-listing latency regression and strict locked-dependency audit. The latency assertion is unchanged. JUnit results are retained for seven days, even after failures. The existing seeded migration tests run as part of pytest.

All database variables point to the disposable localhost `kofa_auth_test_ci` database. Existing fixture guards reject non-local or incorrectly named databases. No Neon URL is supplied. The service is discarded with the runner; destructive migration tests must never be pointed at application databases.

Frontend: Node 22, `npm ci`, ESLint, Vitest, mock audit, production build, TypeScript and dependency audit (high/critical findings fail). Build precedes standalone typecheck because Next.js generates referenced route types. The API origin is an unreachable localhost address; no deployed backend is needed. Existing Playwright browser journeys are not included in these unit/build workflows; a dedicated real-stack browser job remains a follow-up.

## Enable in GitHub

After merging the workflows, inspect the first Actions runs. In the main branch ruleset/branch protection, require **Backend checks** and **Frontend checks**, plus the normal review requirement. YAML creates the checks; branch protection must be enabled separately by a repository administrator. No hosting settings or CI secrets are needed for these jobs. These workflows test code; they do not deploy it or migrate Neon.

Audits query public vulnerability registries. Findings or registry/network failures fail the step; no `continue-on-error` or vulnerability ignores are configured. Review and upgrade affected dependencies rather than suppressing findings. GitHub-hosted execution and a deliberately failing PR must be verified after push; local validation cannot establish hosted success or branch-protection enforcement.

## Local validation — 5 November 2026

- actionlint 1.7.12: both workflow files passed. The official release binary checksum was verified before use.
- Backend: Ruff, mypy (61 source files), pip consistency and OpenAPI regeneration/diff passed. Disposable localhost migration upgrade → base → head passed; pytest regression **518 passed, 1 deselected**; separate performance check **1 passed**, p95 **404.78 ms** on 5,000 listings (unchanged 500 ms target).
- Frontend: lint, **146 unit tests in 26 files**, mock audit, production build and standalone typecheck passed. No active TEMP-MOCK handlers.
- Strict pinned backend dependency audit: no known vulnerabilities. Frontend audit exited successfully at the high/critical threshold but reported **eight moderate findings** in the minimatch/TypeScript-ESLint development dependency chain. These need a separately reviewed dependency update; no forced downgrade or advisory suppression was applied.
- Local tools were Python 3.13.12, Node 24.13.1 and PostgreSQL 18.4. Hosted workflows target the documented Python 3.12 / Node 22 / PostgreSQL 16 stack; hosted execution is still unverified. Clean dependency installs on that runner remain part of first-run acceptance.
- Original unrelated `.DS_Store`, generated `frontend/next-env.d.ts` changes and `docs/REGISTRATION_RECOVERY.md` were preserved and excluded. No private environment files were edited or uploaded. No production database operations occurred.

Remaining acceptance: first hosted Actions run, deliberately failing PR check, administrator-enabled required checks and other-developer review. Existing OpenAPI snapshot drift is enforced; this task does not claim to implement the separate BE-2.4 Markdown endpoint-index reconciliation tool.
