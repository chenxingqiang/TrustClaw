import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDeviceImportSchemaSnippet } from "./device-write-schema.js";

const PROMPT_PATH = fileURLToPath(
  new URL("../../agents/glp1/prompts/device-import-sql.v1.md", import.meta.url),
);

const MAX_PAYLOAD_CHARS = 24_000;

let cachedPromptTemplate: string | undefined;

function loadPromptTemplate(): string {
  if (!cachedPromptTemplate) {
    cachedPromptTemplate = readFileSync(PROMPT_PATH, "utf8");
  }
  return cachedPromptTemplate;
}

function truncatePayload(payload: unknown): string {
  const json = JSON.stringify(payload, null, 2);
  if (json.length <= MAX_PAYLOAD_CHARS) {
    return json;
  }
  return `${json.slice(0, MAX_PAYLOAD_CHARS)}\n/* … truncated … */`;
}

export function buildDeviceImportSqlPrompt(params: {
  devicePayload: unknown;
  deviceHint?: string;
  databaseSchema?: string;
}): string {
  const schema = params.databaseSchema?.trim() || loadDeviceImportSchemaSnippet();
  const hint = params.deviceHint?.trim() || "Unknown third-party device API export";
  return loadPromptTemplate()
    .replace("{{DEVICE_HINT}}", hint)
    .replace("{{DEVICE_PAYLOAD}}", truncatePayload(params.devicePayload))
    .replace("{{DATABASE_SCHEMA}}", schema);
}
