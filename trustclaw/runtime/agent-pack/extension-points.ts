/**
 * Documented Business Agent Pack extension registries (V1).
 * Healthcare bundles use strict engines; new verticals register here + schema enum bump.
 * Loader skips `_`-prefixed agent dirs (see `discoverAgentPackFiles`).
 */
import { AGENT_PACK_PIPELINE_STAGES } from "./schema.js";

export const AGENT_PACK_PIPELINE_STAGE_IDS = AGENT_PACK_PIPELINE_STAGES;

/** Rule evaluators wired in `trustclaw/runtime/rules/` + `run-chat.ts`. */
export const AGENT_PACK_RULE_ENGINE_IDS = ["ast-compliance", "nrdl-table", "none"] as const;

/** Decision payload builders in `trustclaw/runtime/pipeline/pack-decision.ts`. */
export const AGENT_PACK_DECISION_BUILDER_IDS = ["glp1-decision", "pass-through"] as const;

export type AgentPackRuleEngineId = (typeof AGENT_PACK_RULE_ENGINE_IDS)[number];
export type AgentPackDecisionBuilderId = (typeof AGENT_PACK_DECISION_BUILDER_IDS)[number];

/** Closed enums today — must match `agentPackDocumentSchema` until plugin-owned registries land. */
export function listAgentPackExtensionPoints(): {
  pipelineStages: readonly string[];
  ruleEngines: readonly AgentPackRuleEngineId[];
  decisionBuilders: readonly AgentPackDecisionBuilderId[];
} {
  return {
    pipelineStages: AGENT_PACK_PIPELINE_STAGE_IDS,
    ruleEngines: AGENT_PACK_RULE_ENGINE_IDS,
    decisionBuilders: AGENT_PACK_DECISION_BUILDER_IDS,
  };
}

export const agentPackDocumentJsonSchemaRef = "trustclaw/agents/_schema/agent-pack.v1.json";
