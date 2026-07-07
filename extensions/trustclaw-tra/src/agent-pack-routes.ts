import type { IncomingMessage, ServerResponse } from "node:http";
import {
  agentPackDocumentJsonSchemaRef,
  describeAgentPackDetail,
  getAgentPackRegistry,
  listAgentPackExtensionPoints,
  summarizeAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/tra/config.js";
import { methodIs, sendJson } from "./http-utils.js";

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
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    try {
      const subpath = readAgentPacksSubpath(req);
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
