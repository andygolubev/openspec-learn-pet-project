import { createHash, randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { getDb } from "../db/index.js";
import { ROLES, hasCustomerAdmin, isInternalRole } from "../roles.js";
import { logAudit } from "./audit.js";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type UserRow = {
  id: string;
  oidc_sub: string;
  email: string;
  company_id: string | null;
  created_at: number;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function listRolesForUser(userId: string): string[] {
  const rows = getDb()
    .prepare(`SELECT role FROM user_roles WHERE user_id = ?`)
    .all(userId) as { role: string }[];
  return rows.map((r) => r.role);
}

export function getUserById(userId: string): UserRow | null {
  const row = getDb()
    .prepare(`SELECT id, oidc_sub, email, company_id, created_at FROM users WHERE id = ?`)
    .get(userId) as UserRow | undefined;
  return row ?? null;
}

export function getUserBySub(oidcSub: string): UserRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, oidc_sub, email, company_id, created_at FROM users WHERE oidc_sub = ?`,
    )
    .get(oidcSub) as UserRow | undefined;
  return row ?? null;
}

/**
 * Upsert user by OIDC subject; optionally attach company from pending invite matching email.
 */
export function ensureUserFromOidc(
  log: FastifyBaseLogger,
  input: {
    oidcSub: string;
    email: string;
    inviteToken?: string | null;
  },
): { user: UserRow; roles: string[] } {
  const db = getDb();
  const existing = getUserBySub(input.oidcSub);
  if (existing) {
    const roles = listRolesForUser(existing.id);
    if (input.inviteToken && !existing.company_id) {
      tryAcceptInvite(log, existing.id, existing.email, input.inviteToken);
    }
    const after = getUserById(existing.id)!;
    return { user: after, roles: listRolesForUser(after.id) };
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, oidc_sub, email, company_id, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.oidcSub, input.email, null, now);

  let companyId: string | null = null;
  if (input.inviteToken) {
    companyId = tryAcceptInvite(log, id, input.email, input.inviteToken);
  } else {
    companyId = tryAutoJoinPendingInviteByEmail(log, id, input.email);
  }

  if (companyId) {
    db.prepare(`UPDATE users SET company_id = ? WHERE id = ?`).run(companyId, id);
    db.prepare(
      `INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`,
    ).run(id, ROLES.CUSTOMER_USER);
  }

  const user = getUserById(id)!;
  return { user, roles: listRolesForUser(user.id) };
}

function tryAutoJoinPendingInviteByEmail(
  log: FastifyBaseLogger,
  userId: string,
  email: string,
): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, company_id FROM invitations WHERE email = ? AND status = 'pending' AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email.toLowerCase(), Date.now()) as
    | { id: string; company_id: string }
    | undefined;
  if (!row) return null;
  db.prepare(`UPDATE users SET company_id = ? WHERE id = ?`).run(
    row.company_id,
    userId,
  );
  db.prepare(`UPDATE invitations SET status = 'accepted' WHERE id = ?`).run(row.id);
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`,
  ).run(userId, ROLES.CUSTOMER_USER);
  logAudit(log, {
    action: "invite_accepted",
    actorUserId: userId,
    targetType: "invitation",
    targetId: row.id,
    companyId: row.company_id,
    meta: { autoAcceptedByEmail: true },
  });
  return row.company_id;
}

