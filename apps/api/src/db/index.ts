import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getDatabasePath } from "../config.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const file = getDatabasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function resetDbSingleton(): void {
  if (db) {
    db.close();
    db = null;
  }
}
