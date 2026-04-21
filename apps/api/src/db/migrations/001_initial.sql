-- Portal accounts: CockroachDB / PostgreSQL-compatible

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  erp_customer_id TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  oidc_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  company_id UUID REFERENCES companies (id),
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users (company_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_by_user_id UUID REFERENCES users (id),
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations (company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email_lower ON invitations (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  mfa_satisfied BOOL NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  ts BIGINT NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID,
  target_type TEXT,
  target_id TEXT,
  company_id UUID,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_events (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_events (ts);
