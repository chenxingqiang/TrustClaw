import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { createAgentPacksHandler } from "./agent-pack-routes.js";

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

describe("GET /api/tra/agent-packs", () => {
  const handler = createAgentPacksHandler(undefined);

  it("lists packs with extension_points for authoring", async () => {
    const req = { method: "GET", url: "/api/tra/agent-packs" } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as {
      packs: { id: string }[];
      extension_points: { ruleEngines: string[] };
      schema_ref: string;
    };
    expect(body.packs.map((pack) => pack.id)).toContain("glp1-eligibility");
    expect(body.extension_points.ruleEngines).toContain("none");
    expect(body.schema_ref).toContain("agent-pack.v1.json");
  });

  it("returns extension-points subpath", async () => {
    const req = {
      method: "GET",
      url: "/api/tra/agent-packs/extension-points",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as { decisionBuilders: string[] };
    expect(body.decisionBuilders).toContain("pass-through");
  });

  it("returns pack detail by id", async () => {
    const req = {
      method: "GET",
      url: "/api/tra/agent-packs/compliance-auditor",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as {
      pack: { id: string; rules: { engine: string }; prompts: { system: string } };
    };
    expect(body.pack.id).toBe("compliance-auditor");
    expect(body.pack.rules.engine).toBe("none");
    expect(body.pack.prompts.system).toContain("prompts/");
  });

  it("returns 404 for unknown pack id", async () => {
    const req = {
      method: "GET",
      url: "/api/tra/agent-packs/not-a-real-pack",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});
