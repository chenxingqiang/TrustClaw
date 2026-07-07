import { describe, expect, it } from "vitest";
import { resolveCoordinatorSessionKey } from "./session-key.js";

describe("resolveCoordinatorSessionKey", () => {
  it("preserves OpenClaw agent-scoped session keys", () => {
    expect(resolveCoordinatorSessionKey({ sessionKey: "agent:main:thread-1" })).toBe(
      "agent:main:thread-1",
    );
  });

  it("prefixes bare session ids with openclaw agent id", () => {
    expect(
      resolveCoordinatorSessionKey({
        sessionKey: "sess_parity",
        openclawAgentId: "main",
      }),
    ).toBe("agent:main:sess_parity");
  });

  it("leaves bare session ids unchanged when agent id is missing", () => {
    expect(resolveCoordinatorSessionKey({ sessionKey: "sess_legacy" })).toBe("sess_legacy");
  });
});
