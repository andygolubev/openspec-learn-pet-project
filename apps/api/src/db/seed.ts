/**
 * Optional demo seed: one company and a pending invitation.
 * Requires CockroachDB reachable via DATABASE_URL.
 * Run: npm run migrate && npm run seed --workspace @portal/api
 */
import { createHash, randomUUID } from "node:crypto";
import { closePool } from "./pool.js";
import { exec, qOne } from "./query.js";

const DEMO_COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEMO_INVITE_TOKEN = "demo-invite-token";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function run() {
  const now = Date.now();
  await exec(
    `INSERT INTO companies (id, name, erp_customer_id, created_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [DEMO_COMPANY, "Demo Manufacturing Co.", "ERP-DEMO-001", now],
  );

  const inviteId = randomUUID();
  const th = hashToken(DEMO_INVITE_TOKEN);
  const row = await qOne<{ n: number }>(
    `SELECT 1 AS n FROM invitations WHERE token_hash = $1`,
    [th],
  );
  if (!row) {
    await exec(
      `INSERT INTO invitations (id, company_id, email, token_hash, status, expires_at, created_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NULL, $6)`,
      [
        inviteId,
        DEMO_COMPANY,
        "colleague@example.com",
        th,
        now + 14 * 24 * 60 * 60 * 1000,
        now,
      ],
    );
  }

  console.log("Seed complete.");
  console.log(
    `Demo company id: ${DEMO_COMPANY} — invite token "${DEMO_INVITE_TOKEN}" (e.g. /invite/${DEMO_INVITE_TOKEN})`,
  );
  await closePool();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
