import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { describe, expect, it, vi } from "vitest";
import { createPluginText2SqlLlm } from "./plugin-text2sql-llm.js";

describe("createPluginText2SqlLlm", () => {
  it("delegates Text2SQL prompts to api.runtime.llm.complete", async () => {
    const complete = vi.fn(async () => ({
      text: "SELECT 1",
      provider: "openai",
      model: "gpt-5.5-mini",
      agentId: "main",
      usage: {},
      audit: { caller: { kind: "plugin" as const, id: "trustclaw-tra" } },
    }));
    const api = {
      runtime: { llm: { complete } },
    } as unknown as OpenClawPluginApi;

    const llm = createPluginText2SqlLlm(api, { agentId: "main", model: "openai/gpt-5.5-mini" });
    await expect(llm("SCHEMA\n...\nQ: BMI")).resolves.toBe("SELECT 1");
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "main",
        model: "openai/gpt-5.5-mini",
        purpose: "trustclaw.text2sql",
        temperature: 0,
        messages: [{ role: "user", content: "SCHEMA\n...\nQ: BMI" }],
      }),
    );
  });
});
