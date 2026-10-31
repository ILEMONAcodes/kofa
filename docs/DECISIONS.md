# Decision Log — Kof'a

**Flexible, not a gate (ADR-019).** This log records what the team has decided or is assuming. It does **not** block anyone, human or AI.

- Every entry starts as `Proposed`. A `Proposed` entry is **usable as a working assumption** right away.
- An entry becomes `Accepted` when either developer writes their name and date in the *Approved by* columns (ideally both, but no one waits for it).
- If a developer disagrees, they mark the entry `Revisit`, add a note, and the work is adjusted as a normal task.
- Business questions (OQ-xx) live in `PRD.md` §10.2. Their defaults are usable as working assumptions; when one is decided, record it here and update the PRD.

Status words: `Proposed` (in use as assumption) → `Accepted` (approved) · `Revisit` · `Superseded by ADR-0yy`.

Format of an entry: Context → Decision → Consequences → Alternatives considered.

## Approval table (task J-0.3 / J-1.1)

| Item | Status | Approved by Dev 1 (FE) | Approved by Dev 2 (BE) |
|---|---|---|---|
| PRD v0.2 MVP scope (PRD §6) | Proposed | | |
| Scope addition: AI assistant with call-line handoff (FR-AI-*, tasks 6G) — priority Should | Proposed | | |
| Complaint verify-before-action workflow (FR-CMP-04/05) | Proposed | | |
| CRM→marketplace vocabulary mapping (OQ-21) | Proposed | | |
| Exclusions: gateway, subscriptions, featured listings (OQ-22) | Proposed | | |
| ADR-001 … ADR-017 (014–017 added in v0.2) | Proposed (in use) | | |
| ADR-018 — Product name is Kof'a | Accepted (decided 2026-10-26 by the developers' request) | | |
| ADR-019 — Flexible working mode, role-first AI sessions | In use (requested 2026-10-26); other developer to acknowledge | | |

---

## ADR-001 — Product shape: managed marketplace with a staff-operated back office
- **Context:** The source is a marketplace proposal; the brief uses CRM terms.
- **Decision:** Build a public marketplace (search, detail, landlord form) plus a staff back office that runs verification, inquiries, inspections and transactions. Landlords are records, not users, in the MVP.
- **Consequences:** No landlord dashboard; approvals are recorded by staff with evidence.
- **Alternatives:** Landlord self-service accounts (rejected for MVP: slows launch, adds auth surface; deferred).

## ADR-002 — Single repository with `/frontend`, `/backend`, `/e2e`
- **Context:** Two developers, shared contract, shared E2E tests.
- **Decision:** Monorepo; CODEOWNERS enforces ownership; path-filtered CI.
- **Consequences:** One PR can touch contract + one side; cross-side changes need both reviewers.
- **Alternatives:** Two repos (contract drift risk, harder joint E2E).

## ADR-003 — Authentication: cookie sessions, same-origin proxy, CSRF header
- **Decision:** Short-lived JWT access token (15 min) and rotating opaque refresh token (14 days) in httpOnly cookies; non-httpOnly `csrf_token` cookie echoed in `X-CSRF-Token` on unsafe methods; Next.js rewrites `/api/*` to the backend so everything is same-origin. Argon2id hashing. Refresh reuse revokes the token family.
- **Consequences:** SSR pages can authenticate with forwarded cookies; no tokens in JS-readable storage; CORS disabled in production.
- **Alternatives:** Bearer tokens in localStorage (XSS exposure; rejected); third-party auth service (cost/complexity for MVP).

## ADR-004 — API conventions
- **Decision:** Versioned `/api/v1`; envelope `{data, meta}`; unified error envelope with stable codes; page-based pagination; comma-separated multi-filters; `snake_case`; optimistic `version` field. Full text in `docs/API_CONTRACT.md` §2.
- **Consequences:** Framework default errors must be overridden (BE-2.2).

## ADR-005 — Money as integer kobo; time as UTC
- **Decision:** All money `bigint` kobo + `currency` (NGN). All timestamps UTC `timestamptz`, ISO 8601 `Z` in API. UI converts to Africa/Lagos.
- **Alternatives:** `numeric(14,2)` naira (rounding/formatting ambiguity).

## ADR-006 — Enumerations as `varchar + CHECK`
- **Decision:** No PostgreSQL enum types. Allowed values live in code constants and CHECK constraints, and are mirrored in the contract.
- **Consequences:** Adding a status is a normal migration.

## ADR-007 — Landlords are records; staff record approvals
- **Decision:** No landlord login in MVP. Verification and landlord approval of price/description are recorded by staff with method, note and time. Any change to price or description invalidates the approval (BR-01).

