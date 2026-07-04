import { readFileSync } from "node:fs";
import { PTDS_SCHEMA_V11_SQL } from "../../ptds/paths.js";

/** Tables/views exposed to Text2SQL for GLP-1 PTDS queries. */
export const TEXT2SQL_SCHEMA_OBJECTS = [
  "user_profile",
  "body_anthropometrics",
  "lab_test_results",
  "clinical_diagnoses",
  "medication_history",
  "nrdl_drug_registry",
  "nrdl_payment_rules",
  "v_glp1_nrdl_check_snapshot",
] as const;

const OBJECT_PATTERN = new RegExp(
  `(?:CREATE\\s+(?:TABLE|VIEW)\\s+IF\\s+NOT\\s+EXISTS\\s+|CREATE\\s+(?:TABLE|VIEW)\\s+)(?:${TEXT2SQL_SCHEMA_OBJECTS.join("|")})\\b[\\s\\S]*?;`,
  "gi",
);

let cachedSchemaSnippet: string | undefined;

export function loadPtdsSchemaSnippet(schemaPath: string = PTDS_SCHEMA_V11_SQL): string {
  if (cachedSchemaSnippet && schemaPath === PTDS_SCHEMA_V11_SQL) {
    return cachedSchemaSnippet;
  }
  const ddl = readFileSync(schemaPath, "utf8");
  const matches = ddl.match(OBJECT_PATTERN) ?? [];
  const snippet = matches.join("\n\n").trim();
  if (schemaPath === PTDS_SCHEMA_V11_SQL) {
    cachedSchemaSnippet = snippet;
  }
  return snippet;
}
