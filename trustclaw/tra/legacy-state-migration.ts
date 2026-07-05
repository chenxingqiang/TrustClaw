import { existsSync, renameSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { resolveTraStateDir } from "./paths.js";

const LEGACY_DB_FILE = "local_ptds.db";
const CANONICAL_DB_FILE = "local_tra.db";

const LEGACY_STATE_DIR_RENAMES: Array<[string, string]> = [
  ["ptds-audit", "tra-audit"],
  ["ptds-evidence", "tra-evidence"],
];

/** Rewrite legacy PTDS identifiers in SQL/text payloads to TRA naming. */
export function normalizeLegacyTraNaming(content: string): string {
  return content
    .replace(/\bptds_scopes\b/g, "tra_scopes")
    .replace(/\bptds_write\b/g, "tra_write")
    .replace(/\bptds\.read\b/g, "tra.read")
    .replace(/\bptds\.chat\b/g, "tra.chat")
    .replace(/\bptds\.write\b/g, "tra.write")
    .replace(/\bpack_id\s*=\s*'ptds-/g, "pack_id = 'tra-")
    .replace(/'ptds-([a-z0-9-]+)'/g, "'tra-$1'")
    .replace(/\bptds-([a-z0-9-]+)\b/g, "tra-$1");
}

function renameIfPresent(stateDir: string, fromName: string, toName: string): boolean {
  const fromPath = path.join(stateDir, fromName);
  const toPath = path.join(stateDir, toName);
  if (!existsSync(fromPath) || existsSync(toPath)) {
    return false;
  }
  renameSync(fromPath, toPath);
  return true;
}

/** Rename legacy TRA state files/dirs under ~/.openclaw/state (idempotent). */
export function migrateLegacyTraStateFiles(stateDir = resolveTraStateDir()): {
  dbRenamed: boolean;
  dirsRenamed: string[];
} {
  const dirsRenamed: string[] = [];
  const dbRenamed = renameIfPresent(stateDir, LEGACY_DB_FILE, CANONICAL_DB_FILE);
  for (const [fromName, toName] of LEGACY_STATE_DIR_RENAMES) {
    if (renameIfPresent(stateDir, fromName, toName)) {
      dirsRenamed.push(`${fromName}→${toName}`);
    }
  }
  return { dbRenamed, dirsRenamed };
}

function readColumnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/** Upgrade domain_agents rows/columns from PTDS-era schema to TRA naming. */
export function migrateLegacyDomainAgentsTable(db: DatabaseSync): boolean {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'domain_agents'")
    .all() as Array<{ name: string }>;
  if (tables.length === 0) {
    return false;
  }

  const columns = readColumnNames(db, "domain_agents");
  const hasLegacyScopes = columns.includes("ptds_scopes");
  const hasLegacyWrite = columns.includes("ptds_write");
  if (!hasLegacyScopes && !hasLegacyWrite) {
    if (columns.includes("tra_scopes")) {
      const hasPackId = columns.includes("pack_id");
      const setClauses = [
        "tra_scopes = REPLACE(REPLACE(tra_scopes, 'ptds.read', 'tra.read'), 'ptds.chat', 'tra.chat')",
      ];
      const whereClauses = ["tra_scopes LIKE '%ptds.%'"];
      if (hasPackId) {
        setClauses.push("pack_id = REPLACE(pack_id, 'ptds-', 'tra-')");
        whereClauses.push("pack_id LIKE 'ptds-%'");
      }
      db.prepare(
        `UPDATE domain_agents SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" OR ")}`,
      ).run();
    }
    return false;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE domain_agents__tra_migrate (
        agent_id        TEXT PRIMARY KEY,
        agent_name      TEXT NOT NULL,
        domain          TEXT NOT NULL,
        subdomain       TEXT,
        region          TEXT,
        insurance_type  TEXT,
        enabled         TEXT,
        tra_scopes      TEXT,
        tra_write       INTEGER,
        pack_id         TEXT,
        pack_version    TEXT,
        registered_at   TEXT
      );
    `);
    const legacyScopes = hasLegacyScopes ? "ptds_scopes" : "tra_scopes";
    const legacyWrite = hasLegacyWrite ? "ptds_write" : "tra_write";
    db.prepare(
      `INSERT INTO domain_agents__tra_migrate (
         agent_id, agent_name, domain, subdomain, region, insurance_type, enabled,
         tra_scopes, tra_write, pack_id, pack_version, registered_at
       )
       SELECT
         agent_id, agent_name, domain, subdomain, region, insurance_type, enabled,
         REPLACE(REPLACE(${legacyScopes}, 'ptds.read', 'tra.read'), 'ptds.chat', 'tra.chat'),
         ${legacyWrite},
         REPLACE(pack_id, 'ptds-', 'tra-'),
         pack_version,
         registered_at
       FROM domain_agents`,
    ).run();
    db.exec("DROP TABLE domain_agents");
    db.exec("ALTER TABLE domain_agents__tra_migrate RENAME TO domain_agents");
    db.exec("COMMIT");
    return true;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // preserve original error
    }
    throw error;
  }
}

/** Add pack_id to registry-v1 domain_agents rows and backfill from domain slug. */
export function ensureDomainAgentsPackSchema(db: DatabaseSync): boolean {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'domain_agents'")
    .all() as Array<{ name: string }>;
  if (tables.length === 0) {
    return false;
  }

  const columns = readColumnNames(db, "domain_agents");
  let changed = false;
  if (!columns.includes("pack_id")) {
    db.exec("ALTER TABLE domain_agents ADD COLUMN pack_id TEXT");
    changed = true;
  }

  const backfill = db
    .prepare(
      `UPDATE domain_agents
     SET pack_id = 'tra-' || domain
     WHERE pack_id IS NULL OR TRIM(pack_id) = ''`,
    )
    .run();
  if ((backfill.changes ?? 0) > 0) {
    changed = true;
  }

  const packsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'domain_agent_packs'")
    .all() as Array<{ name: string }>;
  if (packsTable.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS domain_agent_packs (
        pack_id         TEXT PRIMARY KEY,
        display_name_zh TEXT NOT NULL,
        display_name_en TEXT NOT NULL,
        domain          TEXT NOT NULL,
        pack_path       TEXT NOT NULL,
        version         TEXT NOT NULL DEFAULT '1.0.0',
        has_write       INTEGER NOT NULL DEFAULT 0,
        registered_at   TEXT DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT OR IGNORE INTO domain_agent_packs
        (pack_id, display_name_zh, display_name_en, domain, pack_path, has_write)
      VALUES
        ('tra-outpatient', '门诊医保报销', 'Outpatient Insurance Reimbursement', 'outpatient', 'tra-outpatient', 1),
        ('tra-inpatient', '住院医保结算', 'Inpatient Insurance Settlement', 'inpatient', 'tra-inpatient', 1),
        ('tra-pharmacy', '定点药店购药', 'Designated Pharmacy Drug Purchase', 'pharmacy', 'tra-pharmacy', 0),
        ('tra-cross-region', '异地就医报销', 'Cross-Region Medical Reimbursement', 'cross-region', 'tra-cross-region', 0),
        ('tra-audit', '医保稽核', 'Insurance Audit & Fraud Detection', 'audit', 'tra-audit', 0),
        ('tra-drg', 'DRG/DIP分组与结算', 'DRG/DIP Grouping & Settlement', 'drg', 'tra-drg', 0),
        ('tra-maternity', '生育保险', 'Maternity Insurance', 'maternity', 'tra-maternity', 1),
        ('tra-catastrophic', '大病保险', 'Catastrophic Illness Insurance', 'catastrophic', 'tra-catastrophic', 0),
        ('tra-medical-assistance', '医疗救助', 'Medical Financial Assistance', 'medical-assistance', 'tra-medical-assistance', 0),
        ('tra-tcm', '中医药医保报销', 'TCM Insurance Reimbursement', 'tcm', 'tra-tcm', 0);
    `);
    changed = true;
  }

  return changed;
}