## ADR-008 — No payment gateway or escrow in the MVP
- **Decision:** Ledger records payments made to approved company channels; fees are computed by the backend from configurable rules; gateway integration is a deferred task (J-6.13).
- **Reason:** Proposal §8 requires legal review before holding funds; removes PCI/webhook scope from MVP.

## ADR-009 — Notifications through a transactional outbox
- **Decision:** `email_outbox` rows written in the same transaction as the business change, sent by a worker with retry. In-app notifications are optional.

## ADR-010 — Contract-first with generated types and drift checks
- **Decision:** `docs/API_CONTRACT.md` is the human contract; backend exports OpenAPI; CI compares the endpoint set; frontend generates TypeScript types from OpenAPI.
- **Consequences:** Contract disagreements surface as CI failures, not integration surprises.

## ADR-011 — Git workflow
- **Decision:** `main` is protected. Branches: `fe/<task-id>-slug`, `be/<task-id>-slug`, `joint/<task-id>-slug`. One task per branch, one PR per task, squash-merge. Reviews by the other developer. Never force-push a branch you do not own; never commit to `main`; check `git status` and fetch before starting and do not overwrite another developer's uncommitted work.

## ADR-012 — Mock policy
- **Decision:** Temporary frontend mocks follow `docs/ARCHITECTURE.md` §8 (labelled, only for `Agreed` endpoints, audited in CI, removed before acceptance).

## ADR-013 — Agent instruction files define roles; they are also usable as personas
- **Decision:** `agents/*.md` are authoritative role instructions. If real subagents are unavailable, the current session adopts one role at a time by announcing it and following only that file, with the Orchestrator rules in force.

---

## ADR-014 — AI assistant with mandatory human handoff (added v0.2)
- **Context:** The team wants an assistant to answer routine questions at any hour, and a guaranteed route to people when it cannot help.
- **Decision:** A backend-hosted assistant that answers only from published knowledge articles and public property data, with deterministic guards (category rules, retrieval confidence, repeated-failure counter, output filter, provider-failure fallback) that trigger a handoff. **Every handoff and the widget header show the company call line and support hours**, from admin settings. Message-the-team handoff creates a general inquiry with the transcript. The LLM key and prompts never leave the server. Provider is behind an interface (OQ-23).
- **Consequences:** Needs a knowledge base with an owner (OQ-25), evaluation suites (BE-6.31), cost controls, a privacy review of what is sent to the provider, and staff review of flagged conversations.
- **Alternatives:** Third-party chat widget (less control over data and refusals); human-only chat (not available out of hours); model-decided handoff only (not reliable enough).

## ADR-015 — Error codes are an open set; clients degrade by HTTP status (added v0.2)
- **Decision:** New error codes are additive (minor version). Clients branch on HTTP status first, then on known codes; unknown codes show `message` with the `request_id`. Non-envelope failures become client-side synthetic codes (`UPSTREAM_ERROR`, `NETWORK_ERROR`, `TIMEOUT`). The server may emit only registered codes (tested).
- **Consequences:** `ApiError.code` is typed as `string`; contract §2.4 holds the registry.

## ADR-016 — Currency and formatting conventions (added v0.2)
- **Decision:** NGN only; integer kobo on the wire; `₦` + `en-NG` grouping for display; decimals only when kobo ≠ 0; compact form only in dense UI with full value in tooltip/aria; string-based input parsing; percentages as basis points; fees rounded half up in integer arithmetic on the backend only. Test vectors live in contract §2.10 and are reproduced in tests on both sides.

## ADR-017 — Complaints are verified before action; reporters are confidential (added v0.2)
- **Decision:** Reports and complaints are unverified allegations until staff record findings, evidence, an outcome and actions. Staff may apply a time-boxed precautionary hold (unpublish) for high-risk reasons; permanent actions are admin-only and need a substantiated or partially substantiated outcome. Reporter identity is staff-only; report counts never trigger automatic action and are never public.
- **Consequences:** Investigation fields and checks in the schema; an admin review of holds within 2 business days; generic outcome emails only.

---

## ADR-018 — Product name is Kof'a (added 2026-10-26)
- **Status:** Accepted. Closes the naming part of OQ-01.
- **Context:** Docs used "the Platform" and a placeholder brand.
- **Decision:** The product is **Kof'a**, tagline **"the doorway to your home"**. Docs and UI copy use "Kof'a". Code identifiers, package names, database names and URLs use the ASCII form `kofa` (no apostrophe).
- **Consequences:** Logo, brand colours and domain are still open under OQ-01 and remain a token swap in the design system. Legal pages (OQ-18) must use the registered business name once it is known.
- **Alternatives:** Keep the placeholder name until branding is complete (rejected: slows copywriting and design).

