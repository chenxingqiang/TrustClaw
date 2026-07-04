import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeviceImportSchemaSnippet } from "./device-write-schema.js";

const PERSONAL_PROMPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../agents/glp1/prompts/personal-write-sql.v1.md",
);

let cachedPersonalPromptTemplate: string | undefined;

export function loadDefaultPersonalWritePromptTemplate(): string {
  if (!cachedPersonalPromptTemplate) {
    cachedPersonalPromptTemplate = readFileSync(PERSONAL_PROMPT_PATH, "utf8");
  }
  return cachedPersonalPromptTemplate;
}

export function buildPersonalWriteSqlPrompt(params: {
  writeRequest: string;
  profileSnapshot: Record<string, unknown>;
  databaseSchema?: string;
  promptTemplate?: string;
}): string {
  const schema = params.databaseSchema?.trim() || loadDeviceImportSchemaSnippet();
  const template = params.promptTemplate?.trim() || loadDefaultPersonalWritePromptTemplate();
  return template
    .replace("{{WRITE_REQUEST}}", params.writeRequest.trim())
    .replace("{{PROFILE_SNAPSHOT}}", JSON.stringify(params.profileSnapshot, null, 2))
    .replace("{{DATABASE_SCHEMA}}", schema);
}
