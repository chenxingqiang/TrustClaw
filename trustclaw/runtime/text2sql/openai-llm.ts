import type { Text2SqlLlmCaller } from "../../runtime/text2sql/types.js";

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

/**
 * Minimal OpenAI-compatible Text2SQL caller for **unit tests and offline harnesses only**.
 * Production plugin wiring uses `extensions/trustclaw-tra/src/plugin-text2sql-llm.ts`
 * (`api.runtime.llm.complete` → OpenClaw provider routing).
 */
export function createOpenAiText2SqlLlm(options?: {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): Text2SqlLlmCaller {
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  const model = options?.model ?? process.env.TRUSTCLAW_TEXT2SQL_MODEL?.trim() ?? "gpt-4.1-mini";
  const baseUrl = (
    options?.baseUrl ??
    process.env.OPENAI_BASE_URL ??
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  return async (prompt: string) => {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for TrustClaw Text2SQL.");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Text2SQL LLM request failed (${response.status}): ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  };
}
