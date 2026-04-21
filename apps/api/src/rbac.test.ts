import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { buildApp } from "./app.js";
import { resetConfigCache } from "./config.js";
import { exec } from "./db/query.js";
import { resetPoolSingleton } from "./db/pool.js";
import { runMigrations } from "./db/runMigrations.js";
import { loginAs, ROLES, seedCompany, seedUser } from "./test/helpers.js";

async function truncateAll(): Promise<void> {
  await exec(
    `TRUNCATE audit_events, sessions, invitations, user_roles, users, companies CASCADE`,
  );
}

describe("RBAC, invites, MFA gating", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let dbReady = false;

  beforeAll(async () => {
    resetConfigCache();
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://root@127.0.0.1:26257/defaultdb?sslmode=disable";
    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "test-session-secret-32chars-min!!";
    process.env.CORS_ORIGIN = "http://localhost:5173";
    try {
      await resetPoolSingleton();
      await runMigrations();
      await truncateAll();
      dbReady = true;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "ECONNREFUSED") {
        console.warn(
          "[tests] CockroachDB not reachable; skipping integration tests. Start with: docker compose up -d cockroach",
        );
        dbReady = false;
        return;
      }
      throw e;
    }
  });

  afterAll(async () => {
    await resetPoolSingleton();
    resetConfigCache();
  });

  beforeEach(async () => {
    if (!dbReady) return;
    await truncateAll();
    app = await buildApp({ logger: false });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it.skipIf(!dbReady)("denies customer user from listing members (403)", async () => {
    const companyId = await seedCompany();
    const { id: uid } = await seedUser(companyId, [ROLES.CUSTOMER_USER]);
    const { cookie } = await loginAs(app!, uid);
    const res = await app!.inject({
      method: "GET",
      url: `/api/v1/companies/${companyId}/users`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it.skipIf(!dbReady)("allows customer admin to list members", async () => {
    const companyId = await seedCompany();
    const { id: adminId } = await seedUser(companyId, [ROLES.CUSTOMER_ADMIN]);
    const { cookie } = await loginAs(app!, adminId);
    const res = await app!.inject({
      method: "GET",
      url: `/api/v1/companies/${companyId}/users`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { members: unknown[] };
    expect(body.members.length).toBe(1);
  });

  it.skipIf(!dbReady)("invite lifecycle: create and list pending", async () => {
    const companyId = await seedCompany();
    const { id: adminId } = await seedUser(companyId, [ROLES.CUSTOMER_ADMIN]);
    const { cookie } = await loginAs(app!, adminId);

    const create = await app!.inject({
      method: "POST",
      url: `/api/v1/companies/${companyId}/invitations`,
      headers: { cookie },
      payload: { email: "new@example.com" },
    });
    expect(create.statusCode).toBe(201);

    const list = await app!.inject({
      method: "GET",
      url: `/api/v1/companies/${companyId}/invitations`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    const invites = JSON.parse(list.body) as {
      invitations: { email: string }[];
    };
    expect(invites.invitations.some((i) => i.email === "new@example.com")).toBe(
      true,
    );
  });

  it.skipIf(!dbReady)("blocks internal ping without MFA on session", async () => {
    const { id } = await seedUser(null, [ROLES.INTERNAL_STAFF]);
    const { cookie } = await loginAs(app!, id);
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/internal/ping",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe("MFA_REQUIRED");
  });

  it.skipIf(!dbReady)("rate limits invite creation after threshold", async () => {
    const companyId = await seedCompany();
    const { id: adminId } = await seedUser(companyId, [ROLES.CUSTOMER_ADMIN]);
    const { cookie } = await loginAs(app!, adminId);
    let lastStatus = 201;
    for (let i = 0; i < 35; i++) {
      const res = await app!.inject({
        method: "POST",
        url: `/api/v1/companies/${companyId}/invitations`,
        headers: { cookie },
        payload: { email: `bulk${i}@example.com` },
      });
      lastStatus = res.statusCode;
      if (res.statusCode === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
