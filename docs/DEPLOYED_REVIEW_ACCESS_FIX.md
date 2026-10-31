> Access setup superseded by [UNIFIED_REVIEW_SIGN_IN.md](UNIFIED_REVIEW_SIGN_IN.md): server-issued roles, no public staff links or role picker, private host configuration required. Historical results below describe the earlier browser-only flow.

# Deployed team review access

Task: FE-3.6 — Deployed review access, PWA entry and money-field spacing
Objective: Make the backend-free walkthrough usable on a deployed review link as well as localhost, expose workspace entry inside the PWA, and prevent naira/amount overlap in every shared budget field.
Owner: Joint (Developer 2 authorized frontend work)
Branch: joint/FE-3.6-deployed-review-access (from updated main)
Dependencies: connected frontend flow merged; backend authentication remains unimplemented.
Contract: v0.2.0 unchanged; no endpoint calls, credentials or real provisioning.
Working assumption: user explicitly requests publicly deployable sample access for team review before backend implementation. Review access defaults on when the build flag is absent, while explicit false disables it. Six-character temporary access remains as previously approved. This changes the previous local-only/opt-in assumption; real auth and permissions remain separate.
Files: review config helper, access/auth UI, mobile Help, shared Input/SearchBudget, CSS, focused tests and documentation.
Acceptance: a production build with no local/public access flag can enter client/staff/admin sample views; explicit off switch works; PWA users can find Staff & admin; all budget amounts clear their prefix at 360/390/768/1280 including validation errors.
Tests: configuration boundaries, shared prefixed-input rendering, production-build browser login/navigation and numeric prefix geometry, existing connected journeys; lint/typecheck/unit/build/mock audit.
Out of scope: real backend authentication, real staff invitations, deployment-provider settings or publication without a supplied deployment connection.

## Results and deployment

- Root cause: earlier review access required `NEXT_PUBLIC_LOCAL_ACCESS=true` only present in ignored `.env.local`; hosted builds lacked it. Default-on helper now accepts an absent flag, accepts true and rejects false/invalid values. Unit coverage includes all boundaries.
- Workspace entry is visible in mobile Home/Explore Help, signed-in client Help, and client login/register. Existing staff/admin roles open their workspace directly; other visitors go to `/staff/login` and choose their sample role. Existing footer link remains.
- Input prefix uses an independent control wrapper with vertically centered symbol, 16px inset and 40px text start padding; shared by all SearchBudget renderers. Removed page-specific 28px overrides and label-relative top positioning. Labels, hints and error associations remain intact.
- Production build passed with `NEXT_PUBLIC_LOCAL_ACCESS` removed from both process environment and the ignored local file. The original local file was restored byte-for-byte afterward. 373 static pages generated.
- **113/113 unit tests (18 files)** and **21/21 browser tests** passed, including hosted-equivalent client/admin sign-in with no credential POSTs, PWA entry, all connected journeys, mobile auth/browse and desktop search. Prefix geometry checked on inquiry/staff/responsive-reference routes at 360/390/768/1280, both valid and invalid amounts; no overlap or horizontal overflow. Mobile filter/desktop search regression tests passed.
- Screenshot inspected: `/tmp/kofa-budget-prefix-fixed.png`; original brown/cream appearance preserved and prefix/amount clearly separated.
- Existing deployed code can be enabled immediately by setting the hosting environment's **NEXT_PUBLIC_LOCAL_ACCESS=true** and rebuilding/redeploying. For this new code, absence defaults on, but a hosting setting explicitly set to false must still be removed/changed and redeployed. Public flags are evaluated at build time; reopening the installed PWA loads the new deployment.
- This repository task does not update a hosting account or live deployment. Default-on is for the explicitly requested backend-free team review only. Before real authentication/private records are integrated, disable/remove this adapter and implement server sessions/permissions. Contract unchanged; no live staff invitations, fees or business mutations.
- Final standalone typecheck, lint, mock-audit and diff whitespace checks passed. Reviewer found no contract/backend changes, new dependencies or credential persistence. Existing next-env edit and private environment file excluded from commit.
