# Accounts change — rollout checklist

Use this after implementation is deployed to staging or production. It complements automated tests (`npm run test` in `apps/api`).

## IdP registration (task 1.1)

- [ ] Create OAuth2/OIDC confidential client for the token exchange service (API).
- [ ] Register redirect URI exactly as `OIDC_REDIRECT_URI` (e.g. `http://localhost:5173/callback` for dev; production URL in prod).
- [ ] Configure allowed scopes: at least `openid`, `email`, `profile`.
- [ ] For internal staff: enable MFA in the IdP and ensure tokens include `amr` (or configure `OIDC_MFA_ACR_HINT`) so the API can set `mfa_satisfied` on the session.

## Environment and secrets

- [ ] Set `SESSION_SECRET` (≥32 characters) and restrict who can read it.
- [ ] Set `OIDC_*` variables from `apps/api/.env.example`.
- [ ] Set `PUBLIC_WEB_ORIGIN` and `CORS_ORIGIN` to the deployed SPA origin(s).
- [ ] Run database migrations before starting the API (`npm run migrate --workspace @portal/api`).

## Feature flags and rollback

- **Flags:** None wired in code; gate risky behavior via IdP (MFA policies) and deployment toggles at the load balancer if needed.
- **Rollback:** Revert the API and web deployments to the previous artifact; sessions stored in SQLite are ephemeral (cookie session ids). No automatic migration rollback is included—restore DB from backup if schema changed in a breaking way.

## Manual smoke tests on staging

- [ ] OIDC login end-to-end (PKCE): SPA → IdP → callback → session cookie → `/api/v1/auth/session` shows authenticated.
- [ ] Invite flow: admin creates invite; invitee opens `/invite/{token}`, signs in, lands in company with `customer_user`.
- [ ] Customer admin: Team page lists members and pending invitations; revoke works.
- [ ] Internal user without MFA: `/api/v1/internal/ping` returns `MFA_REQUIRED`; after MFA at IdP, new session allows ping.
- [ ] Account recovery: `/account/recovery` shows IdP recovery link from `/api/v1/auth/recovery`.

## Monitoring

- [ ] Confirm structured logs include `audit_event` for invites, role changes, and user removal (see API logger output).
