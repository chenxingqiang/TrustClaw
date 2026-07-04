import { createHash, randomBytes } from "node:crypto";
import { readGlp1CheckSnapshot, queryPtds } from "../../ptds/query.js";
import { evaluateGlp1RulesFromDb } from "../rules/index.js";
import { generateText2Sql } from "../text2sql/generate.js";
import { buildGlp1Decision } from "./glp1-decision.js";
import type { RunChatInput, RunChatOptions, RunChatResult, RuntimeContext } from "./types.js";

function createAuditTrailId(): string {
  return `aud_${randomBytes(8).toString("hex")}`;
}

function buildProofHash(context: Omit<RuntimeContext, "evidence_ledger_receipt">): string {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}

export async function runTrustclawChat(
  input: RunChatInput,
  options: RunChatOptions,
): Promise<RunChatResult> {
  const dbOverrides = options.dbPath ? { dbPath: options.dbPath } : {};
  const snapshot = readGlp1CheckSnapshot(dbOverrides);
  if (!snapshot) {
    return {
      ok: false,
      status: "ptds_not_initialized",
      message: "PTDS is not initialized. Call POST /api/ptds/init first.",
    };
  }

  const text2sql = await generateText2Sql({ userQuery: input.message }, { llm: options.llm });

  if (text2sql.security_error || !text2sql.handshake.handshake_payload.read_only_verification) {
    return {
      ok: false,
      status: "security_blocked",
      message: text2sql.security_error ?? "Text2SQL failed read-only verification.",
    };
  }

  const dbQuery =
    text2sql.sql.length > 0
      ? { raw_data: queryPtds(text2sql.sql, dbOverrides) }
      : { raw_data: { snapshot }, skipped: true as const };

  const ruleResult = evaluateGlp1RulesFromDb(dbOverrides);
  const agentDecision = buildGlp1Decision({
    userQuery: input.message,
    snapshot,
    matrix: ruleResult.matrix,
  });

  const partialContext = {
    session_id: input.session_id,
    user_query: input.message,
    pipeline_stages: {
      text2sql: {
        sql: text2sql.sql,
        duration_ms: text2sql.duration_ms,
        source: text2sql.source,
        ...(text2sql.security_error ? { security_error: text2sql.security_error } : {}),
      },
      db_query: dbQuery,
      rule_evaluation: {
        evaluated_rules: ruleResult.matrix.evaluated_rules,
        overall_status: ruleResult.matrix.overall_status,
        active_ruleset: ruleResult.matrix.active_ruleset,
      },
      agent_decision: agentDecision,
    },
    audit_trail_id: createAuditTrailId(),
  };

  const context: RuntimeContext = {
    ...partialContext,
    evidence_ledger_receipt: {
      block_height: 0,
      proof_hash: buildProofHash(partialContext),
    },
  };

  return { ok: true, context };
}
