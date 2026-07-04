// Bridges TrustClaw PTDS tool results to side-panel iframes and standalone shells.

export const TRUSTCLAW_PTDS_QUERY_TOOL = "trustclaw_ptds_query";
export const TRUSTCLAW_PTDS_WRITE_TOOL = "trustclaw_ptds_write";
export const TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE = "openclaw:trustclaw:runtime-context";
export const TRUSTCLAW_PTDS_DATA_CHANGED_MESSAGE = "openclaw:trustclaw:ptds-data-changed";
export const TRUSTCLAW_THEME_MESSAGE = "openclaw:theme";

export type TrustclawPersonalWritePayload = {
  status: string;
  tables?: string[];
  rows_affected?: number;
};

export type TrustclawRuntimeContextPayload = {
  session_id: string;
  user_query: string;
  pipeline_stages: Record<string, unknown>;
  audit_trail_id: string;
  evidence_ledger_receipt?: {
    block_height?: number;
    proof_hash?: string;
  };
};

type TrustclawPtdsHost = {
  trustclawRuntimeContext?: TrustclawRuntimeContextPayload | null;
};

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readRuntimeContext(value: unknown): TrustclawRuntimeContextPayload | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const sessionId = typeof record.session_id === "string" ? record.session_id : "";
  const userQuery = typeof record.user_query === "string" ? record.user_query : "";
  const auditTrailId = typeof record.audit_trail_id === "string" ? record.audit_trail_id : "";
  const pipelineStages = readRecord(record.pipeline_stages);
  if (!sessionId || !userQuery || !auditTrailId || !pipelineStages) {
    return null;
  }
  const receipt = readRecord(record.evidence_ledger_receipt) ?? undefined;
  return {
    session_id: sessionId,
    user_query: userQuery,
    pipeline_stages: pipelineStages,
    audit_trail_id: auditTrailId,
    evidence_ledger_receipt: receipt
      ? {
          block_height: typeof receipt.block_height === "number" ? receipt.block_height : undefined,
          proof_hash: typeof receipt.proof_hash === "string" ? receipt.proof_hash : undefined,
        }
      : undefined,
  };
}

export function parseRuntimeContextFromToolResult(
  result: unknown,
): TrustclawRuntimeContextPayload | null {
  const record = readRecord(result);
  if (!record) {
    return null;
  }

  const trustclaw = readRecord(readRecord(record.details)?.trustclaw);
  const fromDetails = readRuntimeContext(trustclaw?.runtime_context);
  if (fromDetails) {
    return fromDetails;
  }

  if (typeof record.content === "string") {
    try {
      return readRuntimeContext(JSON.parse(record.content));
    } catch {
      return null;
    }
  }

  const content = Array.isArray(record.content) ? record.content : null;
  const textEntry = content?.find(
    (entry) => readRecord(entry)?.type === "text" && typeof readRecord(entry)?.text === "string",
  );
  const text = typeof readRecord(textEntry)?.text === "string" ? readRecord(textEntry)!.text : null;
  if (!text) {
    return null;
  }
  try {
    return readRuntimeContext(JSON.parse(text));
  } catch {
    return null;
  }
}

export function notifyTrustclawPtdsTheme(resolved: string, themeMode: "light" | "dark"): void {
  if (typeof document === "undefined") {
    return;
  }
  for (const iframe of document.querySelectorAll<HTMLIFrameElement>(
    ".trustclaw-ptds-rail__frame",
  )) {
    iframe.contentWindow?.postMessage(
      { type: TRUSTCLAW_THEME_MESSAGE, resolved, themeMode },
      window.location.origin,
    );
  }
}

function postRuntimeContextToFrame(
  iframe: HTMLIFrameElement,
  message: { type: string; context: TrustclawRuntimeContextPayload },
): void {
  iframe.contentWindow?.postMessage(message, "*");
}

export function notifyTrustclawRuntimeContext(context: TrustclawRuntimeContextPayload): void {
  if (typeof document === "undefined") {
    return;
  }

  const message = { type: TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE, context };

  for (const iframe of document.querySelectorAll<HTMLIFrameElement>("iframe.trustclaw-ptds-rail__frame")) {
    const src = iframe.getAttribute("src") ?? "";
    if (src.includes("embed=right")) {
      postRuntimeContextToFrame(iframe, message);
    }
  }

  // Standalone TrustClaw console: Panel D/E live on the parent page; chat runs in .console-chat-frame.
  if (window.parent !== window) {
    window.parent.postMessage(message, "*");
  }
}

export function parsePersonalWriteFromToolResult(result: unknown): TrustclawPersonalWritePayload | null {
  const record = readRecord(result);
  if (!record) {
    return null;
  }
  const trustclaw = readRecord(readRecord(record.details)?.trustclaw);
  const write = readRecord(trustclaw?.personal_write);
  if (!write || write.status !== "success") {
    return null;
  }
  return {
    status: "success",
    tables: Array.isArray(write.tables)
      ? write.tables.filter((value): value is string => typeof value === "string")
      : undefined,
    rows_affected: typeof write.rows_affected === "number" ? write.rows_affected : undefined,
  };
}

export function notifyTrustclawPtdsDataChanged(payload: TrustclawPersonalWritePayload): void {
  if (typeof document === "undefined") {
    return;
  }
  const message = { type: TRUSTCLAW_PTDS_DATA_CHANGED_MESSAGE, payload };

  for (const iframe of document.querySelectorAll<HTMLIFrameElement>("iframe.trustclaw-ptds-rail__frame")) {
    const src = iframe.getAttribute("src") ?? "";
    if (src.includes("embed=left") || src.includes("embed=right")) {
      iframe.contentWindow?.postMessage(message, "*");
    }
  }

  if (window.parent !== window) {
    window.parent.postMessage(message, "*");
  }
}

export function syncTrustclawPtdsDataChanged(
  data: Record<string, unknown>,
): void {
  const payload =
    parsePersonalWriteFromToolResult(data.result) ?? parsePersonalWriteFromToolResult(data);
  if (!payload) {
    return;
  }
  notifyTrustclawPtdsDataChanged(payload);
}

export function isTrustclawPtdsDataChangedMessage(
  data: unknown,
): data is { type: string; payload: TrustclawPersonalWritePayload } {
  const record = readRecord(data);
  return !!record && record.type === TRUSTCLAW_PTDS_DATA_CHANGED_MESSAGE;
}

export function syncTrustclawPtdsRuntimeContext(
  host: TrustclawPtdsHost,
  data: Record<string, unknown>,
): void {
  const context =
    parseRuntimeContextFromToolResult(data.result) ?? parseRuntimeContextFromToolResult(data);
  if (!context) {
    return;
  }
  host.trustclawRuntimeContext = context;
  notifyTrustclawRuntimeContext(context);
}

export function isTrustclawRuntimeContextMessage(
  data: unknown,
): data is { type: string; context: TrustclawRuntimeContextPayload } {
  const record = readRecord(data);
  if (!record || record.type !== TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE) {
    return false;
  }
  return readRuntimeContext(record.context) != null;
}
