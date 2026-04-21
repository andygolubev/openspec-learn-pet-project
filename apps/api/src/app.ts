import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCompanyRoutes } from "./routes/companies.js";
import { registerInternalRoutes } from "./routes/internal.js";

export async function buildApp(options?: { logger?: boolean | object }) {
  const config = loadConfig();
  const app = Fastify({
    logger:
      options?.logger !== undefined
        ? options.logger
        : config.NODE_ENV === "development"
          ? {
              transport: {
                target: "pino-pretty",
                options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
              },
            }
          : true,
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.get("/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerCompanyRoutes(app);
  await registerInternalRoutes(app);

  return app;
}
