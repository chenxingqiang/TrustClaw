// Panel E — Evidence Ledger.

import type { RuntimeContextResponse } from "../api.js";
import { msg } from "../i18n/index.js";

interface ReceiptRow {
  block_height?: number;
  proof_hash?: string;
  audit_trail_id: string;
}

export function renderLedger(root: HTMLElement): {
  append(context: RuntimeContextResponse): void;
  clear(): void;
} {
  const m = msg().panels.ledger;
  root.innerHTML = `
    <section class="panel panel--e" data-panel="ledger">
      <header class="panel__header">
        <h2>${escapeHtml(m.title)}</h2>
        <span class="badge" data-testid="ledger-verified">${escapeHtml(m.placeholder)}</span>
      </header>
      <div class="panel__body">
        <div class="ledger-stats">
          <div class="ledger-stat">
            <span>${escapeHtml(m.blockHeight)}</span>
            <strong data-testid="ledger-height">#0</strong>
          </div>
          <div class="ledger-stat">
            <span>${escapeHtml(m.rootHash)}</span>
            <code data-testid="ledger-root">—</code>
          </div>
          <div class="ledger-stat">
            <span>${escapeHtml(m.proofLabel)}</span>
            <code data-testid="ledger-proof-short">—</code>
          </div>
        </div>
        <div class="ledger-proof-wrap">
          <button type="button" data-action="copy-proof">${escapeHtml(m.copyProof)}</button>
          <pre class="ledger-proof" data-testid="ledger-proof">{}</pre>
        </div>
        <ul class="ledger-list" data-testid="ledger-list"></ul>
      </div>
    </section>
  `;

  const listEl = root.querySelector<HTMLElement>('[data-testid="ledger-list"]')!;
  const heightEl = root.querySelector<HTMLElement>('[data-testid="ledger-height"]')!;
  const rootEl = root.querySelector<HTMLElement>('[data-testid="ledger-root"]')!;
  const proofShortEl = root.querySelector<HTMLElement>('[data-testid="ledger-proof-short"]')!;
  const proofEl = root.querySelector<HTMLElement>('[data-testid="ledger-proof"]')!;
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-proof"]')!;
  const rows: ReceiptRow[] = [];

  function latestProof(): Record<string, unknown> {
    const last = rows.at(-1);
    if (!last) {
      return { status: "pending", task: "401" };
    }
    return {
      block_height: last.block_height ?? 0,
      proof_hash: last.proof_hash ?? null,
      audit_trail_id: last.audit_trail_id,
    };
  }

  function repaint(): void {
    const last = rows.at(-1);
    heightEl.textContent = `#${last?.block_height ?? 0}`;
    const hash = last?.proof_hash ?? "";
    rootEl.textContent = hash ? `${hash.slice(0, 12)}…` : "—";
    proofShortEl.textContent = hash ? `${hash.slice(0, 8)}…` : "—";
    proofEl.textContent = JSON.stringify(latestProof(), null, 2);
    listEl.innerHTML = rows
      .map(
        (row) =>
          `<li><code>#${row.block_height ?? "?"}</code> · <code>${escapeHtml(
            (row.proof_hash ?? "").slice(0, 16),
          )}…</code> · <span>${escapeHtml(row.audit_trail_id)}</span></li>`,
      )
      .join("");
  }

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(proofEl.textContent ?? "{}");
      copyBtn.textContent = m.copiedProof;
      setTimeout(() => {
        copyBtn.textContent = m.copyProof;
      }, 1200);
    } catch {
      // clipboard unavailable in some iframe contexts
    }
  });

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
