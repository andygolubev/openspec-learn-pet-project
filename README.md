# openspec-learn-pet-project

Practice repo for OpenSpec. Stack:

- **`apps/api`** — Fastify REST API, **CockroachDB** (via `pg` / `DATABASE_URL`), OIDC (PKCE), sessions, RBAC, invitations, audit logs.
- **`apps/web`** — Vue 3 + Pinia + Vue Router SPA.

### Prerequisites

- **Node 20+**
- **CockroachDB** for local API (single-node is fine), e.g. `docker compose up -d cockroach` using this repo’s `docker-compose.yml`, or any `DATABASE_URL` pointing at a running cluster.

### Local development (npm)

```bash
npm install
# Ensure DATABASE_URL in env (default in apps/api points at localhost:26257)
docker compose up -d cockroach   # or run CRDB yourself
cd apps/api && npm run migrate && npm run seed   # optional demo company + invite
npm run dev:api    # terminal 1 — http://localhost:3000
npm run dev:web    # terminal 2 — http://localhost:5173 (Vite proxies /api → :3000)
```

Copy `apps/api/.env.example` to `apps/api/.env` and set **OIDC_*** for real IdP login. For Compose behind nginx, use **`http://localhost:8080/callback`** as **OIDC_REDIRECT_URI** and register the same in your IdP.

### Docker Compose (API + web + CockroachDB)

```bash
cp .env.docker.example .env   # edit SESSION_SECRET (and OIDC if needed)
docker compose up --build
```

| Port | Service |
|------|---------|
| **8080** | Web (nginx) + proxied **`/api`** to the API |
| **3000** | API direct (optional debugging) |
| **26257** | CockroachDB SQL |
| **8081** | CockroachDB Admin UI |

The API container runs migrations on startup, then starts the server. Data is stored in the **`cockroach_data`** volume.

### Tests (API)

Integration tests expect a reachable database:

```bash
docker compose up -d cockroach
cd apps/api && npm test
```

Optional: `TEST_DATABASE_URL=postgresql://... npm test`
