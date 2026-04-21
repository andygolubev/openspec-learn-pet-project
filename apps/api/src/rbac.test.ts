import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loginAs, ROLES, seedCompany, seedUser } from "./test/helpers.js";

describe("RBAC, invites, MFA gating", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it("denies customer user from listing members (403)", async () => {
    const companyId = seedCompany();
    const { id: uid } = seedUser(companyId, [ROLES.CUSTOMER_USER]);
    const { cookie } = await loginAs(app, uid);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/companies/${companyId}/users`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows customer admin to list members", async () => {
    const companyId = seedCompany();
    const { id: adminId } = seedUser(companyId, [ROLES.CUSTOMER_ADMIN]);
    const { cookie } = await loginAs(app, adminId);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/companies/${companyId}/users`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { members: unknown[] };
    expect(body.members.length).toBe(1);
  });

  it("invite lifecycle: create and list pending", async () => {
    const companyId = seedCompany();
    const { id: adminId } = seedUser(companyId, [ROLES.CUSTOMER_ADMIN]);
    const { cookie } = await loginAs(app, adminId);

    const create = await app.inject({
      method: "POST",
      url: `/api/v1/companies/${companyId}/invitations`,
      headers: { cookie },
      payload: { email: "new@example.com" },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
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

  it("blocks internal ping without MFA on session", async () => {
    const { id } = seedUser(null, [ROLES.INTERNAL_STAFF]);
    const { cookie } = await loginAs(app, id);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/internal/ping",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe("MFA_REQUIRED");
  });

  it("rate limits invite creation after threshold", async () => {
    const companyId = seedCompany();
    const { id: adminId } = seedUser(companyId, [ROLES.CUSTOMER_ADMIN]);
    const { cookie } = await loginAs(app, adminId);
    let lastStatus = 201;
    for (let i = 0; i < 35; i++) {
      const res = await app.inject({
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
