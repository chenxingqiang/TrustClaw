import type { DatabaseSync } from "node:sqlite";
import { bootstrapPtdsDatabase, resolvePrimaryUserId } from "./db.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "./paths.js";
import type { Glp1CheckSnapshot, PtdsQueryResult } from "./types.js";

const FORBIDDEN_SQL_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA)\b/i;

export class PtdsQuerySecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PtdsQuerySecurityError";
  }
}

export function assertReadOnlySelectSql(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new PtdsQuerySecurityError("Empty SQL is not allowed.");
  }
  if (!/^\s*SELECT\b/i.test(trimmed)) {
    throw new PtdsQuerySecurityError("Only SELECT statements are allowed.");
  }
  if (FORBIDDEN_SQL_PATTERN.test(trimmed)) {
    throw new PtdsQuerySecurityError("Forbidden SQL keyword detected.");
  }
  if (trimmed.includes(";")) {
    const statements = trimmed.split(";").map((part) => part.trim()).filter(Boolean);
    if (statements.length !== 1) {
      throw new PtdsQuerySecurityError("Multiple SQL statements are not allowed.");
    }
  }
  return trimmed;
}

export function executePtdsSelect(db: DatabaseSync, sql: string): PtdsQueryResult {
  const safeSql = assertReadOnlySelectSql(sql);
  const statement = db.prepare(safeSql);
  const rows = statement.all() as Record<string, unknown>[];
  const columns = statement.columns().map((column) => column.name);
  return {
    columns,
    rows,
    row_count: rows.length,
  };
}

export function queryPtds(
  sql: string,
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): PtdsQueryResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const db = bootstrapPtdsDatabase(dbPath);
  try {
    return executePtdsSelect(db, sql);
  } finally {
    db.close();
  }
}

export function readGlp1CheckSnapshot(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): Glp1CheckSnapshot | null {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const db = bootstrapPtdsDatabase(dbPath);
  try {
    const userId = resolvePrimaryUserId(db);
    if (!userId) {
      return null;
    }
    const row = db
      .prepare("SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = ? LIMIT 1")
      .get(userId) as Glp1CheckSnapshot | undefined;
    return row ?? null;
  } finally {
    db.close();
  }
}

export function listPtdsTables(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const db = bootstrapPtdsDatabase(dbPath);
  try {
    const rows = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as Array<{ name: string }>;
    return rows.map((row) => row.name);
  } finally {
    db.close();
  }
}
