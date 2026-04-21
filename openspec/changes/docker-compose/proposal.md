## Why

The portal stack (`apps/api`, `apps/web`) runs on Node locally; there is no standard container workflow. **Docker Compose** gives one command to run the **API**, **web**, and **CockroachDB** together with stable ports and configuration—improving onboarding, CI parity, and alignment with the chosen **CockroachDB** persistence layer.

## What Changes

- Add **Dockerfiles** for the API and web (multi-stage builds where appropriate).
- Add **`docker-compose.yml`** defining **api**, **web**, and **cockroach** services on a shared network, with documented host ports and env wiring.
- Configure the API with **`DATABASE_URL`** pointing at the **CockroachDB** service (PostgreSQL wire protocol; `sslmode` per environment).
- Document **`.env` / `.env.example`** for Compose (including `CORS_ORIGIN`, `PUBLIC_WEB_ORIGIN`, `OIDC_*`, `DATABASE_URL`).
- Update **README** (or `docs/docker.md`) so `docker compose up` is the documented happy path alongside bare `npm` workflows.

## Capabilities

### New Capabilities

- `local-docker`: Requirements for running the stack **locally via Docker Compose**, including the **CockroachDB** service and connectivity from the API container.

### Modified Capabilities

- _(None.)_

## Impact

- **Repository:** Docker assets at repo root (or `deploy/docker/`), optional `.dockerignore`, README/docs updates.
- **Developers:** must understand **CockroachDB** in Compose (single-node dev image vs cluster in production); secrets via env files only.
- **Runtime:** OIDC redirect URIs and CORS must match the **published** browser origin for the mapped web port.
