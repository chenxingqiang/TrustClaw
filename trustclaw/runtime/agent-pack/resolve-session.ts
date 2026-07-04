import type { TrustclawPluginConfig } from "../../ptds/config.js";
import { resolveTrustclawPaths } from "../../ptds/config.js";
import { getSessionAgentPackId } from "../../ptds/session-agent-pack.js";
import { getAgentPackRegistry } from "./registry.js";
import type { ResolvedAgentPack } from "./schema.js";

export type SessionAgentPackSource = "session" | "openclaw_agent" | "default";

export function resolveSessionAgentPack(params: {
  sessionKey: string;
  openclawAgentId?: string;
  pluginConfig?: TrustclawPluginConfig;
}): { pack: ResolvedAgentPack; source: SessionAgentPackSource } {
  const paths = resolveTrustclawPaths(params.pluginConfig);
  const registry = getAgentPackRegistry({
    agentsDir: params.pluginConfig?.agentPacksDir,
    defaultPackId: params.pluginConfig?.defaultAgentPack,
  });
  const sessionPackId = getSessionAgentPackId(params.sessionKey, {
    dbPath: paths.dbPath,
    auditDir: paths.auditDir,
  });
  if (sessionPackId) {
    return {
      pack: registry.resolve({ packId: sessionPackId }),
      source: "session",
    };
  }
  const openclawAgentId = params.openclawAgentId?.trim();
  if (openclawAgentId) {
    const byAgent = registry.resolve({ openclawAgentId });
    const defaultPack = registry.getDefault();
    if (byAgent.id !== defaultPack.id) {
      return { pack: byAgent, source: "openclaw_agent" };
    }
  }
  return { pack: registry.getDefault(), source: "default" };
}
