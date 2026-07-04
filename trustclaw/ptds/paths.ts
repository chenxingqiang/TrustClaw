import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TRUSTCLAW_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PTDS_SCHEMA_V11_SQL = path.join(TRUSTCLAW_ROOT, "ptds/schema/v1.1.sql");
export const PTDS_SEED_NRDL_GLP1_SQL = path.join(TRUSTCLAW_ROOT, "ptds/seeds/nrdl-glp1-seed.sql");
export const PTDS_TEMPLATE_DB = path.join(TRUSTCLAW_ROOT, "ptds/seeds/local_ptds.template.db");

/** Mirrors OpenClaw `resolveOpenClawStateSqliteDir` without importing core. */
export function resolvePtdsStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  const root = override
    ? path.resolve(override)
    : env.VITEST || env.NODE_ENV === "test"
      ? path.join(os.tmpdir(), "openclaw-test-state", String(process.pid))
      : path.join(os.homedir(), ".openclaw");
  return path.join(root, "state");
}

export type PtdsPathOverrides = {
  dbPath?: string;
  auditDir?: string;
  evidenceDir?: string;
};

export function resolvePtdsDbPath(
  overrides: PtdsPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (overrides.dbPath?.trim()) {
    return path.resolve(overrides.dbPath.trim());
  }
  const envOverride = env.TRUSTCLAW_PTDS_DB?.trim();
  if (envOverride) {
    return path.resolve(envOverride);
  }
  return path.join(resolvePtdsStateDir(env), "local_ptds.db");
}

export function resolvePtdsAuditDir(
  overrides: PtdsPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (overrides.auditDir?.trim()) {
    return path.resolve(overrides.auditDir.trim());
  }
  return path.join(resolvePtdsStateDir(env), "ptds-audit");
}

export function resolvePtdsEvidenceDir(
  overrides: PtdsPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (overrides.evidenceDir?.trim()) {
    return path.resolve(overrides.evidenceDir.trim());
  }
  return path.join(resolvePtdsStateDir(env), "ptds-evidence");
}
