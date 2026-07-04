import { describe, expect, it } from "vitest";
import { pickLatestChatTrail, readLedgerCommitFromTrail, collectLedgerReceipts, type AuditEventRow } from "./audit-events.js";

function event(
  partial: Partial<AuditEventRow> & Pick<AuditEventRow, "audit_trail_id" | "step" | "timestamp">,
): AuditEventRow {
  return {
    event_id: partial.event_id ?? "evt_1",
    component: partial.component ?? "test",
    input: partial.input ?? {},
    output: partial.output ?? {},
    status: partial.status ?? "SUCCESS",
    ...partial,
  };
}

describe("audit-events helpers", () => {
  it("picks the chat trail with the newest event timestamp", () => {
    const picked = pickLatestChatTrail([
      event({ audit_trail_id: "aud_old", step: "TEXT2SQL_GEN", timestamp: 1 }),
      event({ audit_trail_id: "aud_new", step: "TEXT2SQL_GEN", timestamp: 99 }),
      event({ audit_trail_id: "aud_new", step: "DB_QUERY", timestamp: 100 }),
    ]);
    expect(picked?.trailId).toBe("aud_new");
    expect(picked?.events).toHaveLength(2);
  });

  it("reads ledger commit output from a chat trail", () => {
    const receipt = readLedgerCommitFromTrail([
      event({
        audit_trail_id: "aud_1",
        step: "LEDGER_COMMIT",
        timestamp: 5,
        output: { block_height: 0, proof_hash: "abc123" },
      }),
    ]);
    expect(receipt).toEqual({
      block_height: 0,
      proof_hash: "abc123",
      audit_trail_id: "aud_1",
      timestamp: 5,
    });
  });

  it("collects unique ledger receipts across chat audit events", () => {
    const receipts = collectLedgerReceipts([
      event({
        audit_trail_id: "aud_1",
        step: "LEDGER_COMMIT",
        timestamp: 5,
        output: { block_height: 0, proof_hash: "hash_a" },
      }),
      event({
        audit_trail_id: "aud_2",
        step: "LEDGER_COMMIT",
        timestamp: 10,
        output: { block_height: 0, proof_hash: "hash_b" },
      }),
      event({
        audit_trail_id: "aud_1",
        step: "LEDGER_COMMIT",
        timestamp: 12,
        output: { block_height: 0, proof_hash: "hash_a2" },
      }),
    ]);
    expect(receipts).toHaveLength(2);
    expect(receipts[0]?.audit_trail_id).toBe("aud_1");
    expect(receipts[0]?.proof_hash).toBe("hash_a2");
    expect(receipts[1]?.audit_trail_id).toBe("aud_2");
  });
});
