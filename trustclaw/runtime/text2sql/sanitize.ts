/** Strip markdown fences and leading commentary from model output. */
export function extractSqlFromLlmOutput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const fenced = trimmed.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const lines = trimmed.split(/\r?\n/);
  const sqlLines: string[] = [];
  let started = false;
  for (const line of lines) {
    const candidate = line.trim();
    if (!started) {
      if (/^SELECT\b/i.test(candidate)) {
        started = true;
        sqlLines.push(candidate);
      }
      continue;
    }
    if (!candidate || candidate.startsWith("--")) {
      continue;
    }
    if (/^(here is|the sql|sql query|answer)/i.test(candidate)) {
      break;
    }
    sqlLines.push(candidate);
  }

  if (sqlLines.length > 0) {
    return sqlLines.join("\n").replace(/;+\s*$/, "").trim();
  }

  return trimmed.replace(/^sql:\s*/i, "").trim();
}
