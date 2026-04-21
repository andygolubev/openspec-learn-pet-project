-- Portal accounts: companies, users, roles, invitations, sessions, audit

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  erp_customer_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  oidc_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE,
  company_id TEXT REFERENCES companies(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_by_user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  mfa_satisfied INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_user_id TEXT,
  target_type TEXT,
  target_id TEXT,
  company_id TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_events(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_events(ts);
