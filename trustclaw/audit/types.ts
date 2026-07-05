export type AuditStepCode =
  | "AGENT_DOMAIN_GRANT"
  | "COMPLIANCE_IMPORT"
  | "REFERENCE_SYNC"
  | "DEVICE_IMPORT"
  | "DATA_CONSENT"
  | "TRA_RESET"
  | "TEXT2SQL_GEN"
  | "DB_QUERY"
  | "RULE_EVAL"
  | "AGENT_DECISION"
  | "LEDGER_COMMIT";

/** Platform-bundled component ids; packs may declare additional names in `audit.*Component`. */
export const PLATFORM_AUDIT_COMPONENTS = [
  "TRA.AgentDomainGrant",
  "TRA.ComplianceImport",
  "TRA.ReferenceSync",
  "TRA.DeviceImport",
  "TRA.Consent",
  "TRA.Reset",
  "AgentRuntime.Text2SQL",
  "TRA.Query",
  "AgentRuntime.ExecRule",
  "Agent.GLP1Decision",
  "EvidenceLedger.Commit",
] as const;

export type PlatformAuditComponent = (typeof PLATFORM_AUDIT_COMPONENTS)[number];

/** Pack `audit.decisionComponent` / `ruleEvalComponent` may use names outside the platform list. */
export type AuditComponent = PlatformAuditComponent | (string & {});

export type AuditEventStatus = "SUCCESS" | "FAILURE" | "BLOCKED";

export type AuditEvent = {
  event_id: string;
  audit_trail_id: string;
  step: AuditStepCode;
  timestamp: number;
  component: AuditComponent;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: AuditEventStatus;
};

export type AuditRecorderOptions = {
  auditDir: string;
  auditTrailId: string;
  sessionId: string;
};
