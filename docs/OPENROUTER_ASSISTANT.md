# OpenRouter assistant setup

Task BE-6.30, Developer 2, branch `be/BE-6.30-openrouter-fallbacks`.
Objective: bounded free-model failover for provider outages and invalid answer JSON.
Scope: assistant provider/configuration/workflow, offline tests and shared decision/contract notes.
Dependencies: existing assistant API, usage reservations and public retrieval implemented.
Acceptance: at most four model attempts; no paid routing; unchanged source/safety validation;
no keys or conversation text in logs; preserve usage reservations across failures.
Tests: offline mocked HTTP failover, configuration, parsing, budget and assistant regressions.
No migration, new dependency, frontend redesign or live generation included.

## Local and Render settings

```dotenv
ASSISTANT_PROVIDER=openrouter
ASSISTANT_ALLOW_LIVE=true
ASSISTANT_API_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_API_KEY=
ASSISTANT_MODEL=inclusionai/ling-3.2-flash:free
ASSISTANT_FALLBACK_MODELS=particle-ai/particle-1:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,cohere/north-mini-code:free
ASSISTANT_MAX_OUTPUT_TOKENS=512
```

Fill the key privately in ignored `backend/.env` and Render's environment settings.
The previous `ASSISTANT_API_KEY` is preserved and unused by OpenRouter.
Restart the backend after changes. Keep local origins/cookies separate from Render's production values.

On 19 November 2026, all four selected IDs were present in the public catalogue with
zero prompt/completion pricing. The requested `perplexity/pplx-decider-v1.3:free` and
`respan/span-01-lite` were absent and are not configured. Catalogue presence does not
prove runtime availability or answer quality. Recheck before changing the list.

Ling and Particle advertise structured output: request strict JSON schema and require
parameter support. NVIDIA and Cohere use prompted JSON with strict local validation.
Reasoning is disabled to leave the small output allowance for the actual answer.
Only an exact JSON markdown fence is normalized; arrays and arbitrary prose are rejected.
After parsing, the existing safety, citation, exact-quote and fresh-visibility checks still run.
An unsafe answer or failed factual grounding hands off; it does not trigger more generation.

Each model is attempted once; maximum four. Retryable failures are HTTP404/408/429/500/502/503/504,
transport failures and malformed answer JSON. Authentication and other request errors stop.
No hidden provider fallback; zero prompt/completion price caps; provider data collection denied.
These restrictions may leave no available provider. Free-tier account quotas are shared:
switching models cannot bypass them.

A25-second admission deadline prevents starting another attempt after25 seconds.
Each attempt has at most8-second network inactivity timeout (connect at most5 seconds).
The bounded-body elapsed guard is checked between chunks, so this is not a hard wall-clock
deadline for a continuously trickling response. Frontend retains its existing timeout.
Reserve the first attempt before starting; atomically reserve each backup immediately before
its call. Stop if the shared allowance cannot cover that attempt. Unused backups are never
reserved. Do not refund attempted calls with unknown usage. Report accumulated known usage only when every attempted
call has known usage; otherwise retain the conservative unknown reservation. The daily request
counter counts user turns, not upstream attempts. No reset or budget increase.

References: [model catalogue](https://openrouter.ai/api/v1/models),
[provider routing and price/privacy limits](https://openrouter.ai/docs/guides/routing/provider-selection).

## Owner-approved local testing limits

The ignored local `.env` uses 5,000,000 daily reserved tokens, 1,000 user turns/day,
1,000 new conversations/day and 1,000 messages/hour for both guest and signed-in users.
Defaults in `.env.example` remain conservative. No existing usage rows are reset.

```dotenv
ASSISTANT_DAILY_TOKEN_BUDGET=5000000
ASSISTANT_HARD_TOKEN_LIMIT=5000000
ASSISTANT_DAILY_REQUEST_LIMIT=1000
ASSISTANT_GUEST_DAILY_CONVERSATIONS=1000
ASSISTANT_USER_DAILY_CONVERSATIONS=1000
ASSISTANT_GUEST_HOURLY_MESSAGES=1000
ASSISTANT_USER_HOURLY_MESSAGES=1000
```

These are Kof’a limits, not OpenRouter quota. Render requires these environment changes
and a deployment separately; local `.env` is never published. A code ceiling of10million
still caps daily allowance. Admission requires both the daily budget and host hard limit.

## Prepared deployment files

`backend/.env.render` is an ignored, private snapshot for Render import, containing existing
database/provider credentials with APP_ENV=production, COOKIE_SECURE=true and
PUBLIC_ORIGIN=https://frontend-lemon-psi-84.vercel.app. It excludes admin seed credentials
and the unused Google key. Do not commit, attach or paste this file into chat. Regenerate
or update it privately when credentials change; it is not automatically read by FastAPI.
Import its values into the Render backend environment, preserving any newer host settings.

`frontend/.env.production.local` sets API_ORIGIN=https://kofa-ep55.onrender.com for local
production builds. Because it is ignored, set API_ORIGIN separately in Vercel's Production
environment and redeploy. Keep backend/.env and frontend/.env.local for local development.
Merge/deploy the OpenRouter code before testing; old deployments do not support these settings.
No database migration is needed for this change.