## ADR-019 — Flexible working mode; AI sessions are role-first (added 2026-10-26)
- **Status:** In use. Requested by a developer; the other developer acknowledges when convenient. Not a blocker.
- **Context:** Requiring both developers to sign `DECISIONS.md` before any AI session could work stalled the team and made work inflexible, especially with two AI sessions running in parallel.
- **Decision:** (1) Proposed ADRs, PRD defaults and OQ defaults are usable as working assumptions; sessions name them in the Task Brief and list them under *Working assumptions* below. (2) Every AI session must still establish the developer role (frontend or backend) before doing anything else, and asks if it does not know it. (3) Shared-file and cross-area changes are reviewed at PR time, not approved beforehand. (4) Phase order and `Agreed` contract status guide the work but do not gate it. (5) Sessions still stop for ambiguity, destructive actions, failing tests they cannot explain, and anything using real money, real user data or final legal text.
- **Consequences:** Faster parallel work. Some work may need rework if an assumption is later rejected; that is accepted as the cost of speed. The `Revisit` status exists for this.
- **Alternatives:** Keep the sign-off gate (rejected: too slow); drop the role question (rejected: sessions would edit each other's areas).

## Working assumptions (AI and developers append here)

- 2026-10-30 — FE-6.16 administration/support presentation: implement Figma 80:2309 as 50 explicitly fictional UI examples using the merged staff shell. Fee defaults remain illustrative; no configured rates, real payments/ledger changes, permanent case actions, invitations, publication, support contact details or AI-provider calls are introduced. Contract/service integration remains separate; Developer 2 continues authorized frontend work.

- 2026-10-30 — FE-4.14 mobile staff presentation: continue the established fictional design-preview approach for all 37 source views in Figma 79:2309. No frozen-service shapes, identity checks, publication decisions or signed-document access are implemented. Branch retains client preview commit 1564bba; real service integration remains separate. Developer 2 continues explicitly authorized frontend work.

- 2026-10-30 — FE-5.7 mobile client presentation: continue the existing labelled design-preview approach while API_CONTRACT §4.7/4.8 remains Draft. Figma records and outcomes are fictional examples; no service mutations or backend mocks are introduced. Developer 2 continues previously authorized frontend work.
Format: `date · role · task · assumption relied on (ADR/OQ) · status (open | confirmed | revisit)`

2026-10-26 · backend · FE-1.4 Figma starter slice · Developer 2 explicitly requested shared UI/UX work for both developers; use ADR-018 name and OQ-01 placeholder wordmark/palette from UI_DESIGN_SYSTEM. Figma-only design plus small shared handoff notes; frontend/backend source unchanged. See docs/FIGMA_STARTER.md. · open

2026-10-26 · backend · FE-1.4 brand refresh · Developer overrides OQ-01's provisional teal/text-wordmark direction with supplied brown/cream logo reference and editorial inspiration; explicitly requests a similar recreated SVG and app-like mobile flow. Adopt #643B29 brown, #F7F3EE cream, #E8C8A8 tan, DM Sans plus Instrument Serif accents; update Figma and UI_DESIGN_SYSTEM for frontend review. Logo/colour direction selected; domain remains open. See docs/FIGMA_BRAND_REFRESH.md. · confirmed

---

## Decisions pending (business) — see PRD §10.2
OQ-01 (logo, colours, domain only; the name is decided) … OQ-26. Defaults in the PRD are usable as working assumptions and do not need sign-off to proceed.

## Decision record template
```
## ADR-0xx — Title
- Date / Status (Proposed|Accepted|Superseded by ADR-0yy)
- Context
- Decision
- Consequences
- Alternatives considered
- Approved by (FE, BE)
```

2026-10-26 · backend · FE-1.4 complete flows · Developer confirms contact registration within the landlord listing flow, preserving ADR-001/007 and no landlord login. Uses ADR-003 and draft contract 0.2.0 for client authentication. Retain brown/cream app-style mobile and omit profile-picture requirements. Explicit shared-design authorization; no source or contract changes. See docs/FIGMA_COMPLETE_FLOWS.md. · confirmed by Developer 2

2026-10-26 · backend · FE-1.4 full frontend design inventory · Developer explicitly requested all remaining frontend designs. Uses ADR-001/003/007/014 and OQ-03/04/11/13/18/24 working defaults. Later modules remain conceptual design against PRD intent; API shapes are not mocked or implemented before freeze. Include Could-tier designs separately labelled optional, while retaining all Won’t exclusions. Legal pages contain review placeholders; support number is unset; fictional data only. · open

2026-10-28 · backend · FE-1.4 filter/control corrections · Developer explicitly removes bathroom filtering from the UI; actual bathroom counts remain on listings and landlord property entry. Add dropdown choices for selectable fields, conditional Other text entry for preferences, and ₦100,000 budget steppers. Preserve existing desktop/mobile visual identity. Fixed role/state/result enums do not accept arbitrary Other values. Existing optional API bathroom parameter stays for compatibility; no endpoint shape is removed. Custom preference persistence needs J-4.1/J-5.1 reconciliation. · developer override

2026-10-28 · backend · FE-2.3 frontend architecture · Developer explicitly authorizes frontend scaffolding. Assumes ADR-002 repository split, ADR-003 same-origin cookie/CSRF transport and draft API contract 0.2.0; J-2.1/FE-1.4 do not block a standalone foundation. Developer’s same-turn correction retains original Figma brown/cream, DM Sans and Instrument Serif; no Inter/teal theme override. Public `[id]` route segment carries the contract slug; `/list-your-property` redirects to `/landlord`, preserving no-account contact registration. Manual public types await FE-2.5/OpenAPI. · working assumptions

2026-10-28 · backend · FE-4.13 desktop homepage · Developer explicitly authorizes implementing frontend from Figma while Developer 1 is unavailable. Node 14:219 is the token/layout source; linked City/Transaction menus provide open states. Assumes draft API 0.2.0 for query keys only; static fictional design content stays labelled and no endpoint is mocked. Other maps to supported `q` text search with an explanatory hint, not a new taxonomy enum. Full live-data acceptance waits for FE-4.11/J-4.15. Mobile is a later pass; no Figma edits. · working assumptions

- 2026-10-28 — FE-4.11 desktop search: assumes API contract 0.2.0 Draft public query keys and current Figma 14:220/desktop menu references. Six source cards remain disclosed fictional design content; apply saves URL preferences without claiming live filtering. Homepage handoff hydrates only supplied constraints. Live API/mobile acceptance remains outstanding.

- 2026-10-28 — FE-4.12: assumes current Figma 14:221 public detail and API 0.2.0 Draft schema; existing three fictional cards resolve by slug, unknown slugs 404. Report/assistant dialogs are explicitly unavailable-service previews; no data is sent. Gallery has three actual photos and no fabricated video. Full API/mobile and FE-6 report/assistant workflows remain separate.

- 2026-10-29 — Mobile browse: current 43:979 frames define home/search/detail/filter presentation. User explicitly adds a primary-brown, centered-logo launch transition for PWA direction. Reuse original palette/assets; add standalone manifest/icons without offline data caching. No OS status indicators are faked. Draft API/service integration remains separate; shared desktop behavior is retained.

- **2026-10-29 — Mobile auth presentation (FE-3.5):** Developer 2 continues explicitly authorized frontend work. Figma 43:981 is implemented using existing brown/cream tokens and common controls. Backend auth remains unavailable: native validation provides presentation feedback without requests, credential persistence, policy acceptance recording or fake sessions. Explicitly labelled `/auth-preview/*` routes expose fictional success/account designs; `/account` stays signed out. Native validation is a temporary presentation choice; RHF/Zod, live policies, server errors/loading, sessions and real email-token flows remain integration work. No endpoint mocks or contract changes.

- **2026-10-29 — FE-4.10 mobile landlord:** Developer 2 continues authorized frontend work using Figma 43:983. Assumes OQ-13 file limits and existing no-account contact registration. Native validation/local in-memory media selection only; no actual uploads, draft saving, consent recording or receipt creation. Source optional email/Other preferences stay in the presentation model; API serialization awaits agreed field treatment. Only labelled preview mode contains sample receipt/uploads; backend remains authoritative. Required PRD description/landlord-conditions fields appear below the source property fields. Original theme retained; no endpoint mocks or contract changes.

- 2026-10-30 — FE-6.26 mobile media/help presentation: Developer 2 continues authorized frontend implementation of Figma 82:2309. Assumes OQ-13 file limits and OQ-18 draft-only policy copy. Uses fictional, disconnected service examples; support number stays unconfigured, no AI provider calls or real mutations. The branch retains unmerged administration presentation work as a dependency.

- 2026-10-30 — FE-4.14 verification/transactions presentation: Developer 2 continues authorized frontend work on Figma 91:14886. Eight source states are fictional design previews; server-owned verification, approval validity, publication guards, fee quotes and permissions remain unchanged. “Other” preferences are local design inputs, not additions to API enums. Media/help presentation is retained as the shared-renderer and disclosure-link dependency.

- 2026-10-31 — FE-4.14 mobile review/feedback references: Developer 2 continues authorized frontend work for Figma 117:17185. Six distinct source states retain fictional staff data and separate service/example outcomes; no actual signed documents, approval decisions or publication. Recovery text describes future server-driven behavior; no fabricated Retry-After timer or email send is introduced. Other preferences are local only; original theme retained, contract unchanged.
