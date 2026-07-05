import { randomBytes } from "node:crypto";
import { AuditRecorder } from "./record.js";

/** Operator reset — recorded as first event after audit file is cleared (governance §12). */
export function recordTraResetAudit(auditDir: string): string {
  const auditTrailId = `op_reset_${randomBytes(4).toString("hex")}`;
  const audit = new AuditRecorder({
    auditDir,
    auditTrailId,
    sessionId: "operator",
  });
  audit.record({
    step: "TRA_RESET",
    component: "TRA.Reset",
    input: { operator_action: "POST /api/tra/reset" },
    output: {
      cleared: [
        "local_tra.db personal rows",
        "consent-grants",
        "agent-domain-grants",
        "events.jsonl",
        "evidence ledger",
      ],
    },
    status: "SUCCESS",
  });
  return auditTrailId;
}
