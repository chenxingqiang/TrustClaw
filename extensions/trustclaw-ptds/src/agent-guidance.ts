import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
import { buildPtdsHealthProfileSummary } from "../../../trustclaw/ptds/profile-summary.js";
import { TRUSTCLAW_PTDS_QUERY_TOOL, TRUSTCLAW_PTDS_WRITE_TOOL } from "../../../trustclaw/runtime/constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function loadC3poPtdsSystemPreset(): string {
  const presetPath = path.resolve(
    here,
    "..",
    "..",
    "..",
    "trustclaw",
    "agents",
    "glp1",
    "prompts",
    "c3po-ptds-system.v1.md",
  );
  try {
    return readFileSync(presetPath, "utf8").trim();
  } catch {
    return [
      "You are C3-PO, the TrustClaw PTDS Console assistant — not Claude Code or a generic coding bot.",
      "Help with local PTDS health Q&A (GLP-1 demo) via trustclaw_ptds_query; record vitals via trustclaw_ptds_write.",
    ].join("\n");
  }
}

const C3PO_PTDS_SYSTEM_PRESET = loadC3poPtdsSystemPreset();

const STATIC_GUIDANCE = [
  "## Active tools",
  `**Read (GLP-1 Q&A):** For eligibility, medication judgment, NRDL reimbursement — call **${TRUSTCLAW_PTDS_QUERY_TOOL}** with the user's question.`,
  `**Write (record vitals):** When the user asks to save/update weight, BMI, HbA1c, blood pressure, or device metrics into PTDS — call **${TRUSTCLAW_PTDS_WRITE_TOOL}** with a clear natural-language write request. Never create SQLite files in the working directory.`,
  "Each tool call triggers **explicit user consent**; never bypass approval.",
  "Rely on tool results; do not invent vitals, SQL, or rule outcomes.",
  "",
  "## Post-mount briefing",
  "When a **Mounted PTDS profile** section appears below and you have not yet summarized it in this session, proactively:",
  "1) greet the user, 2) summarize key metrics and risk flags in 3–5 bullets, 3) explain that PTDS-backed reads/writes require explicit data-use approval per tool call.",
].join("\n");

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
  needsBriefing: boolean,
): string {
  const lines = [
    "## Mounted PTDS profile (local SQLite)",
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

export function buildTrustclawPtdsAgentGuidance(options: {
  pluginConfig?: TrustclawPluginConfig;
  messages?: unknown[];
}): {
  prependSystemContext: string;
  prependContext?: string;
} {
  const prependSystemContext = [C3PO_PTDS_SYSTEM_PRESET, "", STATIC_GUIDANCE].join("\n");
  const paths = resolveTrustclawPaths(options.pluginConfig);
  const profile = buildPtdsHealthProfileSummary({ dbPath: paths.dbPath });
  if (!profile.mounted) {
    return { prependSystemContext };
  }
  const needsBriefing = !sessionHasMountBriefing(options.messages);
  return {
    prependSystemContext,
    prependContext: formatMountedProfileContext(profile, needsBriefing),
  };
}

/** @deprecated Use buildTrustclawPtdsAgentGuidance(). */
export const TRUSTCLAW_PTDS_AGENT_GUIDANCE = buildTrustclawPtdsAgentGuidance({}).prependSystemContext;
