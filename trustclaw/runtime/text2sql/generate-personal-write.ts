import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDeviceImportSchemaSnippet } from "./device-write-schema.js";
import {
  assertDeviceImportStatements,
  DeviceImportSecurityError,
  extractInsertSqlFromLlmOutput,
  extractInsertTables,
  splitInsertStatements,
} from "./device-write-sanitize.js";

const PERSONAL_PROMPT_PATH = fileURLToPath(
  new URL("../../agents/glp1/prompts/personal-write-sql.v1.md", import.meta.url),
);

let cachedPersonalPromptTemplate: string | undefined;

function loadPersonalPromptTemplate(): string {
  if (!cachedPersonalPromptTemplate) {
    cachedPersonalPromptTemplate = readFileSync(PERSONAL_PROMPT_PATH, "utf8");
  }
  return cachedPersonalPromptTemplate;
}

export function buildPersonalWriteSqlPrompt(params: {
  writeRequest: string;
  profileSnapshot: Record<string, unknown>;
  databaseSchema?: string;
}): string {
  const schema = params.databaseSchema?.trim() || loadDeviceImportSchemaSnippet();
  return loadPersonalPromptTemplate()
    .replace("{{WRITE_REQUEST}}", params.writeRequest.trim())
    .replace("{{PROFILE_SNAPSHOT}}", JSON.stringify(params.profileSnapshot, null, 2))
    .replace("{{DATABASE_SCHEMA}}", schema);
}

export type PersonalWriteGenerateInput = {
  writeRequest: string;
  profileSnapshot: Record<string, unknown>;
  databaseSchema?: string;
};

export type PersonalWriteGenerateOptions = {
  llm: (prompt: string) => Promise<string>;
};

export type PersonalWriteGenerateResult = {
  statements: string[];
  sql: string;
  duration_ms: number;
  source: "llm" | "empty";
  tables: string[];
  write_verification: boolean;
  security_error?: string;
};

export async function generatePersonalWriteSql(
  input: PersonalWriteGenerateInput,
  options: PersonalWriteGenerateOptions,
): Promise<PersonalWriteGenerateResult> {
  const started = Date.now();
  const prompt = buildPersonalWriteSqlPrompt({
    writeRequest: input.writeRequest,
    profileSnapshot: input.profileSnapshot,
    databaseSchema: input.databaseSchema,
  });
  const llmRaw = await options.llm(prompt);
  const cleaned = extractInsertSqlFromLlmOutput(llmRaw);
  if (!cleaned) {
    return {
      statements: [],
      sql: "",
      duration_ms: Date.now() - started,
      source: "empty",
      tables: [],
      write_verification: false,
      security_error: "LLM returned no INSERT SQL for the write request.",
    };
  }

  const statements = splitInsertStatements(cleaned);
  try {
    const verified = assertDeviceImportStatements(statements);
    return {
      statements,
      sql: statements.join(";\n"),
      duration_ms: Date.now() - started,
      source: "llm",
      tables: verified.tables,
      write_verification: true,
    };
  } catch (error) {
    const message =
      error instanceof DeviceImportSecurityError ? error.message : String(error);
    return {
      statements,
      sql: statements.join(";\n"),
      duration_ms: Date.now() - started,
      source: "llm",
      tables: extractInsertTables(cleaned),
      write_verification: false,
      security_error: message,
    };
  }
}
