import { describe, expect, it } from "vitest";
import {
  parsePersonalWriteFromToolResult,
  parseRuntimeContextFromToolResult,
  TRUSTCLAW_PTDS_QUERY_TOOL,
  TRUSTCLAW_PTDS_WRITE_TOOL,
} from "./trustclaw-ptds-bridge.ts";

describe("trustclaw-ptds-bridge", () => {
  it("exports the PTDS tool names used by the plugin", () => {
    expect(TRUSTCLAW_PTDS_QUERY_TOOL).toBe("trustclaw_ptds_query");
    expect(TRUSTCLAW_PTDS_WRITE_TOOL).toBe("trustclaw_ptds_write");
  });

  it("parses Runtime Context from tool result details", () => {
    const context = {
      session_id: "sess_1",
      user_query: "hello",
      pipeline_stages: { agent_decision: { response: "ok", citations: [] } },
      audit_trail_id: "aud_1",
      evidence_ledger_receipt: { block_height: 0, proof_hash: "abc" },
    };
    const parsed = parseRuntimeContextFromToolResult({
      content: [{ type: "text", text: "ok" }],
      details: { trustclaw: { runtime_context: context } },
    });
    expect(parsed).toEqual(context);
  });

  it("parses successful personal write from tool result details", () => {
    const parsed = parsePersonalWriteFromToolResult({
      details: {
        trustclaw: {
          personal_write: {
            status: "success",
            tables: ["body_anthropometrics"],
            rows_affected: 1,
          },
        },
      },
    });
    expect(parsed).toEqual({
      status: "success",
      tables: ["body_anthropometrics"],
      rows_affected: 1,
    });
  });
});
