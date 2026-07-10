import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const PACK_FILENAME = "agent.pack.json";

/**
 * Copy bundled agent pack directories into operator-owned agentPacksDir when missing.
 * Skips `_`-prefixed scaffolding dirs; never overwrites an existing pack folder.
 */
export function seedBundledAgentPacksIfMissing(bundledAgentsDir, targetAgentsDir) {
  const seeded = [];
  const skipped = [];
  if (!existsSync(bundledAgentsDir)) {
    return { seeded, skipped };
  }
  mkdirSync(targetAgentsDir, { recursive: true });
  for (const entry of readdirSync(bundledAgentsDir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) {
      continue;
    }
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const packFile = path.join(bundledAgentsDir, entry.name, PACK_FILENAME);
    if (!existsSync(packFile)) {
      continue;
    }
    const targetDir = path.join(targetAgentsDir, entry.name);
    if (existsSync(targetDir)) {
      skipped.push(entry.name);
      continue;
    }
    cpSync(path.join(bundledAgentsDir, entry.name), targetDir, { recursive: true });
    seeded.push(entry.name);
  }
  return { seeded, skipped };
}

export function resolveOperatorAgentPacksDir(stateDir) {
  return path.join(stateDir, "agent-packs");
}

/**
 * Image-bundled or retired Docker paths must not stay as writable agentPacksDir.
 * Panel C2 mutations need a volume-backed directory under OPENCLAW_STATE_DIR.
 */
export function isNonWritableAgentPacksDir(agentsDir) {
  const normalized = agentsDir.replaceAll("\\", "/").replace(/\/+$/, "");
  if (!normalized) {
    return true;
  }
  if (normalized === "/app/trustclaw/agents" || normalized.endsWith("/app/trustclaw/agents")) {
    return true;
  }
  // Pre-R43 Docker bootstrap used a merged tree under state/; canonicalize to agent-packs.
  if (normalized.endsWith("/state/trustclaw-agents-merged")) {
    return true;
  }
  return false;
}

/** Merge trustclaw-tra plugin entry for setup; preserves operator agentPacksDir override. */
export function resolveTrustclawTraPluginConfig(existingEntry, stateDir) {
  const existing = existingEntry ?? {};
  const configured =
    typeof existing.config?.agentPacksDir === "string" ? existing.config.agentPacksDir.trim() : "";
  const agentPacksDir =
    configured && !isNonWritableAgentPacksDir(configured)
      ? configured
      : resolveOperatorAgentPacksDir(stateDir);
  return {
    ...existing,
    enabled: true,
    config: {
      ...(existing.config ?? {}),
      agentPacksDir,
      defaultAgentPack: existing.config?.defaultAgentPack ?? "glp1-eligibility",
    },
  };
}

/**
 * Copy tra-* domain coordinator packs into workspace/trustclaw-agents for D24 pack_path alignment.
 * Never overwrites an existing pack folder.
 */
export function seedDomainAgentPackWorkspace(bundledAgentsDir, workspaceAgentsDir) {
  const seeded = [];
  const skipped = [];
  if (!existsSync(bundledAgentsDir)) {
    return { seeded, skipped };
  }
  mkdirSync(workspaceAgentsDir, { recursive: true });
  for (const entry of readdirSync(bundledAgentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    if (!entry.name.startsWith("tra-")) {
      continue;
    }
    const packFile = path.join(bundledAgentsDir, entry.name, PACK_FILENAME);
    if (!existsSync(packFile)) {
      continue;
    }
    const targetDir = path.join(workspaceAgentsDir, entry.name);
    if (existsSync(targetDir)) {
      skipped.push(entry.name);
      continue;
    }
    cpSync(path.join(bundledAgentsDir, entry.name), targetDir, { recursive: true });
    seeded.push(entry.name);
  }
  return { seeded, skipped };
}
