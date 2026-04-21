## 1. Docker build context

- [x] 1.1 Add root `.dockerignore` (or per-app ignores) excluding `node_modules`, `dist`, `.git`, and local env files from build contexts.
- [x] 1.2 Add `Dockerfile` for `apps/api` (multi-stage: install, build, run `node`; entrypoint or docs for migrations against `DATABASE_URL`).
- [x] 1.3 Add `Dockerfile` for `apps/web` (multi-stage: build Vite app, serve static assets with nginx or similar).

## 2. Compose stack with CockroachDB

- [x] 2.1 Add `docker-compose.yml` defining **`cockroach`** (single-node dev), **`api`**, and **`web`** services, shared network, and published ports.
- [x] 2.2 Wire **`DATABASE_URL`** on the API service to the CockroachDB service (e.g. `postgresql://root@cockroach:26257/defaultdb?sslmode=disable` for local insecure).
- [x] 2.3 Attach a **named volume** (or bind mount) for CockroachDB data persistence.
- [x] 2.4 Configure browser-safe routing: nginx reverse proxy `/api` to API or equivalent; set **`CORS_ORIGIN`** / **`PUBLIC_WEB_ORIGIN`** consistently.
- [x] 2.5 Add Compose **`healthcheck`** for the API targeting `GET /health`.

## 3. Configuration and documentation

- [x] 3.1 Add **`.env.docker.example`** (or extend `apps/api/.env.example`) listing **`DATABASE_URL`**, **`SESSION_SECRET`**, **`CORS_ORIGIN`**, **`PUBLIC_WEB_ORIGIN`**, **`OIDC_*`** for Compose.
- [x] 3.2 Update **README** (or `docs/docker.md`) with build/up/down commands, port map, **`npm run migrate`** (or equivalent) against CockroachDB, and OIDC redirect URI notes.

## 4. Verification

- [x] 4.1 Manually verify `docker compose build` and `docker compose up`; confirm web loads, `/health` OK, API migrations succeed, and CRDB data survives `docker compose down` + `up` with the same volume.
