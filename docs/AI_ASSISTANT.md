# Assistant workflow — BE-6.30 / BE-6.31 / FE-6.32/33

Task Brief: Joint, Backend lead; joint/BE-6.30-assistant-workflow based on support commit61afca4. User requests the complete connected assistant workflow and usage controls while they obtain a provider key. Dependencies: support/editorial, public browsing and inquiries implemented. Contract: API §4.9 Draft, adopted and specified through CR-ASSISTANT-001. Read plan6G, PRD5.8, architecture security/auth and support handoff. Changes: backend assistant models/migration/provider interface/retrieval/guards/API/tests, frontend chat/review/usage controls, contract/schema/progress.

Acceptance: published/public sources only; authenticated and anonymous scoped conversations; safe source-grounded answers; deterministic handoffs with support phone/hours; signed-in client message-team handoff creates a general inquiry with staff transcript; private staff review; admin enable/budget controls and aggregate usage; atomic global token/request ceilings, per-actor/IP limits, one in-flight turn/conversation; provider failure/disabled/budget→200 handoff; redaction and bounded retention. Tests: real local PostgreSQL API/authz/privacy/concurrency/migrations, ≥40 golden/red-team cases, frontend units/build and real-stack browser flow including mobile/axe. No live provider call, new production migration or deployment is authorized by this task. Provider remains disabled without private host configuration; deterministic test provider only in app_env=test. No API key, payment or real user data is needed for development.

Working assumptions: use a configurable chat-completions HTTP adapter rather than selecting a provider for the user. Model can select exact source quotations only; server verifies excerpts and builds citations, reducing unsupported generation. Input and source text are untrusted; no model-executed tools or SQL. Hard daily usage reserves a conservative UTF-8-byte input upper bound plus maximum output tokens before each call; reservations are not refunded on failure. This can stop early, intentionally. Provider billing/quota must also be capped at the provider; a token cap does not imply a currency guarantee. Public Help remains usable if assistant disabled. English initial scope. No financial workflows or outbound notifications.

## Provider setup when the key is ready

Keep these settings private on Render (the FastAPI service); do not place a key in frontend variables or Git:

```dotenv
ASSISTANT_PROVIDER=chat_completions
ASSISTANT_ALLOW_LIVE=true
ASSISTANT_API_URL=<provider full HTTPS chat-completions endpoint>
ASSISTANT_API_KEY=<private key>
ASSISTANT_MODEL=<provider model identifier>
ASSISTANT_HARD_TOKEN_LIMIT=100000
ASSISTANT_DAILY_REQUEST_LIMIT=100
ASSISTANT_MAX_OUTPUT_TOKENS=256
```

These lines are documentation placeholders, not usable credentials. Actual backend/.env is unchanged. Leave PROVIDER=disabled and ALLOW_LIVE=false until the provider/key/model have been checked. Then an admin can open `/admin/assistant-usage`, set a small daily token budget (zero stops calls), and enable the switch. Public effective readiness also requires a support phone. A host hard ceiling wins over any larger admin budget. Publish approved FAQ articles first; absent answers hand off rather than inventing information.

The adapter uses one non-streaming chat-completions request with max_tokens, temperature0 and a source-selection JSON instruction. No vendor is selected for the owner and no automatic fallback provider exists. Provider-specific endpoint/model/parameter support, billing/hidden-token treatment and a live golden-set run are required before enabling it. Reference protocol: [Hugging Face chat-completions specification](https://huggingface.co/docs/inference-providers/tasks/chat-completion). We have not verified any free plan entitlement; also configure the provider's quota/spending restrictions.

## App workflow

- Public/client launcher **Ask Kof’a**: disclosure, current support details, question/reply, verified source links, feedback, loading/error/offline fallback and manual new conversation. Text only; no HTML execution. Provider-unavailable mode keeps Help and team contact reachable.
- A1-day HttpOnly scoped cookie restores the chat across the existing sign-in page reload. No chat capability or key is written to local storage. Signed-in clients explicitly send the conversation to the team; anonymous users first sign in. Successful handoff transfers anonymous ownership, creates one general inquiry and stores the redacted transcript in staff-only notes. Logout/new-conversation clears the recovery cookie.
- Staff menu → `/staff/assistant`, with flagged/handoff-reason and inclusive WAT activity date filters; `/staff/assistant-review?id=...` for transcript/private review notes. Admin equivalents use `/admin`.
- Admin `/admin/assistant-usage`: switch, token budget, readiness, WAT daily request/token reservations, reported input/output usage, missing-usage count and remaining allowances. Support-contact edits preserve assistant settings. Provider key/URL never returned.
- One in-flight turn/conversation,20 answer pairs then final handoff, independent conversation/message/feedback limits and atomic global daily request/token ceilings. No retries, no tool loop, no full private transcript sent to the model. Failure/missing usage stays reserved; unexpected usage overrun closes remaining budget for that day. Counters are not currency bills.

## Deployment boundaries

New migration **be630_assistant** follows be629_support and is local-only until owner approval. No Neon migration, provider request, worker schedule, deployment or push occurred as part of implementation. Pending notifications remain on their separate branch; merge-head coordination still applies.

Retention worker: `python -m app.workers.assistant_retention --limit 100` is a dry run; `--apply` deletes eligible batches. Only transcripts and all their messages older than90 days, unflagged and not linked to an inquiry, are eligible. Recent/flagged/inquiry-linked data is retained; longer retention policy and scheduling remain pending. No production deletion was run.

## Validation and handoff status

Working assumptions: ADR-003 existing cookie authentication, J-6.28 public-only source/safety proposal frozen through CR-ASSISTANT-001; OQ-23 provider remains undecided and OQ-25 production FAQ content remains owner-authored. Test-only fictional articles are never seeded remotely. Existing httpx lock pin is promoted from development-only metadata to a runtime dependency; no package version was added/changed.

Full local backend regression:719 passed,1 separate property-latency case deselected. Final focused assistant/OpenAPI suite **96 passed**; final real-stack browser journey **1 passed** with360/768/1280px overflow/axe checks and screenshot review. Frontend160 unit tests passed, final focused widget3 passed, lint/typecheck/build passed. Backend Ruff/mypy90 files/pip consistency passed. Dependency audits: backend no known vulnerabilities; frontend high/critical gate passed with seven existing moderate tooling findings.

The test catalogue includes40 deterministic handoff boundaries,10 grounded FAQ prompts, poisoned-source/PII/injection/unsupported-output cases, public-property privacy and exact-kobo price formatting, provider transport failures without retries, usage concurrency, capability-cookie/sign-in/logout ownership, retention guards and seeded migration roundtrip. These tests use local PostgreSQL and a deterministic test provider or HTTP mock transport. They do not establish live model quality; J-6.34 live-provider evaluation remains pending.

ORM/migration metadata comparison: zero differences. A5,000-row fictional local retrieval query executed in4.219ms with a sequential scan selected by PostgreSQL. A diagnostic assertion requiring GIN was too strict; a follow-up local seqscan-disabled EXPLAIN confirmed trigram-index eligibility. This diagnostic does not force the production planner or establish a p95 benchmark. All synthetic plan rows were rolled back; absence verified. No production data was read, inserted or deleted. Logout and password reset also clear the assistant recovery cookie.
