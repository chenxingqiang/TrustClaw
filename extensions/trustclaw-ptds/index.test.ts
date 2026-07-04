// TrustClaw PTDS plugin tests cover HTTP route registration and init handler.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import plugin from "./index.js";
import manifest from "./openclaw.plugin.json" with { type: "json" };
import { createPtdsInitHandler } from "./src/ptds-routes.js";

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

describe("trustclaw-ptds plugin", () => {
  it("activates when plugin entry is enabled in config", () => {
    expect(manifest.activation).toEqual({
      onStartup: false,
      onConfigPaths: ["plugins.entries.trustclaw-ptds"],
    });
  });

  it("registers PTDS HTTP routes", () => {
    const routes: Array<{ path: string; auth: string; match: string }> = [];
    plugin.register({
      registerHttpRoute(route) {
        routes.push(route as { path: string; auth: string; match: string });
      },
      pluginConfig: {},
      logger: { info: vi.fn() },
    } as Parameters<typeof plugin.register>[0]);

    expect(routes.map((route) => route.path)).toEqual([
      "/api/ptds/init",
      "/api/ptds/reset",
      "/api/ptds/status",
      "/api/ptds/tables",
      "/api/ptds/browse",
    ]);
    expect(routes.every((route) => route.auth === "plugin" && route.match === "exact")).toBe(true);
  });

  it("handles POST /api/ptds/init with frozen contract shape", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-plugin-init-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const handler = createPtdsInitHandler({ dbPath });
      const req = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify({
            weight: 85,
            height: 170,
            hba1c: 6.8,
            thyroid_cancer_history: 0,
            pancreatitis_history: 0,
            include_t2dm_diagnosis: true,
          });
        },
      } as IncomingMessage;
      const res = createMockResponse();
      const handled = await handler(req, res);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.getBody()) as {
        status: string;
        records_inserted: number;
        db_file: string;
      };
      expect(payload.status).toBe("success");
      expect(payload.records_inserted).toBeGreaterThanOrEqual(4);
      expect(payload.db_file).toBe(dbPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
