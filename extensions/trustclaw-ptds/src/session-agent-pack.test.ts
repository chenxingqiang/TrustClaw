import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetAgentPackRegistryCache } from "../../../trustclaw/runtime/agent-pack/index.js";
import { resolveSessionAgentPack } from "../../../trustclaw/runtime/agent-pack/resolve-session.js";
import {
  clearSessionAgentPackId,
  getSessionAgentPackId,
  setSessionAgentPackId,
} from "../../../trustclaw/ptds/session-agent-pack.js";

describe("session agent pack store", () => {
  let auditDir = "";

  afterEach(() => {
    if (auditDir) {
      rmSync(auditDir, { recursive: true, force: true });
      auditDir = "";
    }
    resetAgentPackRegistryCache();
  });

  it("persists pack id per session key", () => {
    auditDir = mkdtempSync(path.join(tmpdir(), "ptds-session-pack-"));
    const overrides = { auditDir };

    expect(getSessionAgentPackId("sess_a", overrides)).toBeUndefined();
    setSessionAgentPackId("sess_a", "nrdl-reimburse", overrides);
    expect(getSessionAgentPackId("sess_a", overrides)).toBe("nrdl-reimburse");
    expect(getSessionAgentPackId("sess_b", overrides)).toBeUndefined();

    clearSessionAgentPackId("sess_a", overrides);
    expect(getSessionAgentPackId("sess_a", overrides)).toBeUndefined();
  });
});

describe("resolveSessionAgentPack", () => {
  afterEach(() => {
    resetAgentPackRegistryCache();
  });

  it("prefers session override over OpenClaw agent mapping", () => {
    const auditDir = mkdtempSync(path.join(tmpdir(), "ptds-resolve-pack-"));
    try {
      setSessionAgentPackId("sess_override", "glp1-eligibility", { auditDir });
      const resolved = resolveSessionAgentPack({
        sessionKey: "sess_override",
        openclawAgentId: "compliance-auditor",
        pluginConfig: { auditDir },
      });
      expect(resolved.source).toBe("session");
      expect(resolved.pack.id).toBe("glp1-eligibility");
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it("maps OpenClaw agent id when no session override", () => {
    const resolved = resolveSessionAgentPack({
      sessionKey: "sess_agent",
      openclawAgentId: "compliance-auditor",
    });
    expect(resolved.source).toBe("openclaw_agent");
    expect(resolved.pack.id).toBe("compliance-auditor");
  });
});
