import { mkdtempSync, rmSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bootstrapTraDatabase } from "../../../trustclaw/tra/db.js";
import { countDomainAgents } from "../../../trustclaw/tra/domain-agents-import.js";
import {
  createDomainAgentsBundledRegistryHandler,
  createDomainAgentsHandler,
} from "./domain-agent-routes.js";

function mockRes(): { res: { statusCode: number; body: string }; getBody: () => unknown } {
  const state = { statusCode: 200, body: "" };
  const res = {
    setHeader: () => {},
    end(chunk: string) {
      state.body = chunk;
    },
  } as never;
  Object.defineProperty(res, "statusCode", {
    get: () => state.statusCode,
    set: (value: number) => {
      state.statusCode = value;
    },
  });
  return {
    res,
    getBody: () => JSON.parse(state.body || "{}"),
  };
}

function mockJsonReq(method: string, url: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? "" : JSON.stringify(body);
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      if (payload) {
        yield Buffer.from(payload);
      }
    },
  } as IncomingMessage;
}

describe("domain-agent-routes", () => {
  it("GET lists bundled domain agents after bootstrap", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-domain-routes-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      bootstrapTraDatabase(dbPath);
      const handler = createDomainAgentsHandler({ dbPath });
      const { res, getBody } = mockRes();
      await handler({ method: "GET", url: "/api/tra/domain-agents" } as never, res);
      const body = getBody() as { summary: { total: number }; available: boolean };
      expect(body.available).toBe(true);
      expect(body.summary.total).toBe(1000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("POST bundled-registry imports when table is partial (D24)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-domain-import-route-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      const db = bootstrapTraDatabase(dbPath);
      db.exec("DELETE FROM domain_agents");
      db.prepare(
        `INSERT INTO domain_agents (agent_id, agent_name, domain, enabled, pack_id)
         VALUES (?, ?, ?, ?, ?)`,
      ).run("partial-1", "Partial", "audit", "false", "tra-audit");
      db.close();

      const handler = createDomainAgentsBundledRegistryHandler({ dbPath });
      const { res, getBody } = mockRes();
      await handler(mockJsonReq("POST", "/api/tra/domain-agents/import/bundled-registry", {}), res);
      const body = getBody() as { status: string; total_count?: number };
      expect(body.status).toBe("success");
      expect(body.total_count).toBe(1000);

      const verify = bootstrapTraDatabase(dbPath);
      expect(countDomainAgents(verify)).toBe(1000);
      verify.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
