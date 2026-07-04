import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  bootstrapPtdsDatabase,
  initializePtds,
  listPtdsTables,
  PTDS_LOCAL_USER_ID,
  PtdsQuerySecurityError,
  queryPtds,
  readGlp1CheckSnapshot,
  assertReadOnlySelectSql,
} from "./index.js";

describe("trustclaw/ptds", () => {
  it("bootstraps schema v1.1 and NRDL seed rules", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ptds-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const db = bootstrapPtdsDatabase(dbPath);
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='data_source_registry'",
        )
        .get();
      expect(tables).toBeTruthy();

      const drugCount = db
        .prepare("SELECT COUNT(*) AS count FROM nrdl_drug_registry")
        .get() as { count: number };
      expect(drugCount.count).toBeGreaterThan(0);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("initializes personal data from frozen init API shape", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ptds-init-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const result = initializePtds(
        {
          weight: 85,
          height: 170,
          hba1c: 6.8,
          thyroid_cancer_history: 0,
          pancreatitis_history: 0,
          include_t2dm_diagnosis: true,
        },
        dbPath,
      );
      expect(result.status).toBe("success");
      expect(result.records_inserted).toBeGreaterThanOrEqual(4);

      const snapshot = readGlp1CheckSnapshot(dbPath);
      expect(snapshot).toMatchObject({
        user_id: PTDS_LOCAL_USER_ID,
        has_t2dm: 1,
        has_absolute_contraindication: 0,
      });
      expect(snapshot?.latest_hospital_hba1c).toBeNull();

      const db = new DatabaseSync(dbPath);
      const bmiRow = db
        .prepare(
          "SELECT bmi FROM body_anthropometrics ORDER BY body_id DESC LIMIT 1",
        )
        .get() as { bmi: number };
      expect(bmiRow.bmi).toBeCloseTo(29.4, 1);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records absolute contraindications in snapshot view", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ptds-contra-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      initializePtds(
        {
          weight: 80,
          height: 175,
          hba1c: 7.2,
          thyroid_cancer_history: 1,
          pancreatitis_history: 0,
        },
        dbPath,
      );
      const snapshot = readGlp1CheckSnapshot(dbPath);
      expect(snapshot?.has_absolute_contraindication).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows SELECT-only queries and blocks writes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ptds-query-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      initializePtds(
        {
          weight: 85,
          height: 170,
          hba1c: 6.8,
          thyroid_cancer_history: 0,
          pancreatitis_history: 0,
        },
        dbPath,
      );

      const result = queryPtds(
        "SELECT weight_kg, bmi FROM body_anthropometrics ORDER BY body_id DESC LIMIT 1",
        dbPath,
      );
      expect(result.row_count).toBe(1);
      expect(result.rows[0]?.weight_kg).toBe(85);

      expect(() => assertReadOnlySelectSql("DELETE FROM user_profile")).toThrow(
        PtdsQuerySecurityError,
      );
      expect(() =>
        queryPtds(
          `UPDATE user_profile SET name = 'x' WHERE user_id = '${PTDS_LOCAL_USER_ID}'`,
          dbPath,
        ),
      ).toThrow(PtdsQuerySecurityError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists tables for PTDS browser", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ptds-list-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      bootstrapPtdsDatabase(dbPath);
      const tables = listPtdsTables(dbPath);
      expect(tables).toContain("body_anthropometrics");
      expect(tables).toContain("v_glp1_nrdl_check_snapshot");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
