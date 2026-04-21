import type { QueryResultRow } from "pg";
import { getPool } from "./pool.js";

export async function q<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const r = await getPool().query<T>(text, params);
  return r.rows;
}

export async function qOne<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function exec(text: string, params?: unknown[]): Promise<void> {
  await getPool().query(text, params);
}
