import type { FastifyInstance } from "fastify";
import { requireInternalMfa } from "../plugins/authContext.js";

export async function registerInternalRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/internal/ping",
    { preHandler: requireInternalMfa },
    async (_req, reply) => {
      return reply.send({ ok: true, scope: "internal" });
    },
  );
}
