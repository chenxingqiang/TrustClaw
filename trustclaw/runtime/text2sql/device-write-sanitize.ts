import {
  DEVICE_IMPORT_ALLOWED_TABLES,
  isDeviceImportAllowedTable,
} from "./device-write-schema.js";

const FORBIDDEN_SQL_PATTERN =
  /\b(SELECT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA)\b/i;

const INSERT_TABLE_PATTERN = /^\s*INSERT\s+(?:OR\s+(?:IGNORE|REPLACE|ABORT|FAIL|ROLLBACK)\s+)?INTO\s+([a-zA-Z_][\w]*)/i;

export class DeviceImportSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceImportSecurityError";
  }
}

/** Strip markdown fences and commentary from model INSERT output. */
export function extractInsertSqlFromLlmOutput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const fenced = trimmed.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const lines = trimmed.split(/\r?\n/);
  const sqlLines: string[] = [];
  let started = false;
  for (const line of lines) {
    const candidate = line.trim();
    if (!started) {
      if (/^INSERT\b/i.test(candidate)) {
        started = true;
        sqlLines.push(candidate);
      }
      continue;
    }
    if (!candidate || candidate.startsWith("--")) {
      continue;
    }
    if (/^(here is|the sql|sql query|answer)/i.test(candidate)) {
      break;
    }
    sqlLines.push(candidate);
  }

  if (sqlLines.length > 0) {
    return sqlLines.join("\n").trim();
  }

  return trimmed.replace(/^sql:\s*/i, "").trim();
}

export function splitInsertStatements(sql: string): string[] {
  const trimmed = sql.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function extractInsertTables(sql: string): string[] {
  const names = new Set<string>();
  for (const statement of splitInsertStatements(sql)) {
    const match = statement.match(INSERT_TABLE_PATTERN);
    const table = match?.[1]?.trim();
    if (table) {
      names.add(table);
    }
  }
  return [...names].sort();
}

export function assertDeviceImportStatements(statements: string[]): {
  tables: string[];
} {
  if (statements.length === 0) {
    throw new DeviceImportSecurityError("No INSERT statements to execute.");
  }

  const tables = new Set<string>();
  for (const statement of statements) {
    if (!/^\s*INSERT\b/i.test(statement)) {
      throw new DeviceImportSecurityError("Only INSERT statements are allowed.");
    }
    if (FORBIDDEN_SQL_PATTERN.test(statement)) {
      throw new DeviceImportSecurityError("Forbidden SQL keyword detected.");
    }
    const match = statement.match(INSERT_TABLE_PATTERN);
    const table = match?.[1]?.trim();
    if (!table) {
      throw new DeviceImportSecurityError("Could not parse INSERT target table.");
    }
    if (!isDeviceImportAllowedTable(table)) {
      throw new DeviceImportSecurityError(
        `Table "${table}" is not allowed for device import. Allowed: ${DEVICE_IMPORT_ALLOWED_TABLES.join(", ")}.`,
      );
    }
    tables.add(table);
  }

  return { tables: [...tables].sort() };
}
