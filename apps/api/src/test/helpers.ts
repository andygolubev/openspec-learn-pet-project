import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { ROLES } from "../roles.js";

export function seedCompany(name = "Test Co") {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO companies (id, name, erp_customer_id, created_at) VALUES (?, ?, ?, ?)`,
    )
    .run(id, name, "ERP-T-1", now);
  return id;
}

export function seedUser(
  companyId: string | null,
  roles: string[],
  email?: string,
) {
  const id = randomUUID();
  const em = email ?? `u-${id.slice(0, 8)}@test.local`;
  const sub = `oidc-${id}`;
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO users (id, oidc_sub, email, company_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, sub, em, companyId, now);
  for (const r of roles) {
    getDb()
      .prepare(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`)
      .run(id, r);
  }
  return { id, email: em, sub };
}

export function sessionCookieFromResponse(headers: Record<string, unknown>): string {
  const raw = headers["set-cookie"];
  const line = Array.isArray(raw) ? raw[0] : raw;
  if (typeof line !== "string") return "";
  const m = line.match(/portal_sid=([^;]+)/);
  return m?.[1] ? `portal_sid=${m[1]}` : "";
}

export async function loginAs(app: FastifyInstance, userId: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/test-login",
    payload: { userId },
  });
  const cookie = sessionCookieFromResponse(res.headers);
  return { cookie, res };
}

export { ROLES };
