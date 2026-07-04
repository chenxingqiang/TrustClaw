// Panel E — Evidence Ledger. R5 only renders the placeholder receipt already
// present on Runtime Context. Task 401 will replace this with the real
// hash-linked receipt stream from `state/ptds-evidence/*.json`; this panel is
// wired now so 401 can drop in a richer render without touching main.ts.

import type { RuntimeContextResponse } from "../api.js";

interface ReceiptRow {
  block_height?: number;
  proof_hash?: string;
  audit_trail_id: string;
}

export function renderLedger(root: HTMLElement): {
  append(context: RuntimeContextResponse): void;
  clear(): void;
} {
  root.innerHTML = `
    <section class="panel" data-panel="ledger">
      <header><h2>E · 凭证账本面板</h2><span class="badge" data-testid="ledger-verified">占位 (Task 401)</span></header>
      <ul class="ledger-list" data-testid="ledger-list"></ul>
    </section>
  `;

  const listEl = root.querySelector<HTMLElement>('[data-testid="ledger-list"]')!;
  const rows: ReceiptRow[] = [];

  function repaint(): void {
    listEl.innerHTML = rows
      .map(
        (row) =>
          `<li><code>#${row.block_height ?? "?"}</code> · <code>${escapeHtml(
            (row.proof_hash ?? "").slice(0, 16),
          )}…</code> · <span>${escapeHtml(row.audit_trail_id)}</span></li>`,
      )
      .join("");
  }

  return {
    append(context) {
      rows.push({
        block_height: context.evidence_ledger_receipt?.block_height,
        proof_hash: context.evidence_ledger_receipt?.proof_hash,
        audit_trail_id: context.audit_trail_id,
      });
      repaint();
    },
    clear() {
      rows.length = 0;
      repaint();
    },
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
