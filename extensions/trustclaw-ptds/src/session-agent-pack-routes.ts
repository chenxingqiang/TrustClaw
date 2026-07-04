import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
import {
  getSessionAgentPackId,
  setSessionAgentPackId,
} from "../../../trustclaw/ptds/session-agent-pack.js";
import {
  getAgentPackRegistry,
  summarizeAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import { resolveSessionAgentPack } from "../../../trustclaw/runtime/agent-pack/resolve-session.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const putBodySchema = z
  .object({
    session_id: z.string().trim().min(1),
    agent_pack_id: z.string().trim().min(1),
  })
  .strict();

function readSessionIdFromQuery(req: IncomingMessage): string | undefined {
  const url = new URL(req.url ?? "/", "http://localhost");
  const sessionId =
    url.searchParams.get("session_id")?.trim() ||
    url.searchParams.get("session_key")?.trim() ||
    "";
  return sessionId || undefined;
}

export function createSessionAgentPackGetHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    const sessionId = readSessionIdFromQuery(req);
    if (!sessionId) {
      sendJson(res, 400, { status: "error", message: "session_id query parameter is required." });
      return true;
    }

    try {
      const paths = resolveTrustclawPaths(pluginConfig);
      const url = new URL(req.url ?? "/", "http://localhost");
      const openclawAgentId = url.searchParams.get("openclaw_agent_id")?.trim();
      const resolved = resolveSessionAgentPack({
        sessionKey: sessionId,
        openclawAgentId: openclawAgentId || undefined,
        pluginConfig,
      });
      const sessionOverride = getSessionAgentPackId(sessionId, {
        dbPath: paths.dbPath,
        auditDir: paths.auditDir,
      });
      sendJson(res, 200, {
        status: "success",
        session_id: sessionId,
        agent_pack_id: resolved.pack.id,
        resolved_from: resolved.source,
        session_override: sessionOverride ?? null,
        pack: summarizeAgentPack(resolved.pack),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}

export function createSessionAgentPackPutHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "PUT")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: "error", message: parsed.message });
      return true;
    }

    const body = putBodySchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, {
        status: "error",
        message: "Invalid session agent pack payload.",
        details: body.error.flatten(),
      });
      return true;
    }

    try {
      const paths = resolveTrustclawPaths(pluginConfig);
      const registry = getAgentPackRegistry({
        agentsDir: pluginConfig?.agentPacksDir,
        defaultPackId: pluginConfig?.defaultAgentPack,
      });
      const pack = registry.resolve({ packId: body.data.agent_pack_id });
      setSessionAgentPackId(body.data.session_id, pack.id, {
        dbPath: paths.dbPath,
        auditDir: paths.auditDir,
      });
      sendJson(res, 200, {
        status: "success",
        session_id: body.data.session_id,
        agent_pack_id: pack.id,
        resolved_from: "session",
        pack: summarizeAgentPack(pack),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { status: "error", message });
    }
    return true;
  };
}
