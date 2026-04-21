import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach } from "vitest";
import { resetConfigCache } from "../config.js";
import { getDb, resetDbSingleton } from "../db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeEach(() => {
  resetConfigCache();
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret-32chars-min!!";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  resetDbSingleton();
  const sql = readFileSync(
    join(__dirname, "../db/migrations/001_initial.sql"),
    "utf8",
  );
  getDb().exec(sql);
});

afterEach(() => {
  resetDbSingleton();
  resetConfigCache();
});
