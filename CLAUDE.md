# Kof'a — AI session instructions (read first)

**Kof'a** — *the doorway to your home* — is a verified property marketplace for Nigeria. This repository is built by two developers, each working with their own AI session. Before doing anything else, establish **which developer you are working for**.

## 1. Identify the role (required, every session)

1. Look for a local file named `.dev-role` in the repo root (it is git-ignored and personal). It contains exactly one word: `frontend` or `backend`.
2. If the file exists, say the role back in one line ("Working as Developer 1 (Frontend)") and carry on unless the developer corrects you. If the user's first message names a role, that message wins over the file.
3. If there is no file and no role in the message, **ask: "Are you Developer 1 (Frontend) or Developer 2 (Backend)?"** and do nothing else until answered. Do not read the task list, plan work, or edit anything before you have a role.
4. Never guess the role from the task, and never switch roles mid-session unless the developer says so.

| Role | Developer | Read | Branch prefix | Task IDs |
|---|---|---|---|---|
| `frontend` | Developer 1 | `agents/FRONTEND_DEVELOPER.md` | `fe/` | `FE-x.y` |
| `backend` | Developer 2 | `agents/BACKEND_DEVELOPER.md` | `be/` | `BE-x.y` |

Joint tasks (`J-x.y`) can be worked by either role; the task names a lead, and the other developer reviews the PR.

## 2. Working mode: flexible, no sign-off gates

Nobody has to sign anything before an AI session can work. `docs/DECISIONS.md` is a **record and a guide, not a lock**.

- **Proposed ADRs, PRD defaults and open-question (OQ-xx) defaults are usable as working assumptions.** Build on them. Do not wait for approval.
- Whenever you rely on one, **say so** in the Task Brief ("Assumes ADR-003 and OQ-07 default") and add a line under *Working assumptions* in `docs/DECISIONS.md` so the other developer can see it and object later.
- The developer in charge may override any assumption in the session. If they do, follow them and log the override the same way.
- Approvals in `docs/DECISIONS.md` can be added by either developer, whenever convenient. A missing approval is never a reason to stop.
- If a later review rejects an assumption, the cost of change is handled as a normal task, not as a failure of the AI session.

## 3. Then read, in this order

1. `agents/ORCHESTRATOR.md` — how tasks are chosen, briefed, tested, reviewed and reported.
2. Your role file from the table above.
3. `docs/PROGRESS.md` — current status, blockers, active mocks, contract status.
4. `docs/IMPLEMENTATION_PLAN.md` — only the task you will work on.
5. Only the sections of `PRD.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_SCHEMA.md`, `docs/UI_DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` that the task needs.

## 4. Boundaries (kept, but flexible)

- **Frontend session:** works in `frontend/**`, `docs/UI_DESIGN_SYSTEM.md`, `.github/workflows/frontend.yml`. No business logic in the UI.
- **Backend session:** works in `backend/**`, `docs/DATABASE_SCHEMA.md`, `.github/workflows/backend.yml`, `docker-compose.yml`. Do not redesign screens.
- **Shared files** (`PRD.md`, `docs/API_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/IMPLEMENTATION_PLAN.md`, `e2e/**`, `README.md`): you may edit them when the task needs it. Keep the change small, list it in the PR, and let the other developer review it at PR time. Never change a contract silently: bump the contract version and add a changelog row.
- **The other developer's area:** do not edit it on your own. Either raise a Change Request, or, if the developer in charge explicitly says to ("go ahead and touch `backend/` for this one"), do it on a separate branch and flag it in the PR.
- `docs/PROGRESS.md`: update the rows you own; the other developer can correct yours.

## 5. Every task

1. Check the task is workable: dependencies are Done or mockable, and the contract for it exists. Open questions do not block you; use the default as a working assumption (see section 2).
2. Write the **Task Brief** (template in `agents/ORCHESTRATOR.md` §4) and start. Pause for the developer's go-ahead only if they asked to review briefs first.
3. `git status` and `git fetch` first. Never overwrite, reset or discard changes you did not make. Never force-push. Never commit to `main`.
4. Work on `fe/<ID>-<slug>` or `be/<ID>-<slug>` (`joint/<ID>-<slug>` for joint tasks); one task per branch and per PR.
5. Run the required tests and report the **actual** results. Never claim a test passed without running it.
6. Update docs if a contract or architecture changed; update `docs/PROGRESS.md`; name the next task.
7. Do not implement more than one major module in a single task.

## 6. Without real subagents

Use the files in `agents/` as personas, one at a time, announcing each switch (`[HAT: BACKEND_DEVELOPER]`, then `[HAT: QA_TEST_ENGINEER]`, then `[HAT: CODE_REVIEWER]`). See `agents/ORCHESTRATOR.md` §9.

## 7. Stop and ask the developer in charge when

- The role is unknown (section 1).
- A contract or schema is ambiguous or two documents contradict each other.
- Work would touch the other developer's area and you were not told to.
- An action is destructive or irreversible (data deletion, history rewrite, production changes).
- Tests fail for an unknown reason after one honest investigation.
- The task would use **real** money, **real** user data, or send real data to an AI provider, or would publish legal or policy text as final. You can still build against interfaces and mocks without asking.
