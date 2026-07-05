import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import type { Text2SqlLlmCaller } from "../../../trustclaw/runtime/text2sql/types.js";

export type PluginText2SqlLlmOptions = {
  /** OpenClaw `agents.list` id whose model/auth Text2SQL should reuse. */
  agentId?: string;
  /** Optional model ref override (e.g. `openai/gpt-5.5-mini`). */
  model?: string;
};

/**
 * Wire TrustClaw Text2SQL to OpenClaw provider routing via `api.runtime.llm.complete`.
 * Keeps `trustclaw/runtime/` free of OpenClaw imports — injection lives in the plugin seam.
 */
export function createPluginText2SqlLlm(
  api: OpenClawPluginApi,
  options?: PluginText2SqlLlmOptions,
): Text2SqlLlmCaller {
  const agentId = options?.agentId?.trim() || "main";
  const model = options?.model?.trim() || process.env.TRUSTCLAW_TEXT2SQL_MODEL?.trim() || undefined;

  return async (prompt: string) => {
    const result = await api.runtime.llm.complete({
      agentId,
      model,
      temperature: 0,
      maxTokens: 768,
      purpose: "trustclaw.text2sql",
      messages: [{ role: "user", content: prompt }],
    });
    return result.text.trim();
  };
}
