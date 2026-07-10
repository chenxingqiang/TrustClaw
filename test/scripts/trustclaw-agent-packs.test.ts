import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isNonWritableAgentPacksDir,
  resolveOperatorAgentPacksDir,
  resolveTrustclawTraPluginConfig,
  seedBundledAgentPacksIfMissing,
} from "../../scripts/lib/trustclaw-agent-packs.mjs";
import { resolveTrustclawProfileStateDir } from "../../scripts/lib/trustclaw-defaults.mjs";

function writePackDir(root: string, folderName: string, packId: string) {
  const packDir = path.join(root, folderName);
  mkdirSync(path.join(packDir, "prompts"), { recursive: true });
  writeFileSync(
    path.join(packDir, "agent.pack.json"),
    JSON.stringify({ id: packId, version: "1.0.0" }, null, 2),
  );
  writeFileSync(path.join(packDir, "prompts", "system.md"), "# test");
}

describe("trustclaw profile paths", () => {
  it("resolveTrustclawProfileStateDir maps default and dev profiles", () => {
    expect(resolveTrustclawProfileStateDir("/home/op", [])).toBe("/home/op/.openclaw");
    expect(resolveTrustclawProfileStateDir("/home/op", ["--dev"])).toBe("/home/op/.openclaw-dev");
  });
});

describe("trustclaw-agent-packs", () => {
  it("resolveTrustclawTraPluginConfig defaults agentPacksDir under state dir", () => {
    const merged = resolveTrustclawTraPluginConfig({}, "/home/op/.openclaw");
    expect(merged.enabled).toBe(true);
    expect(merged.config?.agentPacksDir).toBe("/home/op/.openclaw/agent-packs");
    expect(merged.config?.defaultAgentPack).toBe("glp1-eligibility");
  });

  it("resolveTrustclawTraPluginConfig preserves operator agentPacksDir override", () => {
    const merged = resolveTrustclawTraPluginConfig(
      { config: { agentPacksDir: "/srv/packs", defaultAgentPack: "custom-pack" } },
      "/home/op/.openclaw",
    );
    expect(merged.config?.agentPacksDir).toBe("/srv/packs");
    expect(merged.config?.defaultAgentPack).toBe("custom-pack");
  });

  it("rewrites image-bundled and legacy merged dirs to writable agent-packs", () => {
    expect(isNonWritableAgentPacksDir("/app/trustclaw/agents")).toBe(true);
    expect(isNonWritableAgentPacksDir("/home/node/.openclaw/state/trustclaw-agents-merged")).toBe(
      true,
    );
    expect(isNonWritableAgentPacksDir("/home/node/.openclaw/agent-packs")).toBe(false);

    const fromImage = resolveTrustclawTraPluginConfig(
      { config: { agentPacksDir: "/app/trustclaw/agents" } },
      "/home/node/.openclaw",
    );
    expect(fromImage.config?.agentPacksDir).toBe("/home/node/.openclaw/agent-packs");

    const fromMerged = resolveTrustclawTraPluginConfig(
      { config: { agentPacksDir: "/home/node/.openclaw/state/trustclaw-agents-merged" } },
      "/home/node/.openclaw",
    );
    expect(fromMerged.config?.agentPacksDir).toBe("/home/node/.openclaw/agent-packs");
  });

  it("resolveOperatorAgentPacksDir nests under state dir", () => {
    expect(resolveOperatorAgentPacksDir("/home/operator/.openclaw")).toBe(
      path.join("/home/operator/.openclaw", "agent-packs"),
    );
  });

  it("seedBundledAgentPacksIfMissing copies packs once and skips scaffolding", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-agent-packs-"));
    const bundled = path.join(root, "bundled");
    const target = path.join(root, "target");
    try {
      writePackDir(bundled, "glp1", "glp1-eligibility");
      writePackDir(bundled, "compliance-auditor", "compliance-auditor");
      mkdirSync(path.join(bundled, "_template"), { recursive: true });
      writeFileSync(path.join(bundled, "_template", "agent.pack.json"), "{}");

      const first = seedBundledAgentPacksIfMissing(bundled, target);
      expect(first.seeded.sort()).toEqual(["compliance-auditor", "glp1"]);
      expect(first.skipped).toEqual([]);
      expect(readFileSync(path.join(target, "glp1", "prompts", "system.md"), "utf8")).toBe(
        "# test",
      );

      const second = seedBundledAgentPacksIfMissing(bundled, target);
      expect(second.seeded).toEqual([]);
      expect(second.skipped.sort()).toEqual(["compliance-auditor", "glp1"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("seedBundledAgentPacksIfMissing is a no-op when bundled dir is missing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-agent-packs-missing-"));
    try {
      const result = seedBundledAgentPacksIfMissing(
        path.join(root, "missing-bundled"),
        path.join(root, "target"),
      );
      expect(result).toEqual({ seeded: [], skipped: [] });
      expect(existsSync(path.join(root, "target"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves operator edits by not overwriting existing pack folders", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-agent-packs-edit-"));
    const bundled = path.join(root, "bundled");
    const target = path.join(root, "target");
    try {
      writePackDir(bundled, "glp1", "glp1-eligibility");
      writePackDir(target, "glp1", "glp1-eligibility");
      writeFileSync(path.join(target, "glp1", "prompts", "system.md"), "# operator-owned");

      const result = seedBundledAgentPacksIfMissing(bundled, target);
      expect(result.seeded).toEqual([]);
      expect(result.skipped).toEqual(["glp1"]);
      expect(readFileSync(path.join(target, "glp1", "prompts", "system.md"), "utf8")).toBe(
        "# operator-owned",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
