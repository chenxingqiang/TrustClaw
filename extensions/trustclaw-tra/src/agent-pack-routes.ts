import type { IncomingMessage, ServerResponse } from "node:http";
import {
  agentPackDocumentJsonSchemaRef,
  describeAgentPackDetail,
  getAgentPackRegistry,
  inspectAgentPackDocument,
  listAgentPackExtensionPoints,
  summarizeAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/tra/config.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

function readAgentPacksSubpath(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.replace(/^\/api\/tra\/agent-packs\/?/, "").trim();
}

function loadRegistry(pluginConfig: TrustclawPluginConfig | undefined) {
  return getAgentPackRegistry({
    agentsDir: pluginConfig?.agentPacksDir,
    defaultPackId: pluginConfig?.defaultAgentPack,
  });
}

export function createAgentPacksHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    try {
      const subpath = readAgentPacksSubpath(req);

      if (subpath === "validate") {
        if (!methodIs(req, "POST")) {
          sendJson(res, 405, { status: "error", message: "Method not allowed." });
          return true;
        }
        const parsed = await readJsonBody(req);
        if (!parsed.ok) {
          sendJson(res, 400, { status: "error", message: parsed.message });
          return true;
        }
        const inspected = inspectAgentPackDocument(parsed.body);
        if (!inspected.ok) {
          sendJson(res, 400, {
            status: "error",
            code: "invalid_agent_pack",
            valid: false,
            issues: inspected.issues,
            schema_ref: agentPackDocumentJsonSchemaRef,
          });
          return true;
        }
        sendJson(res, 200, {
          status: "success",
          valid: true,
          pack: describeAgentPackDetail(inspected.pack),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      if (!methodIs(req, "GET")) {
        sendJson(res, 405, { status: "error", message: "Method not allowed." });
        return true;
      }

      const registry = loadRegistry(pluginConfig);

      if (!subpath) {
        const packs = registry.list().map((pack) => summarizeAgentPack(pack));
        sendJson(res, 200, {
          status: "success",
          default_pack_id: registry.getDefault().id,
          packs,
          extension_points: listAgentPackExtensionPoints(),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      if (subpath === "extension-points") {
        sendJson(res, 200, {
          status: "success",
          ...listAgentPackExtensionPoints(),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      const pack = registry.get(subpath);
      if (!pack) {
        sendJson(res, 404, {
          status: "error",
          code: "pack_not_found",
          message: `Unknown agent pack id: ${subpath}`,
        });
        return true;
      }

      sendJson(res, 200, {
        status: "success",
        pack: describeAgentPackDetail(pack),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}
