import type { DatabaseSync } from "node:sqlite";
import { bootstrapPtdsDatabase } from "../../ptds/db.js";
import { readGlp1CheckSnapshot } from "../../ptds/query.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "../../ptds/paths.js";
import { evaluateGlp1Rules } from "./evaluate.js";
import type { NrdlPaymentRuleRow, RuleEvaluationResult } from "./types.js";

export function loadNrdlPaymentRules(db: DatabaseSync, drugId = "GLP1_SEMA"): NrdlPaymentRuleRow[] {
  return db
    .prepare(
      `SELECT rule_id, drug_id, rule_category, target_key, comparison_operator, comparison_value, alert_message
       FROM nrdl_payment_rules
       WHERE drug_id = ?
       ORDER BY rule_id`,
    )
    .all(drugId) as NrdlPaymentRuleRow[];
}

export function evaluateGlp1RulesFromDb(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): RuleEvaluationResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const db = bootstrapPtdsDatabase(dbPath);
  try {
    const snapshot = readGlp1CheckSnapshot(dbPath, env);
    const rules = loadNrdlPaymentRules(db);
    return evaluateGlp1Rules({ snapshot, rules });
  } finally {
    db.close();
  }
}

export { evaluateGlp1Rules } from "./evaluate.js";
export type {
  EvaluateGlp1RulesInput,
  NrdlPaymentRuleRow,
  RuleEvaluationEntry,
  RuleEvaluationMatrix,
  RuleEvaluationResult,
  RuleEvaluationStatus,
  RuleEvaluatorHandshake,
} from "./types.js";
