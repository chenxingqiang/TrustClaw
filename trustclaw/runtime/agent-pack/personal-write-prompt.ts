import path from "node:path";
import { loadDefaultPersonalWritePromptTemplate } from "../text2sql/personal-write-prompt.js";
import { readPackAsset, resolveDefaultAgentsDir } from "./load.js";
import type { ResolvedAgentPack } from "./schema.js";

export function loadAgentPackPersonalWriteTemplate(pack: ResolvedAgentPack): string {
  const relative = pack.prompts.personalWrite?.trim();
  if (relative) {
    return readPackAsset(pack.packDir, relative);
  }
  try {
    const glp1PackDir = path.join(resolveDefaultAgentsDir(), "glp1");
    return readPackAsset(glp1PackDir, "prompts/personal-write-sql.v1.md");
  } catch {
    return loadDefaultPersonalWritePromptTemplate();
  }
}
