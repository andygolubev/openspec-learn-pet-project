import { createHash, randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { exec, q, qOne } from "../db/index.js";
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

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

function mapUser(row: Record<string, unknown>): UserRow {
  return {
    id: String(row.id),
    oidc_sub: String(row.oidc_sub),
    email: String(row.email),
    company_id: row.company_id ? String(row.company_id) : null,
    created_at: num(row.created_at),
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function listRolesForUser(userId: string): Promise<string[]> {
  const rows = await q<{ role: string }>(
    `SELECT role FROM user_roles WHERE user_id = $1`,
    [userId],
  );
  return rows.map((r) => r.role);
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const row = await qOne<Record<string, unknown>>(
    `SELECT id, oidc_sub, email, company_id, created_at FROM users WHERE id = $1`,
    [userId],
  );
  return row ? mapUser(row) : null;
}

export async function getUserBySub(oidcSub: string): Promise<UserRow | null> {
  const row = await qOne<Record<string, unknown>>(
    `SELECT id, oidc_sub, email, company_id, created_at FROM users WHERE oidc_sub = $1`,
    [oidcSub],
  );
  return row ? mapUser(row) : null;
}

export async function ensureUserFromOidc(
  log: FastifyBaseLogger,
  input: {
    oidcSub: string;
    email: string;
    inviteToken?: string | null;
  },
): Promise<{ user: UserRow; roles: string[] }> {
  const existing = await getUserBySub(input.oidcSub);
  if (existing) {
    if (input.inviteToken && !existing.company_id) {
      await tryAcceptInvite(log, existing.id, existing.email, input.inviteToken);
    }
    const after = await getUserById(existing.id);
    if (!after) throw new Error("user missing after invite");
    return { user: after, roles: await listRolesForUser(after.id) };
  }

  const id = randomUUID();
  const now = Date.now();
  await exec(
    `INSERT INTO users (id, oidc_sub, email, company_id, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, input.oidcSub, input.email, null, now],
  );

  let companyId: string | null = null;
  if (input.inviteToken) {
    companyId = await tryAcceptInvite(log, id, input.email, input.inviteToken);
  } else {
    companyId = await tryAutoJoinPendingInviteByEmail(log, id, input.email);
  }

  if (companyId) {
    await exec(`UPDATE users SET company_id = $1 WHERE id = $2`, [
      companyId,
      id,
    ]);
    await exec(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, ROLES.CUSTOMER_USER],
    );
  }

  const user = await getUserById(id);
  if (!user) throw new Error("user missing after create");
  return { user, roles: await listRolesForUser(user.id) };
}

async function tryAutoJoinPendingInviteByEmail(
  log: FastifyBaseLogger,
  userId: string,
  email: string,
): Promise<string | null> {
  const em = email.toLowerCase();
  const row = await qOne<{ id: string; company_id: string }>(
    `SELECT id, company_id FROM invitations
     WHERE lower(email) = lower($1) AND status = 'pending' AND expires_at > $2
     ORDER BY created_at DESC LIMIT 1`,
    [em, Date.now()],
  );
  if (!row) return null;
  await exec(`UPDATE users SET company_id = $1 WHERE id = $2`, [
    row.company_id,
    userId,
  ]);
  await exec(`UPDATE invitations SET status = 'accepted' WHERE id = $1`, [
    row.id,
  ]);
  await exec(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, ROLES.CUSTOMER_USER],
  );
  await logAudit(log, {
    action: "invite_accepted",
    actorUserId: userId,
    targetType: "invitation",
    targetId: row.id,
    companyId: row.company_id,
    meta: { autoAcceptedByEmail: true },
  });
  return row.company_id;
}

async function tryAcceptInvite(
  log: FastifyBaseLogger,
  userId: string,
  email: string,
  rawToken: string,
): Promise<string | null> {
  const th = hashToken(rawToken);
  const inv = await qOne<{
    id: string;
    company_id: string;
    email: string;
    status: string;
    expires_at: unknown;
  }>(
    `SELECT id, company_id, email, status, expires_at FROM invitations WHERE token_hash = $1`,
    [th],
  );
  if (!inv || inv.status !== "pending" || num(inv.expires_at) < Date.now()) {
    return null;
  }
  if (inv.email.toLowerCase() !== email.toLowerCase()) {
    log.warn({ inviteId: inv.id }, "invite email mismatch");
    return null;
  }
  await exec(`UPDATE users SET company_id = $1 WHERE id = $2`, [
    inv.company_id,
    userId,
  ]);
  await exec(`UPDATE invitations SET status = 'accepted' WHERE id = $1`, [
    inv.id,
  ]);
  await exec(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
  await exec(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, ROLES.CUSTOMER_USER],
  );
  await logAudit(log, {
    action: "invite_accepted",
    actorUserId: userId,
    targetType: "invitation",
    targetId: inv.id,
    companyId: inv.company_id,
    meta: { accepted: true },
  });
  return inv.company_id;
}

export async function createSession(
  userId: string,
  mfaSatisfied: boolean,
  ttlMs: number,
): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await exec(
    `INSERT INTO sessions (id, user_id, expires_at, mfa_satisfied, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, now + ttlMs, mfaSatisfied, now],
  );
  return id;
}

export async function getSession(
  sessionId: string | undefined,
): Promise<{ userId: string; mfaSatisfied: boolean } | null> {
  if (!sessionId) return null;
  const row = await qOne<{
    user_id: string;
    mfa_satisfied: boolean;
    expires_at: unknown;
  }>(
    `SELECT user_id, mfa_satisfied, expires_at FROM sessions WHERE id = $1`,
    [sessionId],
  );
  if (!row || num(row.expires_at) < Date.now()) return null;
  return {
    userId: String(row.user_id),
    mfaSatisfied: !!row.mfa_satisfied,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await exec(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}

export async function getCompany(companyId: string) {
  const row = await qOne<{
    id: string;
    name: string;
    erp_customer_id: string | null;
    created_at: unknown;
  }>(
    `SELECT id, name, erp_customer_id, created_at FROM companies WHERE id = $1`,
    [companyId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    erp_customer_id: row.erp_customer_id,
    created_at: num(row.created_at),
  };
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

export function assertCustomerAdmin(
  user: UserRow,
  roles: string[],
  companyId: string,
) {
  assertCompanyMember(user, roles, companyId);
  if (!hasCustomerAdmin(roles)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
}

export async function createInvitation(
  log: FastifyBaseLogger,
  input: {
    companyId: string;
    email: string;
    createdByUserId: string;
  },
): Promise<{ id: string; token: string }> {
  const dup = await qOne<{ id: string }>(
    `SELECT id FROM invitations WHERE company_id = $1 AND lower(email) = lower($2) AND status = 'pending'`,
    [input.companyId, input.email],
  );
  if (dup) {
    const err = new Error("CONFLICT");
    (err as Error & { statusCode: number }).statusCode = 409;
    throw err;
  }
  const id = randomUUID();
  const token = randomUUID() + randomUUID();
  const th = hashToken(token);
  const now = Date.now();
  await exec(
    `INSERT INTO invitations (id, company_id, email, token_hash, status, expires_at, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)`,
    [
      id,
      input.companyId,
      input.email.toLowerCase(),
      th,
      now + INVITE_TTL_MS,
      input.createdByUserId,
      now,
    ],
  );
  await logAudit(log, {
    action: "invite_created",
    actorUserId: input.createdByUserId,
    targetType: "invitation",
    targetId: id,
    companyId: input.companyId,
    meta: { email: input.email },
  });
  return { id, token };
}

export async function listPendingInvitations(companyId: string) {
  const rows = await q<{
    id: string;
    email: string;
    status: string;
    expires_at: unknown;
    created_at: unknown;
  }>(
    `SELECT id, email, status, expires_at, created_at FROM invitations WHERE company_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
    [companyId],
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    status: r.status,
    expiresAt: num(r.expires_at),
    createdAt: num(r.created_at),
  }));
}

export async function revokeInvitation(
  log: FastifyBaseLogger,
  companyId: string,
  inviteId: string,
  actorUserId: string,
): Promise<boolean> {
  const row = await qOne<{ id: string }>(
    `SELECT id FROM invitations WHERE id = $1 AND company_id = $2 AND status = 'pending'`,
    [inviteId, companyId],
  );
  if (!row) return false;
  await exec(`UPDATE invitations SET status = 'revoked' WHERE id = $1`, [
    inviteId,
  ]);
  await logAudit(log, {
    action: "invite_revoked",
    actorUserId,
    targetType: "invitation",
    targetId: inviteId,
    companyId,
  });
  return true;
}

export async function listMembership(companyId: string) {
  const users = await q<{ id: string; email: string; created_at: unknown }>(
    `SELECT id, email, created_at FROM users WHERE company_id = $1 ORDER BY email`,
    [companyId],
  );
  const out = [];
  for (const u of users) {
    out.push({
      userId: u.id,
      email: u.email,
      createdAt: num(u.created_at),
      roles: await listRolesForUser(u.id),
    });
  }
  return out;
}

export async function setUserRoles(
  log: FastifyBaseLogger,
  companyId: string,
  targetUserId: string,
  newRoles: string[],
  actorUserId: string,
): Promise<void> {
  const target = await getUserById(targetUserId);
  if (!target || target.company_id !== companyId) {
    const err = new Error("NOT_FOUND");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  const actor = await getUserById(actorUserId);
  if (target.id === actor?.id) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
  await exec(`DELETE FROM user_roles WHERE user_id = $1`, [targetUserId]);
  for (const r of newRoles) {
    await exec(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [
      targetUserId,
      r,
    ]);
  }
  await logAudit(log, {
    action: "role_changed",
    actorUserId,
    targetType: "user",
    targetId: targetUserId,
    companyId,
    meta: { roles: newRoles },
  });
}

export async function removeUserFromCompany(
  log: FastifyBaseLogger,
  companyId: string,
  targetUserId: string,
  actorUserId: string,
): Promise<void> {
  const target = await getUserById(targetUserId);
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
  await exec(`UPDATE users SET company_id = NULL WHERE id = $1`, [
    targetUserId,
  ]);
  await exec(`DELETE FROM user_roles WHERE user_id = $1`, [targetUserId]);
  await logAudit(log, {
    action: "user_removed",
    actorUserId,
    targetType: "user",
    targetId: targetUserId,
    companyId,
  });
}
