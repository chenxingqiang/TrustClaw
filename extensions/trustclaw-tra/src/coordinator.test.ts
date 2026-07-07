import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetAgentPackRegistryCache } from "../../../trustclaw/runtime/agent-pack/index.js";
import { resolveCoordinatorAgentPack } from "../../../trustclaw/runtime/coordinator/index.js";
import {
  clearSessionAgentPackBinding,
  getSessionAgentPackLock,
  setSessionAgentPackBinding,
} from "../../../trustclaw/tra/session-agent-pack.js";

describe("session agent pack coordinator", () => {
  let auditDir = "";

  afterEach(() => {
    if (auditDir) {
      rmSync(auditDir, { recursive: true, force: true });
      auditDir = "";
    }
    resetAgentPackRegistryCache();
  });

  it("locks pack on first bindLock resolve", () => {
    auditDir = mkdtempSync(path.join(tmpdir(), "tra-coordinator-"));
    const overrides = { auditDir };
    const sessionKey = "agent:compliance-auditor:sess_lock";
    const first = resolveCoordinatorAgentPack({
      sessionKey,
      openclawAgentId: "compliance-auditor",
      pluginConfig: overrides,
      bindLock: true,
    });
    expect(first.pack.id).toBe("compliance-auditor");
    expect(first.locked).toBe(true);
    expect(getSessionAgentPackLock(sessionKey, overrides)).toBe("compliance-auditor");

    const second = resolveCoordinatorAgentPack({
      sessionKey,
      openclawAgentId: "nrdl-reimburse",
      pluginConfig: overrides,
      bindLock: true,
    });
    expect(second.pack.id).toBe("compliance-auditor");
    expect(second.source).toBe("lock");
    expect(second.agent_pack_mismatch).toBe(true);
  });

  it("explicit session binding overrides lock source", () => {
    auditDir = mkdtempSync(path.join(tmpdir(), "tra-coordinator-bind-"));
    const overrides = { auditDir };
    setSessionAgentPackBinding("agent:compliance-auditor:sess_bind", "nrdl-reimburse", overrides);
    const resolved = resolveCoordinatorAgentPack({
      sessionKey: "sess_bind",
      openclawAgentId: "compliance-auditor",
      pluginConfig: overrides,
      bindLock: true,
    });
    expect(resolved.pack.id).toBe("nrdl-reimburse");
    expect(resolved.source).toBe("session");
  });

  it("canonicalizes bare session ids per OpenClaw agent for pack storage", () => {
    auditDir = mkdtempSync(path.join(tmpdir(), "tra-coordinator-canonical-"));
    const overrides = { auditDir };
    resolveCoordinatorAgentPack({
      sessionKey: "sess_canon",
      openclawAgentId: "nrdl-reimburse",
      pluginConfig: overrides,
      bindLock: true,
    });
    const viaPrefixed = resolveCoordinatorAgentPack({
      sessionKey: "agent:nrdl-reimburse:sess_canon",
      openclawAgentId: "compliance-auditor",
      pluginConfig: overrides,
      bindLock: true,
    });
    expect(viaPrefixed.pack.id).toBe("nrdl-reimburse");
    expect(viaPrefixed.source).toBe("lock");
  });

  it("clears binding and lock on DELETE contract helper", () => {
    auditDir = mkdtempSync(path.join(tmpdir(), "tra-coordinator-clear-"));
    const overrides = { auditDir };
    setSessionAgentPackBinding(
      "agent:compliance-auditor:sess_clear",
      "glp1-eligibility",
      overrides,
    );
    clearSessionAgentPackBinding("agent:compliance-auditor:sess_clear", overrides);
    const resolved = resolveCoordinatorAgentPack({
      sessionKey: "sess_clear",
      openclawAgentId: "compliance-auditor",
      pluginConfig: overrides,
      bindLock: false,
    });
    expect(resolved.pack.id).toBe("compliance-auditor");
    expect(resolved.source).toBe("openclaw_agent");
  });
});
