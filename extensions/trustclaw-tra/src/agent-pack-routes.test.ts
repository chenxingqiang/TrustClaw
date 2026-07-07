import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { getAgentPackRegistry } from "../../../trustclaw/runtime/agent-pack/index.js";
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

describe("POST /api/tra/agent-packs/validate", () => {
  const handler = createAgentPacksHandler(undefined);

  it("accepts a valid pack manifest without writing to disk", async () => {
    const pack = getAgentPackRegistry().get("nrdl-reimburse")!;
    const { packDir: _packDir, packFile: _packFile, ...manifest } = pack;
    const req = {
      method: "POST",
      url: "/api/tra/agent-packs/validate",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(manifest);
      },
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as { valid: boolean; pack: { id: string } };
    expect(body.valid).toBe(true);
    expect(body.pack.id).toBe("nrdl-reimburse");
  });

  it("returns structured validation issues for invalid manifests", async () => {
    const req = {
      method: "POST",
      url: "/api/tra/agent-packs/validate",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify({ id: "BAD ID" });
      },
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.getBody()) as {
      code: string;
      valid: boolean;
      issues: { path: string; message: string }[];
    };
    expect(body.code).toBe("invalid_agent_pack");
    expect(body.valid).toBe(false);
    expect(body.issues.length).toBeGreaterThan(0);
  });
});
