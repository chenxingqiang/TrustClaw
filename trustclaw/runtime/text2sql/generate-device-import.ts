import { buildDeviceImportSqlPrompt } from "./device-write-prompt.js";
import {
  assertDeviceImportStatements,
  DeviceImportSecurityError,
  extractInsertSqlFromLlmOutput,
  extractInsertTables,
  splitInsertStatements,
} from "./device-write-sanitize.js";

export type DeviceImportGenerateInput = {
  devicePayload: unknown;
  deviceHint?: string;
  databaseSchema?: string;
};

export type DeviceImportGenerateOptions = {
  llm: (prompt: string) => Promise<string>;
};

export type DeviceImportGenerateResult = {
  statements: string[];
  sql: string;
  duration_ms: number;
  source: "llm" | "empty";
  tables: string[];
  write_verification: boolean;
  security_error?: string;
};

export async function generateDeviceImportSql(
  input: DeviceImportGenerateInput,
  options: DeviceImportGenerateOptions,
): Promise<DeviceImportGenerateResult> {
  const started = Date.now();
  const prompt = buildDeviceImportSqlPrompt({
    devicePayload: input.devicePayload,
    deviceHint: input.deviceHint,
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
      security_error: "LLM returned no INSERT SQL for the device payload.",
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
