# openspec-learn-pet-project

Practice repo for OpenSpec. The **accounts** change adds a small portal stack:

- **`apps/api`** — Fastify REST API, SQLite, OIDC callback (PKCE), sessions, RBAC, invitations, audit logs.
- **`apps/web`** — Vue 3 + Pinia + Vue Router SPA (login/callback, team admin, recovery, internal ping).

### Local development

```bash
npm install
cd apps/api && npm run migrate && npm run seed   # optional demo company + invite
npm run dev:api    # terminal 1 — http://localhost:3000
npm run dev:web    # terminal 2 — http://localhost:5173
```

Copy `apps/api/.env.example` to `apps/api/.env` and set OIDC variables for real IdP login; without them, the SPA explains that OIDC is unset (non-prod test login is available for automated tests only).
