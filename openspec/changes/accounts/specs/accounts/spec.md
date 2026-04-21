## ADDED Requirements

### Requirement: Company account exists in the portal

The system SHALL represent each B2B customer organization as a **company account** with a stable internal identifier and any agreed **ERP customer identifier** fields required for integration.

#### Scenario: Company account is created for onboarding

- **WHEN** an authorized process creates a company account with valid ERP linkage data per integration rules
- **THEN** the system SHALL persist the company account and make it referenceable for user membership

### Requirement: Users belong to a company with roles

The system SHALL associate each portal user with exactly one company account for the current product version, and SHALL assign one or more **customer** roles (`customer user`, `customer admin`) or **internal** roles from the internal role set, without mixing customer and internal role namespaces on a single principal unless explicitly allowed by a future requirement.

#### Scenario: Customer user accesses portal

- **WHEN** a user with role `customer user` authenticates successfully
- **THEN** the system SHALL scope session authorization to that user’s company and SHALL deny access to internal-only capabilities

#### Scenario: Internal user accesses internal capabilities

- **WHEN** a user with an internal role authenticates and satisfies MFA policy for internal users
- **THEN** the system SHALL allow access only to internal capabilities permitted by that role and SHALL deny access to customer-admin-only actions that belong to customer tenants

### Requirement: Customer admin can invite users to their company

The system SHALL allow users with role `customer admin` to **invite** new users to the same company account via email, subject to rate limits and validation.

#### Scenario: Successful invite

- **WHEN** a `customer admin` submits a valid invite for an email address not already bound to another company in conflict with policy
- **THEN** the system SHALL create a pending invitation, send notification email, and record an audit event for the invite action

#### Scenario: Invite rejected for conflict

- **WHEN** an invite would violate uniqueness or tenancy rules
- **THEN** the system SHALL reject the operation with a clear error and SHALL NOT reveal whether an email exists in another tenant beyond what policy allows

### Requirement: Authentication uses OAuth2 and OIDC

The system SHALL use **OAuth2** and **OIDC** for user authentication and token-based access to APIs, using confidential client configuration for server-side components as appropriate.

#### Scenario: User signs in

- **WHEN** an unauthenticated user completes the OIDC authorization flow successfully
- **THEN** the system SHALL establish an authenticated session or equivalent token context suitable for calling protected APIs

### Requirement: Internal users must use MFA

The system SHALL require **multi-factor authentication** for users with internal roles before granting access to internal capabilities, enforced via IdP policy or application-level verification consistent with OIDC.

#### Scenario: Internal access blocked without MFA

- **WHEN** an internal user authenticates without satisfying the MFA requirement
- **THEN** the system SHALL block internal capabilities until MFA is satisfied per policy

### Requirement: Password and account recovery

The system SHALL support **password reset** or IdP-driven recovery flows for users where passwords are used, and SHALL integrate with the IdP’s documented recovery mechanisms so users can regain access without operator intervention for standard cases.

#### Scenario: User requests password reset

- **WHEN** a user initiates recovery from the portal and the IdP supports password-based credentials
- **THEN** the system SHALL initiate or redirect to the IdP recovery flow and SHALL not expose whether an email is registered beyond benign UX limits required by security policy

### Requirement: Audit sensitive account actions

The system SHALL emit audit records for sensitive account operations including **invitations**, **role changes**, and **removal of users** from a company, with actor identity, target, company context, and timestamp.

#### Scenario: Role change is audited

- **WHEN** a `customer admin` or authorized internal actor changes a user’s role
- **THEN** the system SHALL persist an audit record with sufficient detail for security review
