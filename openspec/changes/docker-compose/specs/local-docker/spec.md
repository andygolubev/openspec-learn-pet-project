## ADDED Requirements

### Requirement: Docker images exist for API and web

The repository SHALL include build definitions (e.g. Dockerfiles) for **`apps/api`** and **`apps/web`** such that each service can be built into a container image without undocumented manual steps.

#### Scenario: API image builds

- **WHEN** a maintainer runs the documented container build command for the API
- **THEN** the build completes successfully and produces an image that can start the Fastify server

#### Scenario: Web image builds

- **WHEN** a maintainer runs the documented container build command for the web app
- **THEN** the build completes successfully and produces an image that serves the built SPA assets

### Requirement: Docker Compose runs API, web, and CockroachDB

The repository SHALL include a **Docker Compose** file that defines a **CockroachDB** service (PostgreSQL wire protocol) and **both** the API and web services on a shared Docker network, with documented TCP ports.

#### Scenario: Stack starts

- **WHEN** a developer runs the documented `docker compose up` (or equivalent) from the repository
- **THEN** CockroachDB, the API, and the web service start and the API can reach the database using the documented **`DATABASE_URL`**

### Requirement: API connects to CockroachDB via DATABASE_URL

The Compose documentation SHALL describe how the API container uses **`DATABASE_URL`** (including host, port, database name, and **`sslmode`**) to connect to the **CockroachDB** service—no reliance on a local SQLite file path for the containerized workflow.

#### Scenario: DATABASE_URL targets CockroachDB service

- **WHEN** a developer runs the stack as documented
- **THEN** the API uses the configured **`DATABASE_URL`** to open a PostgreSQL-compatible connection to CockroachDB

### Requirement: CockroachDB data persists for local Compose

The Compose definition SHALL persist CockroachDB data across container recreation for normal local use (e.g. **named volume** for the CRDB data directory or documented bind mount).

#### Scenario: Restart retains database

- **WHEN** a developer recreates the CockroachDB container and uses the same documented volume configuration
- **THEN** data previously stored in CockroachDB remains available for the API after migrations have been applied

### Requirement: Documented configuration for URLs and secrets

The Docker Compose documentation SHALL describe environment variables for **`DATABASE_URL`**, **`CORS_ORIGIN`**, **`PUBLIC_WEB_ORIGIN`**, **`SESSION_SECRET`**, and **`OIDC_*`** as applicable) so browser OAuth redirects and CORS match the deployed Compose URLs.

#### Scenario: Developer configures IdP for Compose URLs

- **WHEN** a developer follows the documentation to set env vars for the mapped host ports and registers matching redirect URIs in the IdP
- **THEN** they can complete OIDC login against the containerized web origin without changing application code solely for Docker

### Requirement: Health check for API service

The API container definition SHALL include a **healthcheck** that probes an HTTP liveness endpoint (e.g. **`GET /health`**) so orchestration and developers can detect a failed API process.

#### Scenario: Unhealthy API is detectable

- **WHEN** the API process is not responding successfully on the health endpoint
- **THEN** the container health status reflects failure within the documented check interval
