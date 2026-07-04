import type { DatabaseSync } from "node:sqlite";
import { bootstrapPtdsDatabase, PTDS_LOCAL_USER_ID } from "./db.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "./paths.js";
import type { PtdsInitRequest, PtdsInitResult } from "./types.js";

function clearPtdsPersonalData(db: DatabaseSync): void {
  db.prepare("DELETE FROM clinical_diagnoses").run();
  db.prepare("DELETE FROM medication_history").run();
  db.prepare("DELETE FROM lab_test_results").run();
  db.prepare("DELETE FROM body_anthropometrics").run();
  db.prepare("DELETE FROM user_profile WHERE user_id = ?").run(PTDS_LOCAL_USER_ID);
}

export function applyPtdsInitRequest(db: DatabaseSync, request: PtdsInitRequest): number {
  clearPtdsPersonalData(db);

  const name = request.name?.trim() || "本地用户";
  const heightM = request.height / 100;
  const now = new Date().toISOString();
  let inserted = 0;

  db.prepare(
    `INSERT INTO user_profile (user_id, name, birth_date, biological_sex)
     VALUES (?, ?, '1985-01-01', 1)`,
  ).run(PTDS_LOCAL_USER_ID, name);
  inserted += 1;

  db.prepare(
    `INSERT INTO body_anthropometrics (
       recorded_at, height_m, weight_kg, source_id, provenance_level, recorder_user_id
     ) VALUES (?, ?, ?, 'PATIENT_SELF_REPORT', 1, ?)`,
  ).run(now, heightM, request.weight, PTDS_LOCAL_USER_ID);
  inserted += 1;

  db.prepare(
    `INSERT INTO lab_test_results (
       recorded_at, test_code, test_value, test_unit,
       reference_range_low, reference_range_high, clinical_status,
       source_id, provenance_level
     ) VALUES (?, 'HbA1c', ?, '%', 4.0, 6.0, 'HIGH', 'PATIENT_SELF_REPORT', 1)`,
  ).run(now, request.hba1c);
  inserted += 1;

  if (request.include_t2dm_diagnosis) {
    db.prepare(
      `INSERT INTO clinical_diagnoses (
         icd10_code, diagnosis_name, diagnosed_at, source_id, is_active, provenance_level
       ) VALUES ('E11', '2型糖尿病', date('now'), 'PATIENT_SELF_REPORT', 1, 1)`,
    ).run();
    inserted += 1;
  }

  if (request.thyroid_cancer_history === 1) {
    db.prepare(
      `INSERT INTO clinical_diagnoses (
         icd10_code, diagnosis_name, diagnosed_at, source_id, is_active, provenance_level
       ) VALUES ('C73', '甲状腺髓样癌', date('now'), 'PATIENT_SELF_REPORT', 1, 1)`,
    ).run();
    inserted += 1;
  }

  if (request.pancreatitis_history === 1) {
    db.prepare(
      `INSERT INTO clinical_diagnoses (
         icd10_code, diagnosis_name, diagnosed_at, source_id, is_active, provenance_level
       ) VALUES ('K85', '急性胰腺炎', date('now'), 'PATIENT_SELF_REPORT', 1, 1)`,
    ).run();
    inserted += 1;
  }

  return inserted;
}

export function initializePtds(
  request: PtdsInitRequest,
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): PtdsInitResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  try {
    const db = bootstrapPtdsDatabase(dbPath);
    const recordsInserted = applyPtdsInitRequest(db, request);
    db.close();
    return {
      status: "success",
      message: "PTDS initialized successfully.",
      db_file: dbPath,
      records_inserted: recordsInserted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message,
      db_file: dbPath,
      records_inserted: 0,
    };
  }
}

export function resetPtds(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): PtdsInitResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  try {
    const db = bootstrapPtdsDatabase(dbPath);
    clearPtdsPersonalData(db);
    db.close();
    return {
      status: "success",
      message: "PTDS personal data cleared.",
      db_file: dbPath,
      records_inserted: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message,
      db_file: dbPath,
      records_inserted: 0,
    };
  }
}
