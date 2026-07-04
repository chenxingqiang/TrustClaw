import { describe, expect, it } from "vitest";
import {
  assertDeviceImportStatements,
  extractInsertSqlFromLlmOutput,
  splitInsertStatements,
} from "./device-write-sanitize.js";

describe("device-write-sanitize", () => {
  it("extracts INSERT SQL from fenced LLM output", () => {
    const sql = extractInsertSqlFromLlmOutput(
      "```sql\nINSERT INTO lab_test_results (recorded_at, test_code, test_value, test_unit, provenance_level, source_id) VALUES ('2026-07-01T08:00:00Z', 'HbA1c', 6.2, '%', 2, 'WEARABLE_API');\n```",
    );
    expect(sql).toMatch(/^INSERT\b/i);
    expect(splitInsertStatements(sql)).toHaveLength(1);
  });

  it("rejects non-INSERT statements", () => {
    expect(() =>
      assertDeviceImportStatements(["DELETE FROM wearable_sleep_metrics"]),
    ).toThrow(/Only INSERT/i);
  });

  it("rejects disallowed tables", () => {
    expect(() =>
      assertDeviceImportStatements([
        "INSERT INTO nrdl_payment_rules (rule_id, drug_id, rule_category, target_key, comparison_operator, comparison_value, alert_message) VALUES ('x','y','DIAGNOSIS','E11','>=','1','x')",
      ]),
    ).toThrow(/not allowed/i);
  });

  it("accepts wearable INSERT targets", () => {
    const tables = assertDeviceImportStatements([
      "INSERT OR IGNORE INTO data_source_registry (source_id, source_name, source_category, reliability_level) VALUES ('WEARABLE_API', 'API', 'WEARABLE', 2)",
      "INSERT INTO wearable_activity_metrics (device_id, recorded_date, steps, total_burn_kcal, active_burn_kcal) VALUES ('OURA_DEMO', '2026-07-01', 8000, 2000, 400)",
    ]).tables;
    expect(tables).toEqual(["data_source_registry", "wearable_activity_metrics"]);
  });
});
