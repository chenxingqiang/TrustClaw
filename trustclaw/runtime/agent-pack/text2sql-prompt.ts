import type { ResolvedAgentPack } from "./schema.js";
import { readPackAsset } from "./load.js";
import { loadDefaultText2SqlPromptTemplate } from "../text2sql/prompt.js";

export function loadAgentPackText2SqlTemplate(pack: ResolvedAgentPack): string {
  const relative = pack.prompts.text2sql?.trim();
  if (!relative) {
    return loadDefaultText2SqlPromptTemplate();
  }
  return readPackAsset(pack.packDir, relative);
}
