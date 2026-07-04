// Panel D — Runtime Audit.

import type { RuntimeContextResponse } from "../api.js";
import { msg } from "../i18n/index.js";

export function renderAudit(root: HTMLElement): {
  render(context: RuntimeContextResponse): void;
  clear(): void;
} {
  const m = msg().panels.audit;
  root.innerHTML = `
    <section class="panel panel--d" data-panel="audit">
      <header class="panel__header">
        <h2>${escapeHtml(m.title)}</h2>
        <span data-testid="audit-trail-id"></span>
      </header>
      <div class="panel__body">
        <ol class="audit-timeline" data-testid="audit-timeline"></ol>
      </div>
    </section>
  `;

  const trailIdEl = root.querySelector<HTMLElement>('[data-testid="audit-trail-id"]')!;
  const timelineEl = root.querySelector<HTMLElement>('[data-testid="audit-timeline"]')!;

  return {
    render(context) {
      trailIdEl.textContent = context.audit_trail_id;
      const stages = context.pipeline_stages;
      const now = Date.now();
      const items: Array<{ label: string; body: unknown; offsetMs: number }> = [
        { label: m.stepUser, body: { query: context.user_query }, offsetMs: 0 },
        { label: m.stepText2sql, body: stages.text2sql, offsetMs: 1000 },
        { label: m.stepQuery, body: stages.db_query, offsetMs: 2000 },
        { label: m.stepRules, body: stages.rule_evaluation, offsetMs: 3000 },
        { label: m.stepDecision, body: stages.agent_decision, offsetMs: 4000 },
        {
          label: m.stepLedger,
          body: context.evidence_ledger_receipt ?? { pending: m.ledgerPending },
          offsetMs: 5000,
        },
      ];
      timelineEl.innerHTML = items
        .map((item) => {
          const stamp = new Date(now + item.offsetMs).toLocaleTimeString();
          return `<li><strong>${escapeHtml(item.label)}</strong><time>${escapeHtml(stamp)}</time><pre>${escapeHtml(
            JSON.stringify(item.body ?? null, null, 2),
          )}</pre></li>`;
        })
        .join("");
    },
    clear() {
      trailIdEl.textContent = "";
      timelineEl.innerHTML = "";
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
