import type { FastifyReply, FastifyRequest } from "fastify";
import { ErrorCodes, sendError } from "../errors.js";
import {
  getSession,
  getUserById,
  listRolesForUser,
} from "../services/accountService.js";
import type { UserRow } from "../services/accountService.js";
import { isInternalRole } from "../roles.js";

export type AuthContext = {
  user: UserRow;
  roles: string[];
  sessionId: string;
  mfaSatisfied: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

const COOKIE = "portal_sid";

export function getSessionCookieName(): string {
  return COOKIE;
}

export async function attachAuthFromCookie(req: FastifyRequest): Promise<void> {
  const sid = req.cookies[COOKIE];
  const sess = getSession(sid);
  if (!sess) return;
  const user = getUserById(sess.userId);
  if (!user) return;
  const roles = listRolesForUser(user.id);
  req.auth = {
    user,
    roles,
    sessionId: sid!,
    mfaSatisfied: sess.mfaSatisfied,
  };
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await attachAuthFromCookie(req);
  if (!req.auth) {
    return sendError(reply, 401, ErrorCodes.UNAUTHORIZED, "Authentication required");
  }
}

export async function requireInternalMfa(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;
  const a = req.auth!;
  if (!isInternalRole(a.roles)) {
    return sendError(reply, 403, ErrorCodes.FORBIDDEN, "Internal access only");
  }
  if (!a.mfaSatisfied) {
    return sendError(
      reply,
      403,
      ErrorCodes.MFA_REQUIRED,
      "Multi-factor authentication is required for internal access",
    );
  }
}
