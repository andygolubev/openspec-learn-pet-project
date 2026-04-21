import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { ErrorCodes, sendError } from "../errors.js";
import { requireAuth } from "../plugins/authContext.js";
import { ROLES } from "../roles.js";
import {
  assertCustomerAdmin,
  assertCompanyMember,
  createInvitation,
  getCompany,
  listMembership,
  listPendingInvitations,
  removeUserFromCompany,
  revokeInvitation,
  setUserRoles,
} from "../services/accountService.js";

const inviteBody = z.object({
  email: z.string().email(),
});

const patchRolesBody = z.object({
  roles: z
    .array(z.enum([ROLES.CUSTOMER_USER, ROLES.CUSTOMER_ADMIN]))
    .min(1),
});

const companyIdParam = z.object({
  companyId: z.string().uuid(),
});

const inviteIdParam = z.object({
  companyId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

const userIdParam = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function registerCompanyRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/companies/:companyId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const p = companyIdParam.safeParse(req.params);
      if (!p.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          p.error.message,
        );
      }
      const { companyId } = p.data;
      const a = req.auth!;
      try {
        assertCompanyMember(a.user, a.roles, companyId);
      } catch {
        return sendError(
          reply,
          403,
          ErrorCodes.FORBIDDEN,
          "Not a member of this company",
        );
      }
      const c = await getCompany(companyId);
      if (!c) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, "Company not found");
      }
      return reply.send({
        id: c.id,
        name: c.name,
        erpCustomerId: c.erp_customer_id,
        createdAt: c.created_at,
      });
    },
  );

  app.get(
    "/api/v1/companies/:companyId/invitations",
    { preHandler: requireAuth },
    async (req, reply) => {
      const p = companyIdParam.safeParse(req.params);
      if (!p.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          p.error.message,
        );
      }
      const { companyId } = p.data;
      const a = req.auth!;
      try {
        assertCustomerAdmin(a.user, a.roles, companyId);
      } catch {
        return sendError(
          reply,
          403,
          ErrorCodes.FORBIDDEN,
          "Customer admin required",
        );
      }
      return reply.send({
        invitations: await listPendingInvitations(companyId),
      });
    },
  );

  app.get(
    "/api/v1/companies/:companyId/users",
    { preHandler: requireAuth },
    async (req, reply) => {
      const p = companyIdParam.safeParse(req.params);
      if (!p.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          p.error.message,
        );
      }
      const { companyId } = p.data;
      const a = req.auth!;
      try {
        assertCustomerAdmin(a.user, a.roles, companyId);
      } catch {
        return sendError(
          reply,
          403,
          ErrorCodes.FORBIDDEN,
          "Customer admin required",
        );
      }
      return reply.send({ members: await listMembership(companyId) });
    },
  );

  app.patch(
    "/api/v1/companies/:companyId/users/:userId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const p = userIdParam.safeParse(req.params);
      const b = patchRolesBody.safeParse(req.body);
      if (!p.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          p.error.message,
        );
      }
      if (!b.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          b.error.message,
        );
      }
      const a = req.auth!;
      try {
        assertCustomerAdmin(a.user, a.roles, p.data.companyId);
        await setUserRoles(
          req.log,
          p.data.companyId,
          p.data.userId,
          b.data.roles,
          a.user.id,
        );
        return reply.send({ ok: true });
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        if (err.statusCode === 404) {
          return sendError(reply, 404, ErrorCodes.NOT_FOUND, err.message);
        }
        if (err.statusCode === 403) {
          return sendError(reply, 403, ErrorCodes.FORBIDDEN, err.message);
        }
        throw e;
      }
    },
  );

  app.delete(
    "/api/v1/companies/:companyId/users/:userId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const p = userIdParam.safeParse(req.params);
      if (!p.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          p.error.message,
        );
      }
      const a = req.auth!;
      try {
        assertCustomerAdmin(a.user, a.roles, p.data.companyId);
        await removeUserFromCompany(
          req.log,
          p.data.companyId,
          p.data.userId,
          a.user.id,
        );
        return reply.status(204).send();
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        if (err.statusCode === 404) {
          return sendError(reply, 404, ErrorCodes.NOT_FOUND, err.message);
        }
        if (err.statusCode === 403) {
          return sendError(reply, 403, ErrorCodes.FORBIDDEN, err.message);
        }
        throw e;
      }
    },
  );

  app.post(
    "/api/v1/companies/:companyId/invitations",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const p = companyIdParam.safeParse(req.params);
      const b = inviteBody.safeParse(req.body);
      if (!p.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          p.error.message,
        );
      }
      if (!b.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          b.error.message,
        );
      }
      const a = req.auth!;
      try {
        assertCustomerAdmin(a.user, a.roles, p.data.companyId);
      } catch {
        return sendError(
          reply,
          403,
          ErrorCodes.FORBIDDEN,
          "Customer admin required",
        );
      }
      const config = loadConfig();
      try {
        const { id, token } = await createInvitation(req.log, {
          companyId: p.data.companyId,
          email: b.data.email,
          createdByUserId: a.user.id,
        });
        const inviteUrl = `${config.PUBLIC_WEB_ORIGIN}/invite/${token}`;
        req.log.info({ inviteId: id, email: b.data.email }, "invitation_created");
        return reply.status(201).send({
          id,
          email: b.data.email,
          inviteUrl,
          expiresInDays: 14,
        });
      } catch (e) {
        const err = e as Error & { code?: string; statusCode?: number };
        if (
          err.message === "CONFLICT" ||
          err.statusCode === 409 ||
          err.code === "23505"
        ) {
          return sendError(
            reply,
            409,
            ErrorCodes.CONFLICT,
            "An active invitation may already exist for this email",
          );
        }
        throw e;
      }
    },
  );

  app.delete(
    "/api/v1/companies/:companyId/invitations/:inviteId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const p = inviteIdParam.safeParse(req.params);
      if (!p.success) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          p.error.message,
        );
      }
      const a = req.auth!;
      try {
        assertCustomerAdmin(a.user, a.roles, p.data.companyId);
      } catch {
        return sendError(
          reply,
          403,
          ErrorCodes.FORBIDDEN,
          "Customer admin required",
        );
      }
      const ok = await revokeInvitation(
        req.log,
        p.data.companyId,
        p.data.inviteId,
        a.user.id,
      );
      if (!ok) {
        return sendError(
          reply,
          404,
          ErrorCodes.NOT_FOUND,
          "Invitation not found",
        );
      }
      return reply.status(204).send();
    },
  );
}
