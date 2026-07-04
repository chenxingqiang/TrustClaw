const TABLE_REF_PATTERN =
  /\b(?:FROM|JOIN)\s+(?:\()?([a-zA-Z_][\w]*)(?:\s+AS\s+[a-zA-Z_][\w]*)?(?:\))?/gi;

export function extractReferencedTables(sql: string): string[] {
  const names = new Set<string>();
  for (const match of sql.matchAll(TABLE_REF_PATTERN)) {
    const name = match[1]?.trim();
    if (name && !/^select$/i.test(name)) {
      names.add(name);
    }
  }
  return [...names].sort();
}
