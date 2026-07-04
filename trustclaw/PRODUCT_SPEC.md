# TrustClaw PTDS — Product Specification V1.1

Canonical product spec for the TrustClaw demo. Business goals follow `docs/SPEC-V1-source.md`; **technical contracts** below are authoritative for implementation.

Human approval: **`DECISIONS.md` approved 2026-07-04** (D5/D15 deferred).

**Schema source of truth:** `trustclaw/ptds/schema/v1.1.sql` (from `local_ptds_v1.1.sql`).  
**Template database:** `trustclaw/ptds/seeds/local_ptds.template.db`.

The simplified init API maps into normalized PTDS tables (`user_profile`, `body_anthropometrics`, `lab_test_results`, `clinical_diagnoses`). Rule evaluation uses `nrdl_payment_rules` plus the `v_glp1_nrdl_check_snapshot` view.

## Systems

| System | Responsibility | Constraint |
| --- | --- | --- |
| **PTDS** | Local isolated structured storage for personal health metrics | Local SQLite only; no cloud DB |
| **AI Ready Dataset** | Static read-only clinical reference data (GLP-1 rules) | SQLite table or local read-only JSON |
| **Agent Runtime** | Agent lifecycle, Text2SQL, SQLite access, rule filter, orchestration | All data flows through runtime |
| **Runtime Audit** | Capture SQL gen, query results, rule matrix, decision output | Append JSON audit events |
| **Evidence Ledger** | Hash-linked receipts from audit trail | Local SHA-256 chain |
| **Business Agent** | GLP-1 assessment (first demo agent) | Declarative prompts + tools only |
| **UI** | SPA dashboard: chat, PTDS browser, audit, ledger | Stateless; JSON APIs only |

## Frozen API contracts

### `POST /api/ptds/init`

Request (frozen demo shape; server maps into PTDS v1.1 tables):

```json
{
  "weight": 85.0,
  "height": 170.0,
  "hba1c": 6.8,
  "thyroid_cancer_history": 0,
  "pancreatitis_history": 0,
  "include_t2dm_diagnosis": true
}
```

| Field | Maps to |
| --- | --- |
| `weight` / `height` | `body_anthropometrics` (`weight_kg`, `height_m`, generated `bmi`) |
| `hba1c` | `lab_test_results` (`test_code = 'HbA1c'`) |
| `thyroid_cancer_history = 1` | `clinical_diagnoses` (`icd10_code = 'C73'`) |
| `pancreatitis_history = 1` | `clinical_diagnoses` (`icd10_code = 'K85'`) |
| `include_t2dm_diagnosis = true` | `clinical_diagnoses` (`icd10_code = 'E11'`) |

Response:

```json
{
  "status": "success",
  "message": "PTDS initialized successfully.",
  "db_file": "./state/local_ptds.db",
  "records_inserted": 1
}
```

### `POST /api/agent/chat`

Request:

```json
{
  "session_id": "sess_01j7y...",
  "message": "我可以用司美格鲁肽吗？"
}
```

Response: full **Runtime Context JSON Contract** (see below).

## SQLite schema (v1.1 summary)

Full DDL: `trustclaw/ptds/schema/v1.1.sql`.

| Layer | Key tables / views |
| --- | --- |
| Provenance | `data_source_registry` |
| AI-ready reference | `nrdl_drug_registry`, `nrdl_payment_rules` |
| Personal cold/warm data | `user_profile`, `body_anthropometrics`, `lab_test_results`, `clinical_diagnoses`, … |
| Decision view | `v_glp1_nrdl_check_snapshot` |

Demo NRDL GLP-1 seed rules: `trustclaw/ptds/seeds/nrdl-glp1-seed.sql`.

**Storage paths (approved):**

| Artifact | Path |
| --- | --- |
| PTDS SQLite | `state/local_ptds.db` |
| Audit trail | `state/ptds-audit/*.jsonl` |
| Evidence ledger | `state/ptds-evidence/*.json` |

**UI data browser default tables (D12):** `body_anthropometrics`, `lab_test_results`, `nrdl_payment_rules`, `v_glp1_nrdl_check_snapshot`.

Legacy V1 simplified tables (`user_biometrics`, `glp1_clinical_rules`) are **superseded** by v1.1; do not add parallel schemas.

## Runtime Context JSON Contract

```json
{
  "session_id": "sess_01j7y...",
  "user_query": "...",
  "pipeline_stages": {
    "text2sql": { "sql": "...", "duration_ms": 120 },
    "db_query": { "raw_data": {} },
    "rule_evaluation": { "evaluated_rules": [] },
    "agent_decision": { "response": "...", "citations": [] }
  },
  "audit_trail_id": "aud_01j7y...",
  "evidence_ledger_receipt": {
    "block_height": 12,
    "proof_hash": "..."
  }
}
```

## Audit event schema

```json
{
  "event_id": "aud_01j7y21y11029c...",
  "step": "TEXT2SQL_GEN",
  "timestamp": 1780286401,
  "component": "AgentRuntime.Text2SQL",
  "input": {},
  "output": {},
  "status": "SUCCESS"
}
```

## Evidence schema

```json
{
  "$schema": "http://ptds-runtime.org/schemas/evidence.json",
  "evidence_id": "ev_01j7y21x890a9b...",
  "timestamp": 1780286400,
  "data_context_hash": "...",
  "rules_context_hash": "...",
  "agent_decision_hash": "...",
  "previous_evidence_hash": "...",
  "proof": {
    "signature_algorithm": "SHA-256",
    "hash_value": "..."
  }
}
```

## Agent roles (V1)

| Agent | Input | Output | Hard rules |
| --- | --- | --- | --- |
| Text2SQL | `user_query`, `database_schema` | SELECT-only SQL string | No DML/DDL; no markdown |
| Rule Evaluator | `query_results`, `rules_metadata` | `evaluation_matrix` | Numeric interval compare |
| GLP-1 Business | `evaluation_matrix`, `user_biometrics`, `user_query` | `final_response`, `citations` | No hallucinated vitals |

## Definition of Done (DoD)

1. **Runnable** — single local start command; SQLite only
2. **Demo ready** — Chrome SPA + reset button
3. **Auditable** — every pipeline stage emits audit events visible in UI
4. **Evidence generated** — hash-linked receipt after each decision
5. **No blocking defects** — core flow completes without broken steps
