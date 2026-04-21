import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { getDb } from "../db/index.js";

export type AuditAction =
  | "invite_created"
  | "invite_accepted"
  | "invite_revoked"
  | "role_changed"
  | "user_removed";

export function logAudit(
  log: FastifyBaseLogger,
  input: {
    action: AuditAction;
    actorUserId: string | null;
    targetType: string;
    targetId: string;
    companyId: string | null;
    meta?: Record<string, unknown>;
  },
): void {
  const id = randomUUID();
  const ts = Date.now();
  const meta_json = input.meta ? JSON.stringify(input.meta) : null;
  getDb()
    .prepare(
      `INSERT INTO audit_events (id, ts, action, actor_user_id, target_type, target_id, company_id, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      ts,
      input.action,
      input.actorUserId,
      input.targetType,
      input.targetId,
      input.companyId,
      meta_json,
    );
  log.info(
    {
      audit: true,
      action: input.action,
      actorUserId: input.actorUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      companyId: input.companyId,
    },
    "audit_event",
  );
}