function tryAcceptInvite(
  log: FastifyBaseLogger,
  userId: string,
  email: string,
  rawToken: string,
): string | null {
  const db = getDb();
  const th = hashToken(rawToken);
  const inv = db
    .prepare(
      `SELECT id, company_id, email, status, expires_at FROM invitations WHERE token_hash = ?`,
    )
    .get(th) as
    | {
        id: string;
        company_id: string;
        email: string;
        status: string;
        expires_at: number;
      }
    | undefined;
  if (!inv || inv.status !== "pending" || inv.expires_at < Date.now()) {
    return null;
  }
  if (inv.email.toLowerCase() !== email.toLowerCase()) {
    log.warn({ inviteId: inv.id }, "invite email mismatch");
    return null;
  }
  db.prepare(`UPDATE users SET company_id = ? WHERE id = ?`).run(
    inv.company_id,
    userId,
  );
  db.prepare(`UPDATE invitations SET status = 'accepted' WHERE id = ?`).run(inv.id);
  db.prepare(`DELETE FROM user_roles WHERE user_id = ?`).run(userId);
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`,
  ).run(userId, ROLES.CUSTOMER_USER);
  logAudit(log, {
    action: "invite_accepted",
    actorUserId: userId,
    targetType: "invitation",
    targetId: inv.id,
    companyId: inv.company_id,
    meta: { accepted: true },
  });
  return inv.company_id;
}

export function createSession(
  userId: string,
  mfaSatisfied: boolean,
  ttlMs: number,
): string {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at, mfa_satisfied, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, userId, now + ttlMs, mfaSatisfied ? 1 : 0, now);
  return id;
}

export function getSession(sessionId: string | undefined): {
  userId: string;
  mfaSatisfied: boolean;
} | null {
  if (!sessionId) return null;
  const row = getDb()
    .prepare(
      `SELECT user_id, mfa_satisfied, expires_at FROM sessions WHERE id = ?`,
    )
    .get(sessionId) as
    | { user_id: string; mfa_satisfied: number; expires_at: number }
    | undefined;
  if (!row || row.expires_at < Date.now()) return null;
  return {
    userId: row.user_id,
    mfaSatisfied: row.mfa_satisfied === 1,
  };
}

export function deleteSession(sessionId: string): void {
  getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

export function getCompany(companyId: string) {
  return getDb()
    .prepare(
      `SELECT id, name, erp_customer_id, created_at FROM companies WHERE id = ?`,
    )
    .get(companyId) as
    | { id: string; name: string; erp_customer_id: string | null; created_at: number }
    | undefined;
}

export function assertCompanyMember(
  user: UserRow,
  roles: string[],
  companyId: string,
): void {
  if (user.company_id !== companyId) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
  if (isInternalRole(roles)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
}

export function assertCustomerAdmin(user: UserRow, roles: string[], companyId: string) {
  assertCompanyMember(user, roles, companyId);
  if (!hasCustomerAdmin(roles)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
}

export function createInvitation(
  log: FastifyBaseLogger,
  input: {
    companyId: string;
    email: string;
    createdByUserId: string;
  },
): { id: string; token: string } {
  const db = getDb();
  const dup = db
    .prepare(
      `SELECT id FROM invitations WHERE company_id = ? AND lower(email) = lower(?) AND status = 'pending'`,
    )
    .get(input.companyId, input.email) as { id: string } | undefined;
  if (dup) {
    const err = new Error("CONFLICT");
    (err as Error & { statusCode: number }).statusCode = 409;
    throw err;
  }
  const id = randomUUID();
  const token = randomUUID() + randomUUID();
  const th = hashToken(token);
  const now = Date.now();
  db.prepare(
    `INSERT INTO invitations (id, company_id, email, token_hash, status, expires_at, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(
    id,
    input.companyId,
    input.email.toLowerCase(),
    th,
    now + INVITE_TTL_MS,
    input.createdByUserId,
    now,
  );
  logAudit(log, {
    action: "invite_created",
    actorUserId: input.createdByUserId,
    targetType: "invitation",
    targetId: id,
    companyId: input.companyId,
    meta: { email: input.email },
  });
  return { id, token };
}

export function listPendingInvitations(companyId: string) {
  const rows = getDb()
    .prepare(
      `SELECT id, email, status, expires_at, created_at FROM invitations WHERE company_id = ? AND status = 'pending' ORDER BY created_at DESC`,
    )
    .all(companyId) as {
    id: string;
    email: string;
    status: string;
    expires_at: number;
    created_at: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

export function revokeInvitation(
  log: FastifyBaseLogger,
  companyId: string,
  inviteId: string,
  actorUserId: string,
): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id FROM invitations WHERE id = ? AND company_id = ? AND status = 'pending'`,
    )
    .get(inviteId, companyId) as { id: string } | undefined;
  if (!row) return false;
  db.prepare(`UPDATE invitations SET status = 'revoked' WHERE id = ?`).run(inviteId);
  logAudit(log, {
    action: "invite_revoked",
    actorUserId,
    targetType: "invitation",
    targetId: inviteId,
    companyId,
  });
  return true;
}

export function listMembership(companyId: string) {
  const users = getDb()
    .prepare(
      `SELECT id, email, created_at FROM users WHERE company_id = ? ORDER BY email`,
    )
    .all(companyId) as { id: string; email: string; created_at: number }[];
  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    createdAt: u.created_at,
    roles: listRolesForUser(u.id),
  }));
}

export function setUserRoles(
  log: FastifyBaseLogger,
  companyId: string,
  targetUserId: string,
  newRoles: string[],
  actorUserId: string,
): void {
  const db = getDb();
  const target = getUserById(targetUserId);
  if (!target || target.company_id !== companyId) {
    const err = new Error("NOT_FOUND");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  const actor = getUserById(actorUserId);
  if (target.id === actor?.id) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
  db.prepare(`DELETE FROM user_roles WHERE user_id = ?`).run(targetUserId);
  for (const r of newRoles) {
    db.prepare(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`).run(
      targetUserId,
      r,
    );
  }
  logAudit(log, {
    action: "role_changed",
    actorUserId,
    targetType: "user",
    targetId: targetUserId,
    companyId,
    meta: { roles: newRoles },
  });
}

export function removeUserFromCompany(
  log: FastifyBaseLogger,
  companyId: string,
  targetUserId: string,
  actorUserId: string,
): void {
  const db = getDb();
  const target = getUserById(targetUserId);
  if (!target || target.company_id !== companyId) {
    const err = new Error("NOT_FOUND");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (target.id === actorUserId) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
  db.prepare(`UPDATE users SET company_id = NULL WHERE id = ?`).run(targetUserId);
  db.prepare(`DELETE FROM user_roles WHERE user_id = ?`).run(targetUserId);
  logAudit(log, {
    action: "user_removed",
    actorUserId,
    targetType: "user",
    targetId: targetUserId,
    companyId,
  });
}
