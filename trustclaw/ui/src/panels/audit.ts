// Panel D — Runtime Audit (JSONL compliance/consent + latest chat pipeline from JSONL or postMessage).

import type { RuntimeContextResponse, TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";
import {
  collectLedgerReceipts,
  pickLatestChatTrail,
  type AuditEventRow,
  type LedgerReceiptRow,
} from "./audit-events.js";

type LedgerSync = {
  onLedgerHydrate?: (receipts: LedgerReceiptRow[]) => void;
  onLedgerUpsert?: (receipt: LedgerReceiptRow) => void;
};

function stepLabel(step: string, labels: Record<string, string>): string {
  return labels[step] ?? step;
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

function statusClass(status: string): string {
  if (status === "SUCCESS") {
    return "audit-status--ok";
  }
  if (status === "BLOCKED") {
    return "audit-status--blocked";
  }
  return "audit-status--fail";
}

function renderEventList(
  events: AuditEventRow[],
  stepLabels: Record<string, string>,
): string {
  return events
    .map(
      (event) => `<li class="audit-event">
          <div class="audit-event__head">
            <strong>${escapeHtml(stepLabel(event.step, stepLabels))}</strong>
            <span class="audit-status ${statusClass(event.status)}">${escapeHtml(event.status)}</span>
          </div>
          <div class="audit-event__meta">${escapeHtml(event.component)} · ${escapeHtml(event.audit_trail_id)}</div>
          <time>${escapeHtml(formatEventTime(event.timestamp))}</time>
          <pre>${escapeHtml(JSON.stringify({ input: event.input, output: event.output }, null, 2))}</pre>
        </li>`,
    )
    .join("");
}

export function renderAudit(
  root: HTMLElement,
  client: TrustclawApiClient,
  options?: LedgerSync & { pollMs?: number },
): {
  render(context: RuntimeContextResponse): void;
  refresh(): Promise<void>;
  clear(): void;
  stopPolling(): void;
} {
  const m = msg().panels.audit;
  root.innerHTML = `
    <section class="panel panel--d" data-panel="audit">
      <header class="panel__header">
        <h2>${escapeHtml(m.title)}</h2>
        <button type="button" class="btn-inline" data-action="refresh-audit">${escapeHtml(m.reload)}</button>
      </header>
      <div class="panel__body">
        <div class="audit-section">
          <h3 class="audit-section__title">${escapeHtml(m.sectionCompliance)}</h3>
          <p class="panel-note panel-note--compact" data-testid="audit-compliance-note">${escapeHtml(m.compliancePlaceholder)}</p>
          <ol class="audit-timeline" data-testid="audit-compliance-timeline"></ol>
        </div>
        <div class="audit-section">
          <h3 class="audit-section__title">${escapeHtml(m.sectionChat)}</h3>
          <p class="panel-note panel-note--compact">
            ${escapeHtml(m.chatTrailLabel)} <span data-testid="audit-trail-id"></span>
          </p>
          <p class="panel-note panel-note--compact" data-testid="audit-chat-note">${escapeHtml(m.chatLoading)}</p>
          <ol class="audit-timeline" data-testid="audit-chat-timeline"></ol>
        </div>
      </div>
    </section>
  `;

  const refreshBtn = root.querySelector<HTMLButtonElement>('[data-action="refresh-audit"]')!;
  const complianceNote = root.querySelector<HTMLElement>('[data-testid="audit-compliance-note"]')!;
  const complianceTimeline = root.querySelector<HTMLElement>('[data-testid="audit-compliance-timeline"]')!;
  const trailIdEl = root.querySelector<HTMLElement>('[data-testid="audit-trail-id"]')!;
  const chatNote = root.querySelector<HTMLElement>('[data-testid="audit-chat-note"]')!;
  const chatTimeline = root.querySelector<HTMLElement>('[data-testid="audit-chat-timeline"]')!;

  const stepLabels: Record<string, string> = {
    DATA_CONSENT: m.stepDataConsent,
    COMPLIANCE_IMPORT: m.stepComplianceImport,
    REFERENCE_SYNC: m.stepReferenceSync,
    DEVICE_IMPORT: m.stepDeviceImport,
    TEXT2SQL_GEN: m.stepText2sql,
    DB_QUERY: m.stepQuery,
    RULE_EVAL: m.stepRules,
    AGENT_DECISION: m.stepDecision,
    LEDGER_COMMIT: m.stepLedger,
  };

  function hydrateLedgerFromEvents(events: AuditEventRow[]): void {
    options?.onLedgerHydrate?.(collectLedgerReceipts(events));
  }

  function renderComplianceEvents(events: AuditEventRow[]): void {
    if (events.length === 0) {
      complianceNote.textContent = m.complianceEmpty;
      complianceTimeline.innerHTML = "";
      return;
    }
    complianceNote.textContent = m.complianceLoaded.replace("{count}", String(events.length));
    complianceTimeline.innerHTML = renderEventList(events, stepLabels);
  }

  function renderChatTrailFromEvents(trailId: string, events: AuditEventRow[]): void {
    trailIdEl.textContent = trailId;
    chatNote.textContent = m.chatLoaded.replace("{count}", String(events.length));
    chatTimeline.innerHTML = renderEventList(events, stepLabels);
    hydrateLedgerFromEvents(events);
  }

  function renderChatTrailEmpty(): void {
    trailIdEl.textContent = "";
    chatNote.textContent = m.chatEmpty;
    chatTimeline.innerHTML = "";
  }

  async function refreshComplianceEvents(): Promise<void> {
    complianceNote.textContent = m.loading;
    try {
      const response = await client.auditEvents("compliance", 40);
      renderComplianceEvents(response.events ?? []);
    } catch (error) {
      const message = (error as Error).message;
      complianceNote.textContent = message.includes("404")
        ? m.apiUnavailable
        : `${m.loadError}: ${message}`;
      complianceTimeline.innerHTML = "";
    }
  }

  async function refreshChatEvents(): Promise<void> {
    chatNote.textContent = m.chatLoading;
    try {
      const response = await client.auditEvents("chat", 60);
      const events = response.events ?? [];
      hydrateLedgerFromEvents(events);
      const latest = pickLatestChatTrail(events);
      if (!latest) {
        renderChatTrailEmpty();
        return;
      }
      renderChatTrailFromEvents(latest.trailId, latest.events);
    } catch (error) {
      const message = (error as Error).message;
      chatNote.textContent = message.includes("404") ? m.apiUnavailable : `${m.loadError}: ${message}`;
      trailIdEl.textContent = "";
      chatTimeline.innerHTML = "";
    }
  }

  async function refreshAll(): Promise<void> {
    await Promise.all([refreshComplianceEvents(), refreshChatEvents()]);
  }

  refreshBtn.addEventListener("click", () => {
    void refreshAll();
  });

  void refreshAll();

  const pollMs = options?.pollMs ?? 5000;
  const pollTimer = window.setInterval(() => {
    void refreshAll();
  }, pollMs);

  return {
    render(context) {
      trailIdEl.textContent = context.audit_trail_id;
      chatNote.textContent = m.chatLive;
      void refreshComplianceEvents();
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
      chatTimeline.innerHTML = items
        .map((item) => {
          const stamp = new Date(now + item.offsetMs).toLocaleTimeString();
          return `<li><strong>${escapeHtml(item.label)}</strong><time>${escapeHtml(stamp)}</time><pre>${escapeHtml(
            JSON.stringify(item.body ?? null, null, 2),
          )}</pre></li>`;
        })
        .join("");
      if (context.evidence_ledger_receipt?.proof_hash) {
        options?.onLedgerUpsert?.({
          block_height: context.evidence_ledger_receipt.block_height,
          proof_hash: context.evidence_ledger_receipt.proof_hash,
          audit_trail_id: context.audit_trail_id,
          timestamp: Date.now() / 1000,
        });
      }
    },
    async refresh() {
      await refreshAll();
    },
    clear() {
      trailIdEl.textContent = "";
      chatNote.textContent = m.chatEmpty;
      chatTimeline.innerHTML = "";
    },
    stopPolling() {
      window.clearInterval(pollTimer);
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
