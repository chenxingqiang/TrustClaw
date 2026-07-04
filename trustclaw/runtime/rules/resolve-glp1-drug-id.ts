const DEFAULT_FLAT_DRUG_ID = "GLP1_SEMA";
const DEFAULT_AST_DRUG_ID = "29";

/** Keyword → NRDL AST drug_id in bundled GLP-1 handshake v2. Longer phrases first. */
const GLP1_DRUG_KEYWORDS: ReadonlyArray<{ drugId: string; keywords: readonly string[] }> = [
  {
    drugId: "28",
    keywords: ["聚乙二醇洛塞那肽", "洛塞那肽", "loxenatide"],
  },
  {
    drugId: "30",
    keywords: ["依苏帕格鲁肽", "efsitora"],
  },
  {
    drugId: "27",
    keywords: ["度拉糖肽", "dulaglutide"],
  },
  {
    drugId: "29",
    keywords: ["司美格鲁肽", "semaglutide"],
  },
];

export function detectGlp1DrugIdFromQuery(userQuery: string): string | null {
  const normalized = userQuery.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  let best: { drugId: string; length: number } | null = null;
  for (const entry of GLP1_DRUG_KEYWORDS) {
    for (const keyword of entry.keywords) {
      const needle = keyword.toLowerCase();
      if (!normalized.includes(needle)) {
        continue;
      }
      if (!best || needle.length > best.length) {
        best = { drugId: entry.drugId, length: needle.length };
      }
    }
  }
  return best?.drugId ?? null;
}

/** Pick rule-engine drug id: AST ids when an imported standard is active, flat id otherwise. */
export function resolveGlp1EvalDrugId(params: {
  userQuery: string;
  hasActiveComplianceStandard: boolean;
}): string {
  const detected = detectGlp1DrugIdFromQuery(params.userQuery);
  if (params.hasActiveComplianceStandard) {
    return detected ?? DEFAULT_AST_DRUG_ID;
  }
  return DEFAULT_FLAT_DRUG_ID;
}

export { DEFAULT_AST_DRUG_ID, DEFAULT_FLAT_DRUG_ID };
