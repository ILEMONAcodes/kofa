# Kof’a — the doorway to your home

Verified property marketplace for Nigeria. Next.js frontend and FastAPI/PostgreSQL backend. Developer roles and collaboration rules: [AGENTS.md](AGENTS.md).

Authentication now uses persisted database accounts, Argon2id, cookie sessions and backend role checks. Password minimum: **8 characters**. Everyone signs in at `/login`; clients, staff and admins land in their assigned workspace. The initial admin uses a private seed command, then manages team accounts from Administration → Users.

Start with [backend setup](backend/README.md) and the [authentication handoff](docs/BACKEND_AUTHENTICATION.md). Private Neon connection strings belong in ignored `backend/.env`; never commit that file. Next.js uses only a server-side `API_ORIGIN` to reach FastAPI.

Local quick start after private environment configuration:

```sh
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python -m app.cli seed-admin
.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

In another terminal run `npm run dev` from `frontend/` and open `http://localhost:3000`. Install backend/frontend dependencies as described in their guides first. For deployment, FastAPI needs a Python/container host in addition to Neon and the Next.js host.

[API contract](docs/API_CONTRACT.md) · [Database schema](docs/DATABASE_SCHEMA.md) · [Progress](docs/PROGRESS.md). Authentication is integrated; property/inquiry/financial screens retain illustrative data until their separate API modules are implemented. SMTP and approved legal policy content require owner configuration before public launch.
