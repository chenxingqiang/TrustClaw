import { describe, expect, it } from "vitest";
import { listAgentPackExtensionPoints } from "./extension-points.js";
import { AGENT_PACK_PIPELINE_STAGES } from "./schema.js";

describe("listAgentPackExtensionPoints", () => {
  it("lists pipeline stages and bundled engine ids for pack authoring", () => {
    const points = listAgentPackExtensionPoints();
    expect(points.pipelineStages).toEqual(AGENT_PACK_PIPELINE_STAGES);
    expect(points.ruleEngines).toContain("none");
    expect(points.decisionBuilders).toContain("pass-through");
  });
});

describe("listSkillLoopVerifyCommands", () => {
  it("includes openclaw skills check for skill loop verify", async () => {
    const { listSkillLoopVerifyCommands } = await import("./skill-loop.js");
    expect(listSkillLoopVerifyCommands()).toContain("openclaw skills check");
  });
});
