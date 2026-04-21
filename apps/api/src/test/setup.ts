import { beforeEach } from "vitest";
import { resetConfigCache } from "../config.js";

/** Default env for integration tests (requires CockroachDB on DATABASE_URL). */
beforeEach(() => {
  resetConfigCache();
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://root@127.0.0.1:26257/defaultdb?sslmode=disable";
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret-32chars-min!!";
  process.env.CORS_ORIGIN = "http://localhost:5173";
});
