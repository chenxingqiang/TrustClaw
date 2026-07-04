import { describe, expect, it } from "vitest";
import { detectGlp1DrugIdFromQuery, resolveGlp1EvalDrugId } from "./resolve-glp1-drug-id.js";

describe("resolve-glp1-drug-id", () => {
  it("detects specific GLP-1 drugs from Chinese queries", () => {
    expect(detectGlp1DrugIdFromQuery("我可以用司美格鲁肽吗？")).toBe("29");
    expect(detectGlp1DrugIdFromQuery("度拉糖肽报销条件")).toBe("27");
    expect(detectGlp1DrugIdFromQuery("聚乙二醇洛塞那肽合规吗")).toBe("28");
    expect(detectGlp1DrugIdFromQuery("依苏帕格鲁肽α能否使用")).toBe("30");
  });

  it("prefers longer drug name matches", () => {
    expect(detectGlp1DrugIdFromQuery("洛塞那肽和司美格鲁肽对比")).toBe("29");
  });

  it("uses AST default when standard active and drug unspecified", () => {
    expect(
      resolveGlp1EvalDrugId({ userQuery: "GLP-1 合规吗", hasActiveComplianceStandard: true }),
    ).toBe("29");
  });

  it("uses flat drug id when no imported standard", () => {
    expect(
      resolveGlp1EvalDrugId({
        userQuery: "司美格鲁肽可以用吗",
        hasActiveComplianceStandard: false,
      }),
    ).toBe("GLP1_SEMA");
  });

  it("uses detected AST id when standard active", () => {
    expect(
      resolveGlp1EvalDrugId({
        userQuery: "度拉糖肽合规吗",
        hasActiveComplianceStandard: true,
      }),
    ).toBe("27");
  });
});
