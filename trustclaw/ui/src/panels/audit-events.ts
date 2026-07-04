// Helpers for grouping PTDS audit JSONL rows into chat pipeline trails.

export type AuditEventRow = {
  event_id: string;
  audit_trail_id: string;
  step: string;
  timestamp: number;
  component: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
};

export function pickLatestChatTrail(
  events: AuditEventRow[],
): { trailId: string; events: AuditEventRow[] } | null {
  if (events.length === 0) {
    return null;
  }
  const byTrail = new Map<string, AuditEventRow[]>();
  for (const event of events) {
    const bucket = byTrail.get(event.audit_trail_id) ?? [];
    bucket.push(event);
    byTrail.set(event.audit_trail_id, bucket);
  }
  let latest: { trailId: string; events: AuditEventRow[] } | null = null;
  for (const [trailId, trailEvents] of byTrail) {
    const lastTs = trailEvents.at(-1)?.timestamp ?? 0;
    const currentTs = latest?.events.at(-1)?.timestamp ?? 0;
    if (!latest || lastTs >= currentTs) {
      latest = { trailId, events: trailEvents };
    }
  }
  return latest;
}

export function readLedgerCommitFromTrail(events: AuditEventRow[]): {
  block_height?: number;
  proof_hash?: string;
  audit_trail_id: string;
} | null {
  const commit = [...events].reverse().find((event) => event.step === "LEDGER_COMMIT");
  if (!commit) {
    return null;
  }
  return ledgerReceiptFromEvent(commit);
}

export type LedgerReceiptRow = {
  block_height?: number;
  proof_hash?: string;
  audit_trail_id: string;
  timestamp?: number;
};

function ledgerReceiptFromEvent(event: AuditEventRow): LedgerReceiptRow | null {
  if (event.step !== "LEDGER_COMMIT" || event.status !== "SUCCESS") {
    return null;
  }
  const proofHash = event.output.proof_hash;
  if (typeof proofHash !== "string" || proofHash.length === 0) {
    return null;
  }
  return {
    block_height: typeof event.output.block_height === "number" ? event.output.block_height : undefined,
    proof_hash: proofHash,
    audit_trail_id: event.audit_trail_id,
    timestamp: event.timestamp,
  };
}

/** Collect ledger receipts from a chat audit batch (newest API window). */
export function collectLedgerReceipts(events: AuditEventRow[]): LedgerReceiptRow[] {
  const byTrail = new Map<string, LedgerReceiptRow>();
  for (const event of events) {
    const receipt = ledgerReceiptFromEvent(event);
    if (!receipt) {
      continue;
    }
    const existing = byTrail.get(receipt.audit_trail_id);
    if (!existing || (receipt.timestamp ?? 0) >= (existing.timestamp ?? 0)) {
      byTrail.set(receipt.audit_trail_id, receipt);
    }
  }
  return [...byTrail.values()].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}
