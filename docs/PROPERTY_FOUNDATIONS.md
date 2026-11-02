# BE-4.2 — property and upload metadata foundations

Task: BE-4.2. Objective: establish property-domain metadata before uploads.
Owner: Developer 2 (Backend). Branch: be/BE-4.2-property-foundations.
Documentation: DATABASE_SCHEMA §§1,4,9; API_CONTRACT §§3,4.4–4.7; IMPLEMENTATION_PLAN BE-4.2; ARCHITECTURE §10; PRD OQ-02/13.
Files: models, Alembic revision, taxonomy seed/CLI, tests and progress/decision/schema docs.
Dependencies: integrated identity; draft property contract used as working assumption (no API changes).
Acceptance: documented domain tables/constraints, landlord consent linkage, idempotent taxonomy seeds, reversible migration on empty and seeded isolated PostgreSQL preserving identity on task downgrade.
Tests: constraints, seed idempotency, migration up/down, backend lint/typecheck and full suite.
Out of scope: storage, HTTP endpoints, real data, Neon migrations and publication; subsequent separate tasks.
Assumes ADR-001, OQ-02 Abuja, OQ-13 default upload limits; candidate neighbourhood seeds remain editable data.

## Validation (2026-11-02)

- `pytest -q`: **66 passed**, including 35 property cases and 31 existing backend tests. Empty/full-baseline and seeded task rollback/re-upgrade validated on local PostgreSQL 18.4; SQL remains PostgreSQL 16-compatible.
- `ruff check .`: passed; `mypy app`: passed (30 source modules).
- Initial run: 66 passed with a text-index comparison warning; normalizing model/index operator declarations exposed one comparison failure (65 passed/1 failed). Investigation matched PostgreSQL's stored casts/parentheses; final run above passes without that warning. Upstream Starlette/httpx deprecation warning remains.
- No new HTTP/API behavior or dependency; contract stays v0.3.0. Schema record updated to v0.4. OpenAPI drift tooling/CI/dependency audit remain separate foundation work; no claim those were run. No frontend changes or remote operations.
- Storage/uploads follow as BE-4.3; models alone do not enable uploads on the deployed website.
