// Panel D — Runtime Audit. Reads `pipeline_stages` directly from the Runtime
// Context returned by `/api/agent/chat`. This matches spec DoD item 3
// ("every pipeline stage emits audit events visible in UI"). Real JSONL replay
// from `state/ptds-audit/*.jsonl` is out of scope until Task 502.

import type { RuntimeContextResponse } from "../api.js";

export function renderAudit(root: HTMLElement): {
  render(context: RuntimeContextResponse): void;
  clear(): void;
} {
  root.innerHTML = `
    <section class="panel" data-panel="audit">
      <header><h2>D · 运行时审计面板</h2><span data-testid="audit-trail-id"></span></header>
      <ol class="audit-timeline" data-testid="audit-timeline"></ol>
    </section>
  `;

  const trailIdEl = root.querySelector<HTMLElement>('[data-testid="audit-trail-id"]')!;
  const timelineEl = root.querySelector<HTMLElement>('[data-testid="audit-timeline"]')!;

  return {
    render(context) {
      trailIdEl.textContent = context.audit_trail_id;
      const stages = context.pipeline_stages;
      const items: Array<{ label: string; body: unknown }> = [
        { label: "1 · Text2SQL", body: stages.text2sql },
        { label: "2 · PTDS Query", body: stages.db_query },
        { label: "3 · Rule Evaluation", body: stages.rule_evaluation },
        { label: "4 · GLP-1 Decision", body: stages.agent_decision },
        {
          label: "5 · Ledger Receipt",
          body: context.evidence_ledger_receipt ?? { pending: "Task 401" },
        },
      ];
      timelineEl.innerHTML = items
        .map(
          (item) =>
            `<li><strong>${escapeHtml(item.label)}</strong><pre>${escapeHtml(
              JSON.stringify(item.body ?? null, null, 2),
            )}</pre></li>`,
        )
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
