import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getIssuer,
  isMfaSatisfiedFromClaims,
  isOidcConfigured,
  verifyIdTokenJwt,
} from "../auth/oidc.js";
import { loadConfig } from "../config.js";
import { ErrorCodes, sendError } from "../errors.js";
import {
  attachAuthFromCookie,
  getSessionCookieName,
} from "../plugins/authContext.js";
import {
  createSession,
  deleteSession,
  ensureUserFromOidc,
  getUserById,
  listRolesForUser,
} from "../services/accountService.js";

const callbackBody = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(1),
  invite_token: z.string().optional(),
});

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function emailFromClaims(claims: Record<string, unknown>): string | null {
  const e = claims.email;
  if (typeof e === "string" && e.includes("@")) return e.toLowerCase();
  const p = claims.preferred_username;
  if (typeof p === "string" && p.includes("@")) return p.toLowerCase();
  return null;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  const cookieName = getSessionCookieName();

  app.get("/api/v1/auth/oidc/config", async (_req, reply) => {
    const config = loadConfig();
    if (!isOidcConfigured(config)) {
      return reply.send({
        configured: false,
      });
    }
    const issuer = await getIssuer(config);
    return reply.send({
      configured: true,
      issuer: config.OIDC_ISSUER,
      client_id: config.OIDC_CLIENT_ID,
      authorization_endpoint: issuer.metadata.authorization_endpoint,
      token_endpoint: issuer.metadata.token_endpoint,
      jwks_uri: issuer.metadata.jwks_uri,
    });
  });

  app.post("/api/v1/auth/oidc/callback", async (req, reply) => {
    const config = loadConfig();
    if (!isOidcConfigured(config)) {
      return sendError(
        reply,
        503,
        ErrorCodes.OIDC_NOT_CONFIGURED,
        "OIDC is not configured on the server",
      );
    }
    const parsed = callbackBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.message,
      );
    }
    const { code, code_verifier, invite_token } = parsed.data;

    try {
      const issuer = await getIssuer(config);
      const client = new issuer.Client({
        client_id: config.OIDC_CLIENT_ID!,
        client_secret: config.OIDC_CLIENT_SECRET!,
        redirect_uris: [config.OIDC_REDIRECT_URI!],
        response_types: ["code"],
      });
      const tokenSet = await client.callback(
        config.OIDC_REDIRECT_URI!,
        { code },
        { code_verifier },
      );
      let claims: Record<string, unknown> = (tokenSet.claims() ??
        {}) as Record<string, unknown>;
      if (tokenSet.id_token) {
        claims = await verifyIdTokenJwt(config, tokenSet.id_token);
      }
      const sub = typeof claims.sub === "string" ? claims.sub : null;
      if (!sub) {
        return sendError(
          reply,
          400,
          ErrorCodes.OIDC_ERROR,
          "Token missing subject (sub)",
        );
      }
      const email = emailFromClaims(claims);
      if (!email) {
        return sendError(
          reply,
          400,
          ErrorCodes.OIDC_ERROR,
          "Token missing email claim",
        );
      }
      const mfaOk = isMfaSatisfiedFromClaims(config, claims);
      const { user, roles } = await ensureUserFromOidc(req.log, {
        oidcSub: sub,
        email,
        inviteToken: invite_token ?? null,
      });
      const sid = await createSession(user.id, mfaOk, SESSION_TTL_MS);
      reply.setCookie(cookieName, sid, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          companyId: user.company_id,
          roles,
        },
      });
    } catch (e) {
      req.log.error(e);
      return sendError(
        reply,
        400,
        ErrorCodes.OIDC_ERROR,
        "OIDC token exchange or validation failed",
      );
    }
  });

  app.post("/api/v1/auth/logout", async (req, reply) => {
    const sid = req.cookies[cookieName];
    if (sid) await deleteSession(sid);
    reply.clearCookie(cookieName, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/api/v1/auth/session", async (req, reply) => {
    await attachAuthFromCookie(req);
    if (!req.auth) {
      return reply.send({ authenticated: false });
    }
    return reply.send({
      authenticated: true,
      user: {
        id: req.auth.user.id,
        email: req.auth.user.email,
        companyId: req.auth.user.company_id,
        roles: req.auth.roles,
        mfaSatisfied: req.auth.mfaSatisfied,
      },
    });
  });

  app.get("/api/v1/auth/recovery", async (_req, reply) => {
    const config = loadConfig();
    if (!config.OIDC_ISSUER) {
      return sendError(
        reply,
        503,
        ErrorCodes.OIDC_NOT_CONFIGURED,
        "OIDC issuer not configured",
      );
    }
    const origin = new URL(config.OIDC_ISSUER).origin;
    const path = config.OIDC_RECOVERY_PATH.startsWith("/")
      ? config.OIDC_RECOVERY_PATH
      : `/${config.OIDC_RECOVERY_PATH}`;
    const url = `${origin}${path}`;
    return reply.send({
      url,
      message:
        "Use your identity provider account recovery. The portal does not reset passwords directly.",
    });
  });

  /** Dev/test: establish session without OIDC (NODE_ENV !== production only) */
  app.post("/api/v1/auth/test-login", async (req, reply) => {
    const config = loadConfig();
    if (config.NODE_ENV === "production") {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, "Not found");
    }
    const body = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        body.error.message,
      );
    }
    const user = await getUserById(body.data.userId);
    if (!user) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, "User not found");
    }
    const roles = await listRolesForUser(user.id);
    const mfaOk = !roles.some((r) => r.startsWith("internal_"));
    const sid = await createSession(user.id, mfaOk, SESSION_TTL_MS);
    reply.setCookie(cookieName, sid, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        companyId: user.company_id,
        roles,
      },
    });
  });
}
