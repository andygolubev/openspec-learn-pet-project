/**
 * Optional demo seed: one company and a pending invitation (token printed once).
 * Run: npm run migrate && npm run seed --workspace @portal/api
 */
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "./index.js";

const DEMO_COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEMO_INVITE_TOKEN = "demo-invite-token";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function run() {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO companies (id, name, erp_customer_id, created_at) VALUES (?, ?, ?, ?)`,
  ).run(DEMO_COMPANY, "Demo Manufacturing Co.", "ERP-DEMO-001", now);

  const inviteId = randomUUID();
  const th = hashToken(DEMO_INVITE_TOKEN);
  const existing = db
    .prepare(`SELECT id FROM invitations WHERE token_hash = ?`)
    .get(th) as { id: string } | undefined;
  if (!existing) {
    db.prepare(
      `INSERT INTO invitations (id, company_id, email, token_hash, status, expires_at, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, NULL, ?)`,
    ).run(
      inviteId,
      DEMO_COMPANY,
      "colleague@example.com",
      th,
      now + 14 * 24 * 60 * 60 * 1000,
      now,
    );
  }

  console.log("Seed complete.");
  console.log(
    `Demo company id: ${DEMO_COMPANY} — open invite link with token "${DEMO_INVITE_TOKEN}" (e.g. /invite/${DEMO_INVITE_TOKEN})`,
  );
}

run();
