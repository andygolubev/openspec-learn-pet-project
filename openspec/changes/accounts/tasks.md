## 1. Identity and OIDC foundation

- [x] 1.1 Register OAuth2/OIDC client(s) with the chosen IdP (redirect URIs, scopes, confidential client for backend as needed).
- [x] 1.2 Implement backend OIDC validation (JWKS, issuer, audience) and session or token issuance strategy for the SPA and APIs.
- [x] 1.3 Add Vue login/callback routes and Pinia store for auth state; redirect unauthenticated users on protected routes.

## 2. Domain model and persistence

- [x] 2.1 Design and migrate schema for company accounts, ERP linkage fields, users, role assignments, and invitation records.
- [x] 2.2 Implement repository/services to bind IdP subject to portal user and company on first login and subsequent sessions.
- [x] 2.3 Enforce single-company-per-user rule in persistence and APIs unless product explicitly extends this.

## 3. RBAC and API surface

- [x] 3.1 Define role constants for `customer user`, `customer admin`, and internal roles; implement server-side authorization middleware.
- [x] 3.2 Expose versioned REST endpoints for company profile (read), membership list, role changes (admin/internal as per spec), and invitations.
- [x] 3.3 Document endpoints in OpenAPI and align error shapes with portal conventions.

## 4. Invitations and customer admin UX

- [x] 4.1 Implement invite creation, pending state, email notification integration, and invite acceptance flow tied to OIDC signup/login.
- [x] 4.2 Build Vue screens for customer admins: list users, send/revoke invites, change roles within policy (WCAG 2.2 AA on core paths).
- [x] 4.3 Add rate limiting and validation for invite endpoints.

## 5. MFA for internal users

- [x] 5.1 Configure IdP MFA policy for internal groups or enforce MFA via OIDC claims (`acr`/`amr`) in backend guards.
- [x] 5.2 Block internal-only APIs and UI until MFA requirement is satisfied; surface clear recovery UX if blocked.

## 6. Recovery and security hardening

- [x] 6.1 Wire password/account recovery entry points to IdP flows where passwords apply; ensure no unsafe account enumeration beyond agreed UX.
- [x] 6.2 Implement structured audit logging for invites, role changes, and user removal with actor, target, company, timestamp.

## 7. Verification and rollout

- [x] 7.1 Add automated tests for RBAC matrix, invite lifecycle, and MFA gating paths.
- [x] 7.2 Run manual test checklist on staging IdP; document feature flags and rollback steps for go-live.
