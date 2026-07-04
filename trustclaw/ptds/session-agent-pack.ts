import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolvePtdsAuditDir, type PtdsPathOverrides } from "./paths.js";

type SessionAgentPackFile = {
  sessions: Record<string, string>;
};

const EMPTY_FILE: SessionAgentPackFile = {
  sessions: {},
};

function resolveSessionAgentPackPath(auditDir: string): string {
  return path.join(auditDir, "session-agent-packs.json");
}

function readSessionAgentPackFile(filePath: string): SessionAgentPackFile {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionAgentPackFile>;
    const sessions =
      parsed.sessions && typeof parsed.sessions === "object" && !Array.isArray(parsed.sessions)
        ? Object.fromEntries(
            Object.entries(parsed.sessions).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === "string" &&
                entry[0].trim().length > 0 &&
                typeof entry[1] === "string" &&
                entry[1].trim().length > 0,
            ),
          )
        : {};
    return { sessions };
  } catch {
    return { ...EMPTY_FILE };
  }
}

function writeSessionAgentPackFile(filePath: string, data: SessionAgentPackFile): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function resolvePtdsSessionAgentPackPath(
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const auditDir = overrides?.auditDir?.trim() || resolvePtdsAuditDir(overrides, env);
  return resolveSessionAgentPackPath(auditDir);
}

export function getSessionAgentPackId(
  sessionKey: string,
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = sessionKey.trim();
  if (!key) {
    return undefined;
  }
  const filePath = resolvePtdsSessionAgentPackPath(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  return file.sessions[key]?.trim() || undefined;
}

export function setSessionAgentPackId(
  sessionKey: string,
  packId: string,
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const key = sessionKey.trim();
  const id = packId.trim();
  if (!key || !id) {
    throw new Error("sessionKey and packId are required.");
  }
  const filePath = resolvePtdsSessionAgentPackPath(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  file.sessions[key] = id;
  writeSessionAgentPackFile(filePath, file);
}

export function clearSessionAgentPackId(
  sessionKey: string,
  overrides?: PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const key = sessionKey.trim();
  if (!key) {
    return;
  }
  const filePath = resolvePtdsSessionAgentPackPath(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  if (!(key in file.sessions)) {
    return;
  }
  delete file.sessions[key];
  writeSessionAgentPackFile(filePath, file);
}
