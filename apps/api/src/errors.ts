import type { FastifyReply } from "fastify";

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  OIDC_NOT_CONFIGURED: "OIDC_NOT_CONFIGURED",
  OIDC_ERROR: "OIDC_ERROR",
  MFA_REQUIRED: "MFA_REQUIRED",
} as const;

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
) {
  return reply.status(statusCode).send({
    error: { code, message },
  });
}
