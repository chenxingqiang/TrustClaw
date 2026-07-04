import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  initializePtds,
  listPtdsTables,
  queryPtds,
  readGlp1CheckSnapshot,
  resetPtds,
} from "../../../trustclaw/ptds/index.js";
import { resolveTrustclawPaths, type TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const initRequestSchema = z
  .object({
    weight: z.number().finite().positive(),
    height: z.number().finite().positive(),
    hba1c: z.number().finite().nonnegative(),
    thyroid_cancer_history: z.union([z.literal(0), z.literal(1)]),
    pancreatitis_history: z.union([z.literal(0), z.literal(1)]),
    name: z.string().trim().min(1).optional(),
    include_t2dm_diagnosis: z.boolean().optional(),
  })
  .strict();

/** Default PTDS browser tables (D12). */
export const PTDS_BROWSER_TABLES = [
  "body_anthropometrics",
  "lab_test_results",
  "nrdl_payment_rules",
  "v_glp1_nrdl_check_snapshot",
] as const;

function pathOverrides(pluginConfig: TrustclawPluginConfig | undefined) {
  return resolveTrustclawPaths(pluginConfig);
}

export function createPtdsInitHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "POST")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: "error", message: parsed.message });
      return true;
    }
    const body = initRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, {
        status: "error",
        message: "Invalid PTDS init payload.",
        details: body.error.flatten(),
      });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = initializePtds(body.data, { dbPath: paths.dbPath });
    const status = result.status === "success" ? 200 : 500;
    sendJson(res, status, result);
    return true;
  };
}

export function createPtdsResetHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "POST")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = resetPtds({ dbPath: paths.dbPath });
    sendJson(res, result.status === "success" ? 200 : 500, result);
    return true;
  };
}

export function createPtdsStatusHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const snapshot = readGlp1CheckSnapshot({ dbPath: paths.dbPath });
    sendJson(res, 200, {
      status: "success",
      mounted: snapshot !== null,
      db_file: paths.dbPath,
      snapshot,
    });
    return true;
  };
}

export function createPtdsTablesHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const allTables = listPtdsTables({ dbPath: paths.dbPath });
    sendJson(res, 200, {
      status: "success",
      default_tables: [...PTDS_BROWSER_TABLES],
      tables: allTables,
    });
    return true;
  };
}

export function createPtdsBrowseHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const table = url.searchParams.get("table")?.trim() ?? "";
    const limitRaw = url.searchParams.get("limit") ?? "100";
    const limit = Math.min(Math.max(Number.parseInt(limitRaw, 10) || 100, 1), 500);
    if (!table) {
      sendJson(res, 400, { status: "error", message: "Missing table query parameter." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const allowed = new Set(listPtdsTables({ dbPath: paths.dbPath }));
    if (!allowed.has(table) || !/^[a-zA-Z0-9_]+$/.test(table)) {
      sendJson(res, 400, { status: "error", message: "Table not allowed." });
      return true;
    }
    try {
      const result = queryPtds(
        `SELECT * FROM ${table} LIMIT ${limit}`,
        { dbPath: paths.dbPath },
      );
      sendJson(res, 200, {
        status: "success",
        table,
        ...result,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
      return true;
    }
  };
}
