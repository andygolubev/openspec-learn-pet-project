## Context

The monorepo ships **`apps/api`** (Node/Fastify, **`pg`** to **CockroachDB**) and **`apps/web`** (Vite/Vue). The API uses **`DATABASE_URL`** (PostgreSQL-compatible). There is no unified container story; developers run Node and a separate CockroachDB instance or use Compose ad hoc.

## Goals / Non-Goals

**Goals:**

- **Dockerfiles** for API and web (lean runtime images; multi-stage builds).
- **`docker-compose.yml`** that starts **cockroach**, **api**, and **web** with a shared network, fixed ports, and env injection from **`.env`** (not committed).
- API **`DATABASE_URL`** targets the **CockroachDB** service hostname (e.g. `cockroach:26257`) inside Compose; document equivalent `sslmode` for local insecure vs TLS.
- **CockroachDB** persistence via a **named volume** for the CRDB data directory so single-node dev data survives restarts.
- **README** / short doc: `docker compose up`, migration steps, and OIDC URL notes.

**Non-Goals:**

- Production Kubernetes / cloud manifests.
- Multi-region CockroachDB clusters in Compose (single-node dev image is enough for this change).
- Hot-reload dev container profiles (optional follow-up).

## Decisions

| Decision | Choice | Rationale | Alternatives |
|----------|--------|-----------|----------------|
| Database in Compose | **CockroachDB** `start-single-node` (or official image) | Matches project **CockroachDB** decision; same SQL/HTTP as prod | Embedded SQLite in API (rejected—project uses CRDB) |
| API connection | **`DATABASE_URL`** with service DNS **`cockroach`** | Standard `pg` pool; no file DB path | File-based DSN (N/A) |
| Base image | **Node LTS** (e.g. Alpine/slim) for API | Matches `engines` | — |
| Web image | **Multi-stage**: build → **nginx** static | Same-origin proxy options for `/api` | `vite preview` in prod image (heavier) |
| Networking | **Single Compose network**; nginx or env for browser → API | OIDC/CORS match public origin | Host networking (less portable) |
| TLS to CRDB | **Insecure** for local Compose; **`sslmode=require`** documented for Cockroach Cloud | Dev simplicity | TLS everywhere in dev (optional) |

**SPA/API coupling:** Prefer **nginx reverse proxy** `/api` → `api:3000` so the browser uses one origin; set **`CORS_ORIGIN`** and **`PUBLIC_WEB_ORIGIN`** to that origin.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| OIDC redirect / CORS mismatch | Document external URL and IdP client redirect URIs for the mapped web port |
| CRDB memory on laptops | Document resource limits; single-node defaults |
| ARM vs x86 | Use multi-arch official images; document `platform` if needed |

## Migration Plan

1. Add Dockerfiles and Compose; verify `docker compose build`.
2. `docker compose up` → CRDB healthy, API migrates against `DATABASE_URL`, web serves, `/health` OK.
3. Document commands and env; keep bare `npm` workflows unchanged.

## Open Questions

- Default **host ports** for web and CRDB Admin UI (if exposed).
- Whether to ship **`docker-compose.override.yml.example`** for bind-mounting source (optional).
