import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AuditEvent, AuditStepCode } from "./types.js";

export type ReadAuditEventsOptions = {
  auditDir: string;
  limit?: number;
  steps?: readonly AuditStepCode[];
};

function resolveAuditEventsPath(auditDir: string): string {
  return path.join(auditDir, "events.jsonl");
}

export function readAuditEvents(options: ReadAuditEventsOptions): AuditEvent[] {
  const filePath = resolveAuditEventsPath(options.auditDir);
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
  const stepFilter = options.steps ? new Set<AuditStepCode>(options.steps) : null;
  const matched: AuditEvent[] = [];

  for (let index = lines.length - 1; index >= 0 && matched.length < limit; index -= 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    try {
      const event = JSON.parse(line) as AuditEvent;
      if (stepFilter && !stepFilter.has(event.step)) {
        continue;
      }
      matched.push(event);
    } catch {
      continue;
    }
  }

  return matched.reverse();
}

export const COMPLIANCE_AUDIT_STEPS = [
  "DATA_CONSENT",
  "COMPLIANCE_IMPORT",
  "REFERENCE_SYNC",
  "DEVICE_IMPORT",
] as const satisfies readonly AuditStepCode[];

export const CHAT_PIPELINE_AUDIT_STEPS = [
  "TEXT2SQL_GEN",
  "DB_QUERY",
  "RULE_EVAL",
  "AGENT_DECISION",
  "LEDGER_COMMIT",
] as const satisfies readonly AuditStepCode[];
