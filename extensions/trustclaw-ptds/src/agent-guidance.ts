import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
import { buildPtdsHealthProfileSummary } from "../../../trustclaw/ptds/profile-summary.js";
import {
  buildAgentPackSystemContext,
  getAgentPackRegistry,
  resolveSessionAgentPack,
  type ResolvedAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";

function sessionHasMountBriefing(messages: unknown[] | undefined): boolean {
  if (!Array.isArray(messages)) {
    return false;
  }
  for (const entry of messages) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const role = record.role;
    if (role !== "assistant") {
      continue;
    }
    const content = record.content;
    if (typeof content === "string" && content.includes("PTDS profile briefing")) {
      return true;
    }
    if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block &&
          typeof block === "object" &&
          typeof (block as { text?: string }).text === "string" &&
          (block as { text: string }).text.includes("PTDS profile briefing")
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function formatMountedProfileContext(
  profile: ReturnType<typeof buildPtdsHealthProfileSummary>,
  pack: ResolvedAgentPack,
  needsBriefing: boolean,
): string {
  const lines = [
    `## Mounted PTDS profile (agent pack: ${pack.id})`,
    "```json",
    JSON.stringify(
      {
        patient_name: profile.patient_name,
        gender: profile.gender,
        age_years: profile.age_years,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        bmi: profile.bmi,
        hba1c_percent: profile.hba1c_percent,
        diagnoses: profile.diagnoses,
        medications: profile.medications,
        snapshot: profile.snapshot,
        analysis_notes: profile.analysis_notes,
      },
      null,
      2,
    ),
    "```",
  ];
  if (needsBriefing) {
    lines.push(
      "",
      "**Action required:** Deliver the **PTDS profile briefing** now (include the marker phrase `PTDS profile briefing` once).",
    );
  }
  return lines.join("\n");
}

function resolvePack(
  pluginConfig: TrustclawPluginConfig | undefined,
  sessionKey?: string,
  openclawAgentId?: string,
): ResolvedAgentPack {
  if (sessionKey?.trim()) {
    return resolveSessionAgentPack({
      sessionKey,
      openclawAgentId,
      pluginConfig,
    }).pack;
  }
  const registry = getAgentPackRegistry({
    agentsDir: pluginConfig?.agentPacksDir,
    defaultPackId: pluginConfig?.defaultAgentPack,
  });
  return registry.resolve({ openclawAgentId });
}

export function buildTrustclawPtdsAgentGuidance(options: {
  pluginConfig?: TrustclawPluginConfig;
  messages?: unknown[];
  sessionKey?: string;
  openclawAgentId?: string;
}): {
  prependSystemContext: string;
  prependContext?: string;
  agentPackId: string;
} {
  const pack = resolvePack(options.pluginConfig, options.sessionKey, options.openclawAgentId);
  const prependSystemContext = buildAgentPackSystemContext(pack);
  const paths = resolveTrustclawPaths(options.pluginConfig);
  const profile = buildPtdsHealthProfileSummary({ dbPath: paths.dbPath });
  if (!profile.mounted) {
    return { prependSystemContext, agentPackId: pack.id };
  }
  const needsBriefing = !sessionHasMountBriefing(options.messages);
  return {
    prependSystemContext,
    prependContext: formatMountedProfileContext(profile, pack, needsBriefing),
    agentPackId: pack.id,
  };
}

/** @deprecated Use buildTrustclawPtdsAgentGuidance(). */
export const TRUSTCLAW_PTDS_AGENT_GUIDANCE = buildTrustclawPtdsAgentGuidance({}).prependSystemContext;
