## Why

The portal cannot deliver self-serve quotes and orders until customers and staff have a consistent, secure notion of **who** is acting: company identity, users, roles, and recovery flows. Today, identity and coordination are fragmented across email, PDFs, and phone; establishing **accounts** is the prerequisite for every authenticated journey and for auditability.

## What Changes

- Introduce **company (account) records** linked to ERP customer identity where applicable, with **multiple users** per company.
- Implement **role-based access** for portal users: at minimum **customer user** and **customer admin**; separate **internal roles** for staff (details in spec) with least-privilege defaults.
- Add **user invitation** flows for customer admins to add colleagues; **email-based account recovery** (password reset) aligned with OAuth2/OIDC.
- Define **authentication** expectations: OAuth2/OIDC for the portal; **MFA for internal users**; documented path to **SSO (SAML/OIDC)** for large customers in a later phase.
- Establish **audit hooks** for sensitive account actions (e.g. role changes, admin actions) in line with broader audit requirements—not full audit product scope in this change alone.

## Capabilities

### New Capabilities

- `accounts`: Portal identity and access for B2B companies and users—organizations, membership, customer and internal roles, invitations, password reset, and integration points for OAuth2/OIDC (and future SSO).

### Modified Capabilities

- _(None—no existing capability specs in `openspec/specs/` yet.)_

## Impact

- **Frontend**: Vue app routes, session handling, role-aware navigation and guards, invitation and reset UX (WCAG 2.2 AA on core journeys).
- **Backend / identity**: OAuth2/OIDC provider integration, token/session strategy, APIs for org/user/role management and invites; secrets and configuration in the agreed cloud region.
- **ERP / master data**: Mapping or linking portal companies/users to ERP customer records where required—no duplicate authoritative pricing or catalog outside ERP.
- **Operations**: Monitoring and logging for auth failures and admin actions; alignment with security reviews and incident process.
