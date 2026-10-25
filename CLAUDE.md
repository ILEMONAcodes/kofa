# AI session instructions (read first)

This repository is built by two developers, each working with their own AI session. Before doing anything else, establish **which developer you are working for**.

## 1. Identify the role (required, every session)

1. Look for a local file named `.dev-role` in the repo root (it is git-ignored and personal). It contains exactly one word: `frontend` or `backend`.
2. If it does not exist, or the user's first message names a role, use the user's message. If neither gives a role, **ask: "Are you Developer 1 (Frontend) or Developer 2 (Backend)?"** and do nothing else until answered.
3. Never guess the role from the task, and never switch roles mid-session unless the user says so.

| Role | Developer | Read | Branch prefix | Task IDs |
|---|---|---|---|---|
| `frontend` | Developer 1 | `agents/FRONTEND_DEVELOPER.md` | `fe/` | `FE-x.y` |
| `backend` | Developer 2 | `agents/BACKEND_DEVELOPER.md` | `be/` | `BE-x.y` |

Joint tasks (`J-x.y`) can be worked by either, but the task names a lead; the other developer reviews and approves.

## 2. Then read, in this order

1. `agents/ORCHESTRATOR.md` — how tasks are chosen, briefed, tested, reviewed and reported.
2. Your role file from the table above.
3. `docs/PROGRESS.md` — current status, blockers, active mocks, contract status.
4. `docs/IMPLEMENTATION_PLAN.md` — only the task you will work on.
5. Only the sections of `PRD.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_SCHEMA.md`, `docs/UI_DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` that the task needs.

## 3. Boundaries (hard rules)

- **Frontend session:** edit only `frontend/**`, `docs/UI_DESIGN_SYSTEM.md`, `.github/workflows/frontend.yml`. Never edit `backend/**` or `docs/DATABASE_SCHEMA.md`. No business logic in the UI.
- **Backend session:** edit only `backend/**`, `docs/DATABASE_SCHEMA.md`, `.github/workflows/backend.yml`, `docker-compose.yml`. Never edit `frontend/**` or `docs/UI_DESIGN_SYSTEM.md`. Do not redesign screens.
- **Shared files** (`PRD.md`, `docs/API_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/IMPLEMENTATION_PLAN.md`, `e2e/**`, `README.md`): change only through the contract/change process in `agents/ORCHESTRATOR.md` §6, in a PR that the other developer approves. Never change a contract silently.
- `docs/PROGRESS.md`: update only the rows you own (joint rows by whoever finishes the task); the other developer confirms.
- If a task needs a file outside your area, **stop and raise a Change Request** instead of editing it.

## 4. Every task

1. Confirm the task is **ready** (dependencies Done, no open question, contract `Agreed`).
2. Produce the **Task Brief** (template in `agents/ORCHESTRATOR.md` §4) and wait for the developer's go-ahead.
3. `git status` and `git fetch` first. Never overwrite, reset or discard changes you did not make. Never force-push. Never commit to `main`.
4. Work on `fe/<ID>-<slug>` or `be/<ID>-<slug>` (`joint/<ID>-<slug>` for joint tasks); one task per branch and per PR.
5. Run the required tests and report the **actual** results. Never claim a test passed without running it.
6. Update docs if a contract or architecture changed; update `docs/PROGRESS.md`; name the next unblocked task.
7. Do not implement more than one major module in a single task.

## 5. Without real subagents

Use the files in `agents/` as personas, one at a time, announcing each switch (`[HAT: BACKEND_DEVELOPER]`, then `[HAT: QA_TEST_ENGINEER]`, then `[HAT: CODE_REVIEWER]`). See `agents/ORCHESTRATOR.md` §9.

## 6. Stop and ask the developer when

A task depends on an open question (`OQ-xx`); a contract or schema is ambiguous; work would touch the other developer's area; an action is destructive; tests fail for an unknown reason; the task involves legal, payment, privacy, or AI-assistant data decisions not yet approved.
