import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAgentPackRegistry } from "../runtime/agent-pack/index.js";
import {
  getAgentDomainGrant,
  resolveAgentDomainGrantPath,
  setAgentDomainGrant,
} from "./agent-domain-grants.js";

describe("agent-domain-grants", () => {
  it("drops scopes outside pack manifest ceiling on read and write", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-grants-"));
    const auditDir = path.join(dir, "tra-audit");
    mkdirSync(auditDir, { recursive: true });
    try {
      const glp1 = getAgentPackRegistry().get("glp1-eligibility");
      expect(glp1).toBeDefined();
      if (!glp1) {
        return;
      }

      setAgentDomainGrant(glp1.id, ["tra.chat", "panel.compliance"], { auditDir });

      const grantPath = resolveAgentDomainGrantPath({ auditDir });
      writeFileSync(
        grantPath,
        `${JSON.stringify(
          {
            grants: {
              [glp1.id]: {
                granted_at: 1,
                scopes: ["tra.chat", "panel.compliance", "tra.write"],
              },
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const entry = getAgentDomainGrant(glp1.id, { auditDir });
      expect(entry?.scopes).toContain("tra.chat");
      expect(entry?.scopes).not.toContain("panel.compliance");
      expect(entry?.scopes).not.toContain("tra.write");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
