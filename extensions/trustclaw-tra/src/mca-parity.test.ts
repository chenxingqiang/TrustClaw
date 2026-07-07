import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { missingChatPipelineSteps, readAuditEvents } from "../../../trustclaw/audit/index.js";
import { getAgentPackRegistry } from "../../../trustclaw/runtime/agent-pack/index.js";
import { setAgentDomainGrant } from "../../../trustclaw/tra/agent-domain-grants.js";
import { deriveAgentDomainScopes } from "../../../trustclaw/tra/agent-domain-scopes.js";
import { initializeTra } from "../../../trustclaw/tra/init.js";
import { TRA_INIT_DEFAULTS } from "../../../trustclaw/tra/types.js";
import { createAgentChatHandler } from "./agent-routes.js";
import { createTrustclawTraQueryToolFactory } from "./tra-query-tool.js";

const CHAT_LLM = async () =>
  "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1";

function createMockResponse(): ServerResponse & { getBody: () => string } {
  const state = { statusCode: 200, body: "" };
  const res = {
    setHeader: vi.fn(),
    end(chunk: string) {
      state.body = chunk;
    },
  } as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => state.statusCode,
    set: (value: number) => {
      state.statusCode = value;
    },
  });
  return Object.assign(res, {
    getBody: () => state.body,
  });
}

/** G7: WS tool path and HTTP chat share runTrustclawChat MCA surfaces. */
describe("TRA chat MCA parity (G7)", () => {
  it("HTTP POST /api/agent/chat and trustclaw_tra_query produce the same audit steps", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-mca-parity-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "tra-audit");
    const evidenceDir = path.join(dir, "tra-evidence");
    const pluginConfig = { dbPath, auditDir, evidenceDir };
    const glp1Pack = getAgentPackRegistry().get("glp1-eligibility")!;
    setAgentDomainGrant(glp1Pack.id, deriveAgentDomainScopes(glp1Pack), { dbPath, auditDir });

    try {
      expect(
        initializeTra(
          {
            ...TRA_INIT_DEFAULTS,
            weight: 85,
            height: 170,
            hba1c: 6.8,
            hasType2Diabetes: true,
          },
          { dbPath },
        ).status,
      ).toBe("success");

      const httpHandler = createAgentChatHandler(pluginConfig, { llm: CHAT_LLM });
      const httpReq = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify({
            session_id: "sess_http",
            message: "我可以用司美格鲁肽吗？",
            agent_pack_id: glp1Pack.id,
          });
        },
      } as IncomingMessage;
      const httpRes = createMockResponse();
      await httpHandler(httpReq, httpRes);
      expect(httpRes.statusCode).toBe(200);
      const httpBody = JSON.parse(httpRes.getBody()) as { audit_trail_id: string };
      expect(httpBody.audit_trail_id).toMatch(/^aud_/);

      const tool = createTrustclawTraQueryToolFactory(pluginConfig, { llm: CHAT_LLM })({
        sessionKey: "agent:main:sess_ws",
        sessionId: "sess_ws",
        agentId: "main",
        sandboxed: false,
      });
      const toolResult = await tool!.execute("call-parity", {
        message: "我可以用司美格鲁肽吗？",
      });
      const wsContext = (
        toolResult as {
          details?: { trustclaw?: { runtime_context?: { audit_trail_id?: string } } };
        }
      ).details?.trustclaw?.runtime_context;
      expect(wsContext?.audit_trail_id).toMatch(/^aud_/);

      const httpMissing = missingChatPipelineSteps(auditDir, httpBody.audit_trail_id, {
        expectedSteps: glp1Pack.pipeline.stages,
      });
      const wsMissing = missingChatPipelineSteps(auditDir, wsContext!.audit_trail_id!, {
        expectedSteps: glp1Pack.pipeline.stages,
      });
      expect(httpMissing).toEqual([]);
      expect(wsMissing).toEqual([]);

      const httpSteps = readAuditEvents({ auditDir, limit: 50 })
        .filter((event) => event.audit_trail_id === httpBody.audit_trail_id)
        .map((event) => event.step);
      const wsSteps = readAuditEvents({ auditDir, limit: 50 })
        .filter((event) => event.audit_trail_id === wsContext!.audit_trail_id)
        .map((event) => event.step);
      expect(wsSteps).toEqual(httpSteps);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("HTTP and WS expose coordinator attribution with matching agent_pack_id (Phase 3)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-mca-coordinator-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "tra-audit");
    const evidenceDir = path.join(dir, "tra-evidence");
    const pluginConfig = { dbPath, auditDir, evidenceDir };
    const glp1Pack = getAgentPackRegistry().get("glp1-eligibility")!;
    setAgentDomainGrant(glp1Pack.id, deriveAgentDomainScopes(glp1Pack), { dbPath, auditDir });
    const sessionId = "sess_coordinator_parity";

    try {
      expect(
        initializeTra(
          {
            ...TRA_INIT_DEFAULTS,
            weight: 85,
            height: 170,
            hba1c: 6.8,
            hasType2Diabetes: true,
          },
          { dbPath },
        ).status,
      ).toBe("success");

      const httpHandler = createAgentChatHandler(pluginConfig, { llm: CHAT_LLM });
      const httpReq = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify({
            session_id: sessionId,
            message: "我可以用司美格鲁肽吗？",
            agent_pack_id: glp1Pack.id,
          });
        },
      } as IncomingMessage;
      const httpRes = createMockResponse();
      await httpHandler(httpReq, httpRes);
      expect(httpRes.statusCode).toBe(200);
      const httpBody = JSON.parse(httpRes.getBody()) as {
        agent_pack_id?: string;
        agent_pack_source?: string;
      };
      expect(httpBody.agent_pack_id).toBe(glp1Pack.id);
      expect(httpBody.agent_pack_source).toBe("request");

      const tool = createTrustclawTraQueryToolFactory(pluginConfig, { llm: CHAT_LLM })({
        sessionKey: sessionId,
        sessionId,
        agentId: "main",
        sandboxed: false,
      });
      const toolResult = await tool!.execute("call-coordinator", {
        message: "我可以用司美格鲁肽吗？",
      });
      const wsContext = (
        toolResult as {
          details?: {
            trustclaw?: {
              runtime_context?: { agent_pack_id?: string; agent_pack_source?: string };
            };
          };
        }
      ).details?.trustclaw?.runtime_context;
      expect(wsContext?.agent_pack_id).toBe(glp1Pack.id);
      expect(wsContext?.agent_pack_source).toBe("session");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
