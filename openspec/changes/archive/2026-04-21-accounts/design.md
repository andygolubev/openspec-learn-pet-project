## Context

The B2B portal targets manufacturers and maintenance organizations buying industrial MRO parts. The product vision is a single digital channel with ERP as system of record. **Accounts** are the foundation: every quote, order, and document action must be attributable to a **company** and a **user** with an appropriate **role**. Today, coordination is informal; this design scopes how the portal represents organizations and membership, integrates with **OAuth2/OIDC**, and stays aligned with ERP customer identity without duplicating ERP authority.

**Constraints:** Vue 3 + Pinia + Vue Router; REST APIs versioned and documented; secrets server-side; WCAG 2.2 AA on core journeys; data residency per deployment.

## Goals / Non-Goals

**Goals:**

- Model **portal organizations** (company accounts) with **one-to-many users** and stable linkage to ERP customer identifiers where the business requires it.
- Enforce **RBAC** for customer-facing roles (**customer user**, **customer admin**) and **internal** staff roles with clear separation (internal users MUST NOT inherit customer permissions by default).
- Deliver **invitation** and **password reset** flows that work with the chosen IdP (email delivery for notifications in phase 1).
- Use **OAuth2/OIDC** for browser and API access; require **MFA** for internal users via IdP policy or application enforcement (see Decisions).
- Emit **structured audit events** for sensitive account actions (invites, role changes, membership removal) for downstream logging/monitoring.

**Non-Goals:**

- Replacing ERP or syncing full customer master beyond agreed identifiers and validation rules.
- Full **SSO (SAML/OIDC)** for customer enterprises in the first implementation slice (captured as a phased follow-up).
- Building a standalone IAM product; preference is to delegate to a managed IdP where possible.
- Customer data residency export/delete automation beyond what legal later specifies (only hooks and requirements here).

## Decisions

| Decision | Choice | Rationale | Alternatives considered |
|----------|--------|-----------|-------------------------|
| Identity protocol | **OAuth2 / OIDC** for login and token issuance | Matches stack and enterprise expectations; standard libraries and IdP products | Custom session-only auth (higher risk, less interoperable) |
| Source of truth for users | **IdP + portal DB** for profile, membership, roles; IdP for credentials | Credentials stay in IdP; portal stores org linkage and RBAC | Full user replication only in portal (weak SSO story) |
| Organization model | **Tenant = company account**; users belong to exactly one company for v1 (unless product later requires multi-org users) | Simplifies RBAC and UX | Multi-org users from day one (complexity deferred unless required) |
| Customer roles | **customer user** (standard) and **customer admin** (manage users/invites for their company) | Matches proposal; maps cleanly to admin-only UI | Fine-grained custom roles per account (defer) |
| Internal users | **Separate internal role set** in the portal namespace; no shared role names with customer roles | Prevents accidental conflation in guards and audits | Single role table with a flag (more error-prone) |
| Invitations | **Admin-initiated invite** with email link; user completes IdP signup or login and is bound to org | Standard B2B pattern | Open self-signup to a company (usually unacceptable for B2B) |
| MFA | **Required for internal users** via IdP MFA enrollment or OIDC `acr`/`amr` checks | Matches security bar for staff | MFA optional (rejected for internal) |
| API authorization | **Bearer access tokens** + server-side RBAC checks; optional **BFF** pattern if SPA cannot hold client secrets | REST security baseline | Cookies-only without API tokens (possible later; OIDC usually token-based) |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| ERP customer key mismatch or duplicates | Define deterministic matching rules and reconciliation workflow; block invites or linking until resolved when data is ambiguous |
| IdP misconfiguration exposes wrong tenant | Enforce org id in token claims or server-side session; never trust client-only tenant selection |
| Invitation abuse or phishing perception | Short-lived tokens, rate limits, clear branding, audit logs |
| Role creep as features grow | Version roles in spec; use feature flags per capability later, not ad-hoc permissions in code only |
| SSO delay frustrates large customers | Document roadmap; keep IdP abstraction so SAML federation can attach without redesign |

## Migration Plan

1. **Provision** IdP realm/client for portal; configure redirect URIs, scopes, MFA policy for internal groups.
2. **Deploy** backend with org/user tables and RBAC; run migrations in maintenance window if needed.
3. **Backfill** or **onboard** initial companies: either manual admin creation or scripted import with ERP keys validated offline.
4. **Roll out** frontend: login, post-login org selection (if ever needed), customer admin screens for invites.
5. **Rollback**: disable new routes behind feature flag; revert migration only if schema incompatible (prefer forward fixes for auth issues).

## Open Questions

- Exact **ERP identifier** field(s) for linking a portal company to ERP (single customer number vs. ship-to hierarchy)—confirm with integration team.
- Whether **one user may belong to multiple companies** in the first release; design assumes **single company per user** unless product overrides.
- **Passwordless** vs. password + reset only for customers: may follow IdP capabilities.
- **Session length** and **refresh token** rotation policy—set with security team per risk tier.
