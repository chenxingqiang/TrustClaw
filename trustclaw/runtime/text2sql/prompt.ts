import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPtdsSchemaSnippet } from "./schema-context.js";

const PROMPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../agents/glp1/prompts/text2sql.v1.md",
);

let cachedTemplate: string | undefined;

function loadPromptTemplate(): string {
  if (cachedTemplate) {
    return cachedTemplate;
  }
  cachedTemplate = readFileSync(PROMPT_PATH, "utf8");
  return cachedTemplate;
}

export function buildText2SqlPrompt(params: {
  userQuery: string;
  databaseSchema?: string;
}): string {
  const schema = params.databaseSchema?.trim() || loadPtdsSchemaSnippet();
  return loadPromptTemplate()
    .replace("{{DATABASE_SCHEMA}}", schema)
    .replace("{{USER_QUERY}}", params.userQuery.trim());
}
