import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolvePtdsAuditDir, type PtdsPathOverrides } from "./paths.js";

type ConsentGrantFile = {
  allow_always: boolean;
  session_keys: string[];
};

const EMPTY_GRANTS: ConsentGrantFile = {
  allow_always: false,
  session_keys: [],
};

function resolveConsentGrantPath(auditDir: string): string {
  return path.join(auditDir, "consent-grants.json");
}

function readGrantFile(grantPath: string): ConsentGrantFile {
  try {
    const raw = readFileSync(grantPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ConsentGrantFile>;
    return {
      allow_always: parsed.allow_always === true,
      session_keys: Array.isArray(parsed.session_keys)
        ? parsed.session_keys.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return { ...EMPTY_GRANTS };
  }
}

function writeGrantFile(grantPath: string, grants: ConsentGrantFile): void {
  mkdirSync(path.dirname(grantPath), { recursive: true });
  writeFileSync(grantPath, `${JSON.stringify(grants, null, 2)}\n`, "utf8");
}

export function resolvePtdsConsentGrantPath(
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const auditDir = overrides?.auditDir?.trim() || resolvePtdsAuditDir(overrides, env);
  return resolveConsentGrantPath(auditDir);
}

export function hasPtdsDataAccessGrant(
  sessionKey: string,
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const grantPath = resolvePtdsConsentGrantPath(overrides, env);
  const grants = readGrantFile(grantPath);
  if (grants.allow_always) {
    return true;
  }
  return grants.session_keys.includes(sessionKey);
}

export function grantPtdsDataAccess(
  sessionKey: string,
  mode: "allow-once" | "allow-always",
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (mode === "allow-once") {
    return;
  }
  const grantPath = resolvePtdsConsentGrantPath(overrides, env);
  const grants = readGrantFile(grantPath);
  grants.allow_always = true;
  if (!grants.session_keys.includes(sessionKey)) {
    grants.session_keys.push(sessionKey);
  }
  writeGrantFile(grantPath, grants);
}

export function clearPtdsDataAccessGrants(
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const grantPath = resolvePtdsConsentGrantPath(overrides, env);
  writeGrantFile(grantPath, { ...EMPTY_GRANTS });
}
